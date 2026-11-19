// Kiểm thử chặn dữ liệu: node --test tests/gate.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { onRequest, isProtected } from "../functions/_middleware.js";
import { _resetCache } from "../lib/firebase-token.js";

const PROJECT = "demo-stillhere";
const enc = new TextEncoder();
const b64url = bytes => Buffer.from(bytes).toString("base64url");
const j64 = obj => b64url(enc.encode(JSON.stringify(obj)));

const keyPair = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const otherPair = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const pubJwk = { ...(await crypto.subtle.exportKey("jwk", keyPair.publicKey)), kid: "k1", alg: "RS256", use: "sig" };

let jwksCalls = 0;
const fakeFetch = async () => { jwksCalls++; return new Response(JSON.stringify({ keys: [pubJwk] }), { headers: { "cache-control": "public, max-age=3600" } }); };
const deps = { fetch: fakeFetch, jwksUrl: "https://jwks.test/" };

const now = () => Math.floor(Date.now() / 1000);
function claims(over = {}) {
  return { iss: "https://securetoken.google.com/" + PROJECT, aud: PROJECT, sub: "uid123", iat: now() - 10,
    exp: now() + 3600, auth_time: now() - 10, email: "s@x.test", email_verified: true, ...over };
}
async function sign(payload, { kid = "k1", alg = "RS256", key = keyPair.privateKey } = {}) {
  const h = j64({ alg, kid, typ: "JWT" }), p = j64(payload);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(h + "." + p));
  return h + "." + p + "." + b64url(new Uint8Array(sig));
}

async function call(path, { token, method = "GET", env = { FIREBASE_PROJECT_ID: PROJECT }, rawAuth } = {}) {
  let nextCalled = false;
  const headers = {};
  if (rawAuth !== undefined) headers.authorization = rawAuth;
  else if (token) headers.authorization = "Bearer " + token;
  const request = new Request("https://words.test" + path, { method, headers });
  const res = await onRequest({ request, env, next: async () => { nextCalled = true; return new Response("const SAT = {};", { headers: { "cache-control": "public, max-age=999" } }); } }, deps);
  return { status: res.status, nextCalled, res };
}

test.beforeEach(() => _resetCache());

test("trang và file thường đi qua không cần đăng nhập", async () => {
  for (const p of ["/", "/index.html", "/js/app.js", "/js/boot.js", "/css/styles.css", "/assets/about-avatar.png", "/js/data/I18N_DICT.js"]) {
    const r = await call(p);
    assert.equal(r.nextCalled, true, p);
  }
});

test("dữ liệu bị chặn khi không có token", async () => {
  for (const n of ["D", "IELTS_NEW", "BK", "SAT", "SAFF", "EXTRA_EN"]) {
    const r = await call(`/js/data/${n}.js`);
    assert.equal(r.status, 401, n); assert.equal(r.nextCalled, false, n);
  }
});

test("không lách được bằng biến đổi đường dẫn", async () => {
  const tricks = ["/js/data/SAT.js?x=1", "/JS/DATA/SAT.js", "/js//data/SAT.js", "/js/data//SAT.js", "/js%2Fdata%2FSAT.js",
    "/js%252Fdata%252FSAT.js", "/css/../js/data/SAT.js", "/css/%2e%2e/js/data/SAT.js", "/js/data/SAT", "/js/data/",
    "/js/data", "/js\\data\\SAT.js", "/js/data/%53AT.js", "/js/data/I18N_DICT.js/../SAT.js", "/js/data/sub/../SAT.js"];
  for (const p of tricks) {
    const r = await call(p);
    assert.equal(r.nextCalled, false, p);
    assert.ok([400, 401].includes(r.status), p + " → " + r.status);
  }
});

test("đường dẫn hỏng bị từ chối", async () => {
  const r = await call("/js/data/%E0%A4%A.js");
  assert.equal(r.nextCalled, false);
});

test("token hợp lệ, email đã xác minh: được tải, không cache công khai", async () => {
  const r = await call("/js/data/SAT.js", { token: await sign(claims()) });
  assert.equal(r.status, 200); assert.equal(r.nextCalled, true);
  assert.equal(r.res.headers.get("cache-control"), "private, no-store");
  assert.match(r.res.headers.get("x-robots-tag"), /noindex/);
});

