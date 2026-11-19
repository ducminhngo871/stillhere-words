// Kiểm tra Firebase ID token (JWT RS256) bằng WebCrypto, không dùng thư viện ngoài.
// Theo hướng dẫn của Firebase: https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library

export const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const SKEW = 60; // giây cho phép lệch đồng hồ

let jwksCache = { url: "", keys: null, until: 0 };

export function _resetCache() { jwksCache = { url: "", keys: null, until: 0 }; }

async function getKeys(url, fetchImpl) {
  const now = Date.now();
  if (jwksCache.keys && jwksCache.url === url && now < jwksCache.until) return jwksCache.keys;
  const r = await fetchImpl(url);
  if (!r.ok) throw new Error("jwks_fetch_failed");
  const body = await r.json();
  const m = /max-age=(\d+)/.exec(r.headers.get("cache-control") || "");
  const ttl = Math.min(m ? Number(m[1]) : 3600, 6 * 3600) * 1000;
  jwksCache = { url, keys: body.keys || [], until: now + ttl };
  return jwksCache.keys;
}

function b64urlBytes(s) {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("bad_b64");
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
const b64urlJson = s => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));

/** Trả về payload nếu token hợp lệ, ngược lại ném lỗi. */
export async function verifyFirebaseIdToken(token, projectId, opts = {}) {
  const fetchImpl = opts.fetch || fetch;
  const jwksUrl = opts.jwksUrl || JWKS_URL;
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (!projectId) throw new Error("no_project");
  if (typeof token !== "string" || token.length > 4096) throw new Error("bad_token");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("bad_token");

  const header = b64urlJson(parts[0]);
  const payload = b64urlJson(parts[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("bad_alg");

  if (payload.aud !== projectId) throw new Error("bad_aud");
  if (payload.iss !== "https://securetoken.google.com/" + projectId) throw new Error("bad_iss");
  if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 128) throw new Error("bad_sub");
  if (typeof payload.exp !== "number" || payload.exp <= now - SKEW) throw new Error("expired");
  if (typeof payload.iat !== "number" || payload.iat > now + SKEW) throw new Error("bad_iat");
  if (typeof payload.auth_time !== "number" || payload.auth_time > now + SKEW) throw new Error("bad_auth_time");

  const jwk = (await getKeys(jwksUrl, fetchImpl)).find(k => k.kid === header.kid);
  if (!jwk) throw new Error("unknown_kid");
  const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) throw new Error("bad_signature");
  return payload;
}
