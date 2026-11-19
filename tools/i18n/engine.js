/* ================= NGÔN NGỮ (VI / EN) ================= */
const I18N_DICT = __DICT__;
const I18N_RULES = __RULES__.map(([p, r]) => [new RegExp(p), r]);
const VNRE = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;
const NUMRE = /\d+(?:[.,]\d+)?/g;
let LANG = store.get("tv2-lang", "vi");
function trCore(t) {
  const flat = t.replace(/\s+/g, " ");
  const v = I18N_DICT[flat.replace(NUMRE, "{n}")];
  if (v != null) { const nums = flat.match(NUMRE) || []; let i = 0; return v.replace(/\{n\}/g, () => nums[i++] ?? ""); }
  for (const [re, rep] of I18N_RULES) { const m = flat.match(re); if (m) return rep.replace(/\$(\d)/g, (_, k) => { const g = m[k] || ""; return (VNRE.test(g) && trCore(g)) || g; }); }
  return null;
}
function tr(text) {
  const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/), core = m[2];
  if (!VNRE.test(core)) return text;
  let r = trCore(core);
  if (r == null) {
    const parts = core.split(/(?<=[.!?])\s+/);
    if (parts.length > 1) { let changed = false; const out = parts.map(p => { if (!VNRE.test(p)) return p; const x = trCore(p); if (x != null) { changed = true; return x; } return p; }); if (changed) r = out.join(" "); }
  }
  return r == null ? text : m[1] + r + m[3];
}
const I18N_ATTRS = ["placeholder", "title", "aria-label"];
function skipNode(el) { return !el || (el.closest && el.closest("script,style,[data-noi18n]")); }
function trText(n) {
  if (skipNode(n.parentElement)) return;
  if (n.__vi !== undefined && n.nodeValue !== n.__en) n.__vi = undefined;
  if (LANG === "en") {
    const src = n.__vi !== undefined ? n.__vi : n.nodeValue;
    const out = tr(src);
    if (out !== src) { n.__vi = src; n.__en = out; if (n.nodeValue !== out) n.nodeValue = out; }
  } else if (n.__vi !== undefined) { const v = n.__vi; n.__vi = undefined; n.__en = undefined; n.nodeValue = v; }
}
function trAttrs(el) {
  if (skipNode(el)) return;
  el.__i18n = el.__i18n || {};
  for (const a of I18N_ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const cur = el.getAttribute(a), st = el.__i18n[a];
    if (st && cur !== st.en) delete el.__i18n[a];
    const s2 = el.__i18n[a];
    if (LANG === "en") { const src = s2 ? s2.vi : cur, out = tr(src); if (out !== src) { el.__i18n[a] = { vi: src, en: out }; if (cur !== out) el.setAttribute(a, out); } }
    else if (s2) { delete el.__i18n[a]; el.setAttribute(a, s2.vi); }
  }
}
function trTree(root) {
  if (root.nodeType === 3) { trText(root); return; }
  if (root.nodeType !== 1 || skipNode(root)) return;
  trAttrs(root);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n; while ((n = tw.nextNode())) { if (n.nodeType === 3) trText(n); else trAttrs(n); }
}
const i18nObs = new MutationObserver(ms => {
  for (const m of ms) {
    if (m.type === "childList") m.addedNodes.forEach(trTree);
    else if (m.type === "characterData") { if (m.target.nodeValue !== m.target.__en) trText(m.target); }
    else if (m.type === "attributes") { const st = m.target.__i18n && m.target.__i18n[m.attributeName]; if (!st || m.target.getAttribute(m.attributeName) !== st.en) trAttrs(m.target); }
  }
});
function setLang(l) {
  LANG = l; store.set("tv2-lang", l);
  document.documentElement.lang = l;
  document.title = l === "en" ? "Academic Vocabulary – IELTS & SAT" : "Từ vựng học thuật – IELTS & SAT";
  $("lang-vi").classList.toggle("on", l === "vi"); $("lang-en").classList.toggle("on", l === "en");
  $("lang-vi").setAttribute("aria-pressed", l === "vi"); $("lang-en").setAttribute("aria-pressed", l === "en");
  trTree(document.body);
}
$("lang-vi").onclick = () => setLang("vi");
$("lang-en").onclick = () => setLang("en");
i18nObs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
setLang(LANG);
