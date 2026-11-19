// Cloudflare Pages middleware: chặn mọi đường dẫn dữ liệu (/js/data/...) nếu không có
// Firebase ID token hợp lệ của tài khoản đã xác minh email. Các trang và file khác đi qua bình thường.
// Biến môi trường cần đặt trên Cloudflare: FIREBASE_PROJECT_ID.
import { verifyFirebaseIdToken } from "../lib/firebase-token.js";

const PUBLIC_DATA = new Set(["i18n_dict.js"]); // bản dịch giao diện, không phải nội dung bài học

function deny(status, code) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      ...(status === 401 ? { "www-authenticate": 'Bearer realm="stillhere-words"' } : {}),
    },
  });
}

// Chuẩn hoá đường dẫn để không lách được bằng %2F, %2e%2e, chữ hoa, dấu // ...
export function normalizePath(pathname) {
  let p = pathname;
  for (let i = 0; i < 3; i++) { const d = decodeURIComponent(p); if (d === p) break; p = d; }
  p = p.replace(/\\/g, "/");
  p = new URL(p, "https://x.invalid").pathname;
  return p.replace(/\/{2,}/g, "/").toLowerCase();
}

export function isProtected(pathname) {
  const p = normalizePath(pathname);
  if (!p.includes("/js/data")) return false;
  const name = p.split("/").pop();
  return !(p.startsWith("/js/data/") && PUBLIC_DATA.has(name) && p === "/js/data/" + name);
}

export async function onRequest(context, deps = {}) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  let protectedPath;
  try { protectedPath = isProtected(url.pathname); }
  catch { return deny(400, "bad_path"); }
  if (!protectedPath) {
    const res = await next();
    if (!normalizePath(url.pathname).startsWith("/js/data/") || res.status !== 200) return res;
    // Bản dịch giao diện (công khai): cho lưu đệm ngắn để trang mở nhanh.
    const out = new Response(res.body, res);
    out.headers.set("cache-control", "public, max-age=600, stale-while-revalidate=86400");
    return out;
  }

  if (request.method !== "GET" && request.method !== "HEAD") return deny(405, "method_not_allowed");
  if (!env.FIREBASE_PROJECT_ID) return deny(503, "not_configured"); // cấu hình thiếu thì đóng, không mở

  const m = /^Bearer\s+([A-Za-z0-9._-]+)$/.exec(request.headers.get("authorization") || "");
  if (!m) return deny(401, "login_required");

  let claims;
  try { claims = await verifyFirebaseIdToken(m[1], env.FIREBASE_PROJECT_ID, deps); }
  catch { return deny(401, "invalid_token"); }
  if (claims.email_verified !== true) return deny(403, "email_not_verified");

  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set("cache-control", "private, no-store");
  out.headers.set("x-robots-tag", "noindex, nofollow");
  out.headers.set("vary", "Authorization");
  return out;
}
