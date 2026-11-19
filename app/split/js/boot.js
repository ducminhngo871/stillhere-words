/* Nạp dữ liệu và ứng dụng, ưu tiên hiện trang thật nhanh.
   - Chưa cấu hình Firebase (FIREBASE_CONFIG = null): nạp thẳng dữ liệu rồi app.js (chế độ phát triển).
   - Có Firebase:
     · Khách (máy này chưa đăng nhập): chạy app.js ngay với dữ liệu rỗng (trang chủ + nút đăng nhập),
       Firebase tải ngầm song song.
     · Học sinh đã đăng nhập, máy đã lưu dữ liệu (Cache Storage): chạy app.js ngay với dữ liệu đã lưu,
       rồi kiểm tra đăng nhập và cập nhật dữ liệu ngầm (dùng ETag, chỉ tải lại khi dữ liệu đổi).
     · Học sinh đã đăng nhập nhưng máy chưa có dữ liệu (lần đầu): chờ token, tải dữ liệu, lưu lại.
   Máy chủ (functions/_middleware.js) chỉ trả dữ liệu cho tài khoản đã đăng nhập và đã xác minh email.
   Khi trạng thái đăng nhập đổi (đăng nhập, đăng xuất, vừa xác minh), trang tải lại. Đăng xuất thì xoá dữ liệu đã lưu. */