test("email chưa xác minh: 403", async () => {
  const r = await call("/js/data/SAT.js", { token: await sign(claims({ email_verified: false })) });
  assert.equal(r.status, 403); assert.equal(r.nextCalled, false);
  const r2 = await call("/js/data/SAT.js", { token: await sign(claims({ email_verified: undefined })) });
  assert.equal(r2.status, 403);
});

test("token sai bị từ chối", async () => {
  const bad = {
    "hết hạn": await sign(claims({ exp: now() - 3600 })),
    "sai dự án (aud)": await sign(claims({ aud: "other-project" })),
    "sai nơi cấp (iss)": await sign(claims({ iss: "https://securetoken.google.com/other-project" })),
    "không có sub": await sign(claims({ sub: "" })),
    "iat ở tương lai": await sign(claims({ iat: now() + 3600 })),
    "auth_time ở tương lai": await sign(claims({ auth_time: now() + 3600 })),
    "khoá ký lạ": await sign(claims(), { key: otherPair.privateKey }),
    "kid lạ": await sign(claims(), { kid: "nope" }),
    "alg none": j64({ alg: "none", kid: "k1" }) + "." + j64(claims()) + ".",
    "alg HS256": await sign(claims(), { alg: "HS256" }),
    "rác": "abc.def.ghi",
    "thiếu phần": "abc.def",
  };
  const good = await sign(claims());
  const [h, p, s] = good.split(".");
  bad["sửa payload giữ chữ ký"] = h + "." + j64(claims({ sub: "attacker" })) + "." + s;
  bad["chữ ký cắt ngắn"] = h + "." + p + "." + s.slice(0, 20);
  for (const [name, tok] of Object.entries(bad)) {
    const r = await call("/js/data/SAT.js", { token: tok });
    assert.equal(r.status, 401, name); assert.equal(r.nextCalled, false, name);
  }
});

test("header Authorization sai dạng", async () => {
  const tok = await sign(claims());
  for (const a of ["", tok, "Basic " + tok, "Bearer", "Bearer " + tok + " extra", "bearer"]) {
    const r = await call("/js/data/SAT.js", { rawAuth: a });
    assert.equal(r.status, 401, JSON.stringify(a)); assert.equal(r.nextCalled, false);
  }
});

test("chỉ cho GET/HEAD với dữ liệu", async () => {
  const tok = await sign(claims());
  for (const m of ["POST", "PUT", "DELETE"]) {
    const r = await call("/js/data/SAT.js", { token: tok, method: m });
    assert.equal(r.status, 405, m); assert.equal(r.nextCalled, false);
  }
  const h = await call("/js/data/SAT.js", { token: tok, method: "HEAD" });
  assert.equal(h.status, 200);
});

test("thiếu FIREBASE_PROJECT_ID: đóng, không mở", async () => {
  const tok = await sign(claims());
  const r = await call("/js/data/SAT.js", { token: tok, env: {} });
  assert.equal(r.status, 503); assert.equal(r.nextCalled, false);
});

test("khoá công khai được cache, không tải lại mỗi lần", async () => {
  jwksCalls = 0;
  const tok = await sign(claims());
  for (let i = 0; i < 5; i++) await call("/js/data/SAT.js", { token: tok });
  assert.equal(jwksCalls, 1);
});

test("isProtected", () => {
  assert.equal(isProtected("/js/data/SAT.js"), true);
  assert.equal(isProtected("/js/data/I18N_DICT.js"), false);
  assert.equal(isProtected("/js/app.js"), false);
});

test("bản dịch giao diện được lưu đệm, dữ liệu bài học thì không", async () => {
  const pub = await call("/js/data/I18N_DICT.js");
  assert.equal(pub.nextCalled, true);
  assert.match(pub.res.headers.get("cache-control"), /public, max-age=600/);
  const tok = await sign(claims());
  const priv = await call("/js/data/SAT.js", { token: tok });
  assert.equal(priv.res.headers.get("cache-control"), "private, no-store");
  const app = await call("/js/app.js");
  assert.equal(app.res.headers.get("cache-control"), "public, max-age=999");
});