(() => {
  "use strict";
  const ORDER = ["D", "IELTS_NEW", "BK", "SAT", "SAFF", "I18N_DICT", "EXTRA_EN"];
  const PUBLIC = new Set(["I18N_DICT"]);
  const GATED = ORDER.filter(n => !PUBLIC.has(n));
  const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  const CACHE = "shw-data-v1";
  const HINT = "shw-signed-in"; // localStorage: máy này đang có học sinh đăng nhập (đã xác minh)
  const EMPTY = {
    D: { words: [], fam: [], sents: [], passages: [], affixes: [] },
    IELTS_NEW: { words: [], vifix: {} },
    BK: { tests: [], heads: [], vi: {} },
    SAT: { words: [], wic: [] },
    SAFF: { roots: [], prefixes: [], suffixes: [], splits: {}, pos: {} },
    EXTRA_EN: {},
  };

  // ordered = true: tải song song nhưng chạy đúng thứ tự (dùng cho dữ liệu + app.js).
  // ordered = false: chạy ngay khi tải xong, không chen vào hàng thứ tự ở trên (dùng cho Firebase).
  const loadScript = (src, ordered = true) => new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = src; s.async = !ordered;
    s.onload = ok; s.onerror = () => no(new Error("Không tải được " + src));
    document.head.appendChild(s);
  });
  const runText = async text => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
    try { await loadScript(url); } finally { URL.revokeObjectURL(url); }
  };
  const dataUrl = n => "js/data/" + n + ".js";
  const hint = {
    get() { try { return localStorage.getItem(HINT) === "1"; } catch { return false; } },
    set(v) { try { v ? localStorage.setItem(HINT, "1") : localStorage.removeItem(HINT); } catch {} },
  };
  const ready = () => new Promise(ok => requestAnimationFrame(() => setTimeout(ok, 0)))
    .then(() => document.documentElement.classList.remove("booting"));

  /* ---- dữ liệu đã lưu trên máy ---- */
  const store = {
    async open() { try { return await caches.open(CACHE); } catch { return null; } },
    async readAll() {
      const c = await this.open(); if (!c) return null;
      const out = {};
      for (const n of GATED) {
        const r = await c.match(dataUrl(n)); if (!r) return null;
        out[n] = { text: await r.text(), etag: r.headers.get("x-shw-etag") || "" };
      }
      return out;
    },
    async put(n, text, etag) {
      const c = await this.open(); if (!c) return;
      await c.put(dataUrl(n), new Response(text, { headers: { "content-type": "text/javascript", "x-shw-etag": etag || "" } }));
    },
    async clear() { try { await caches.delete(CACHE); } catch {} },
  };

  async function fetchData(user, have = {}) {
    const get = async force => {
      const token = await user.getIdToken(force);
      return Promise.all(GATED.map(async n => {
        const headers = { Authorization: "Bearer " + token };
        if (have[n] && have[n].etag) headers["If-None-Match"] = have[n].etag;
        const r = await fetch(dataUrl(n), { headers, cache: "no-store", credentials: "omit" });
        if (r.status === 304) return [n, null];
        if (!r.ok) { const e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
        return [n, { text: await r.text(), etag: r.headers.get("etag") || "" }];
      }));
    };
    let parts;
    try { parts = await get(false); }
    catch (e) { if (e.status === 401 || e.status === 403) parts = await get(true); else throw e; }
    const fresh = {};
    for (const [n, v] of parts) if (v) { fresh[n] = v; await store.put(n, v.text, v.etag); }
    return fresh;
  }

  async function startLocal() {
    window.DATA_READY = true;
    await Promise.all(ORDER.map(n => loadScript(dataUrl(n))));
    await loadScript("js/app.js");
    return ready();
  }

  async function start() {
    if (typeof FIREBASE_CONFIG === "undefined" || !FIREBASE_CONFIG) return startLocal();

    // Firebase tải ngầm ngay từ đầu; app.js dùng window.FB_READY thay vì tự tải.
    // Firebase chạy riêng, không chặn app.js. Ba file tải song song (preload), auth/firestore chạy sau app.
    const FB = ["firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js"].map(f => SDK + f);
    for (const href of FB) { const l = document.createElement("link"); l.rel = "preload"; l.as = "script"; l.href = href; document.head.appendChild(l); }
    window.FB_READY = loadScript(FB[0], false)
      .then(() => Promise.all([loadScript(FB[1], false), loadScript(FB[2], false)]))
      .then(() => { firebase.initializeApp(FIREBASE_CONFIG); return firebase; });
    window.FB_READY.catch(() => {});
    const authState = window.FB_READY.then(() => new Promise(ok => {
      const off = firebase.auth().onAuthStateChanged(u => { off(); ok(u); });
    }));

    const i18n = loadScript(dataUrl("I18N_DICT"));
    let data = null, fromCache = false;

    if (hint.get()) {
      data = await store.readAll();
      fromCache = !!data;
      if (!data) {
        // Lần đầu trên máy này: phải chờ đăng nhập và tải dữ liệu.
        const u = await authState;
        if (u && u.emailVerified) {
          try { data = await fetchData(u); } catch (e) { console.error("Không tải được dữ liệu", e); data = null; }
          if (data && GATED.some(n => !data[n])) data = null;
        } else { hint.set(false); }
      }
    }

    window.DATA_READY = !!data;
    await i18n;
    for (const n of GATED) {
      if (data) await runText(data[n].text);
      else window[n] = EMPTY[n];
    }
    await loadScript("js/app.js");
    await ready();

    // Sau khi trang đã hiện: kiểm tra đăng nhập, cập nhật dữ liệu ngầm, theo dõi thay đổi.
    const u = await authState;
    const canLearn = !!(u && u.emailVerified);
    if (canLearn) {
      hint.set(true);
      if (fromCache) fetchData(u, data).catch(e => console.warn("Chưa cập nhật được dữ liệu", e));
    }
    if (canLearn !== window.DATA_READY) { if (!canLearn) { hint.set(false); await store.clear(); } return location.reload(); }

    firebase.auth().onAuthStateChanged(async u2 => {
      const ok = !!(u2 && u2.emailVerified);
      if (ok === window.DATA_READY) return;
      if (ok) hint.set(true); else { hint.set(false); await store.clear(); }
      location.reload();
    });
  }

  start().catch(e => {
    console.error(e);
    document.documentElement.classList.remove("booting");
    const box = document.createElement("div");
    box.className = "infonote";
    box.style.margin = "16px";
    box.textContent = "Không tải được trang. Hãy kiểm tra kết nối mạng rồi tải lại.";
    document.body.prepend(box);
  });
})();
