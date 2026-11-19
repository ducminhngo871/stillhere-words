D.affixes.forEach(a => { if (/35 từ đầu/.test(a.note)) a.note = ""; });
IELTS_NEW.words.forEach(x => D.words.push(x));
const WORDS = D.words, N = WORDS.length;
const BYW = Object.fromEntries(WORDS.map(w => [w.w, w]));
const HEADS = new Set(WORDS.map(w => w.w));
const FAMBY = {}; D.fam.forEach(f => (FAMBY[f.root] = FAMBY[f.root] || []).push(f));
IELTS_NEW.words.forEach(x => { if (!FAMBY[x.w] && x.fam.length) FAMBY[x.w] = x.fam.map(f => ({ form: f, pos: "" })); });
const SENTBY = {}; D.sents.forEach(s => (SENTBY[s.w] = SENTBY[s.w] || []).push(s));

/* ---------- helpers ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const norm = s => (s || "").toLowerCase().replace(/[’']/g, "'").replace(/[.,!?;:]+$/g, "").trim().replace(/\s+/g, " ");
const LET = "ABCDEFGHIJKLMNOPQRSTU";
const clampN = (v, d) => Math.max(1, Math.min(N, parseInt(v) || d));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
let wrong = store.get("tv2-wrong", {});
const saveWrong = () => { store.set("tv2-wrong", wrong); if (typeof scheduleSync === "function") scheduleSync(); };
const markWrong = w => { wrong[w] = (wrong[w] || 0) + 1; saveWrong(); };
const markRight = w => { if (wrong[w]) { wrong[w] = Math.max(0, wrong[w] - 1); saveWrong(); } };
const wrongList = () => Object.keys(wrong).filter(k => wrong[k] > 0 && BYW[k]);
const synShow = w => { const s = w.syn.filter(x => !HEADS.has(x)); return (s.length ? s : w.syn).slice(0, 2); };
const exampleOf = w => { const s = (SENTBY[w.w] || []).find(x => !x.f) || (SENTBY[w.w] || [])[0]; return s ? esc(s.t).replace("____", `<em>${esc(s.a)}</em>`) : ""; };
const speak = (txt, rate) => { try { const u = new SpeechSynthesisUtterance(txt); u.lang = "en-US"; u.rate = rate || .9; speechSynthesis.cancel(); speechSynthesis.speak(u); return true; } catch (e) { return false; } };
const hasSpeech = "speechSynthesis" in window;

/* ---------- tabs ---------- */
let running = false;
function show(tab) {
  CUR_TAB = tab;
  ["v-setup","v-test","v-learn","v-affix","v-sat-setup","v-sat-learn","v-sat-affix","v-guide","v-home","v-learned"].forEach(v => $(v).classList.add("hidden"));
  const map = { test: "v-setup", testrun: "v-test", learn: "v-learn", affix: "v-affix", sattest: "v-sat-setup", satlearn: "v-sat-learn", sataffix: "v-sat-affix", guide: "v-guide", home: "v-home", learned: "v-learned" };
  $(map[tab]).classList.remove("hidden");
  const t = tab === "testrun" || tab === "sattest" ? "test" : tab === "satlearn" ? "learn" : tab === "sataffix" ? "affix" : tab;
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
  window.scrollTo(0, 0);
}
document.querySelector(".tabs").onclick = async e => {
  const b = e.target.closest("button"); if (!b) return;
  if (running && !(await ask(LEAVE))) return;
  stopTimer(); running = false; stopMatch();
  const t = b.dataset.tab;
  if (t === "guide") { show("guide"); guideFor(); return; }
  if (t === "learned") { show("learned"); renderLearned(); return; }
  if (SET === "sat") { if (t === "test") { satRefresh(); show("sattest"); } if (t === "learn") { show("satlearn"); satLearnStart(); } if (t === "affix") { show("sataffix"); satAffixStart(); } return; }
  if (t === "test") { refreshSetup(); show("test"); }
  if (t === "learn") { show("learn"); startLearn(curLearn); }
  if (t === "affix") { show("affix"); startAffix(curAffix); }
};

/* ================= SHARED HELPERS (also used by Học từ) ================= */
function rangeWords(a, z) { return WORDS.slice(a - 1, z); }
const MATCHT = ["mdef","msyn","mant"];
const matchText = (t, w) => t === "mdef" ? [w.def] : t === "msyn" ? synShow(w) : w.ant;
function compatible(t, a, b) {
  const ta = matchText(t, a).map(norm), tb = matchText(t, b).map(norm);
  if (ta.some(x => tb.includes(x))) return false;
  if (ta.includes(b.w) || tb.includes(a.w)) return false;
  if (a.syn.includes(b.w) || b.syn.includes(a.w)) return false;
  return true;
}
function viOverlap(a, b) { const A = a.vi.split(/[,;] /), B2 = b.vi.split(/[,;] /); return A.some(m => B2.some(n => m === n || m.startsWith(n) || n.startsWith(m))); }
function viDistractors(w) { return shuffle(WORDS.filter(o => o.w !== w.w && !viOverlap(o, w))).slice(0, 3).map(o => o.vi); }
function enDistractors(w) {
  const ok = o => o.w !== w.w && !w.syn.includes(o.w) && !o.syn.includes(w.w) && !viOverlap(o, w);
  const p0 = w.pos.split(",")[0];
  return shuffle(WORDS.filter(o => ok(o) && o.pos.split(",")[0] === p0)).concat(shuffle(WORDS.filter(o => ok(o) && o.pos.split(",")[0] !== p0))).slice(0, 3).map(o => o.w);
}
function optsHTML(it) { return `<div class="opts">${it.opts.map((o, j) => `<label class="opt"><input type="radio" name="${it.id}" value="${j}"><span>${esc(o)}</span></label>`).join("")}</div>`; }
const fmt = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

/* ================= BANK ================= */
const H5 = BK.heads, M = H5.length;
const VI5 = BK.vi;
Object.entries(IELTS_NEW.vifix).forEach(([w, v]) => { VI5[w] = v; if (BK.vi) BK.vi[w] = v; });
const idOf = w => H5.indexOf(w) + 1;
const TYPE_NAME = { def: "Nối từ với định nghĩa", syn: "Nối từ đồng nghĩa", ant: "Nối từ trái nghĩa", fill: "Điền từ vào chỗ trống" };
const normA = s => norm(s).replace(/is(e|es|ed|ing|ation|ations|er|ers)\b/g, "iz$1").replace(/yse\b/, "yze").replace(/our\b/, "or");
const accepts = (val, list) => list.map(normA).includes(normA(val));
const POOL = { def: [], syn: [], ant: [], fill: [], form: [] };
BK.tests.forEach(t => t.sections.forEach(s => {
  if (s.type === "fill") s.items.forEach(it => (it.b.some(b => b.f) ? POOL.form : POOL.fill).push({ t: it.t, b: it.b, src: t.id }));
  else s.items.forEach(it => POOL[s.type].push({ w: it.w, id: it.id, text: it.text, src: t.id }));
}));
WORDS.forEach(w => {
  const id = idOf(w.w); if (!id) return;
  if (!POOL.def.some(p => p.w === w.w)) POOL.def.push({ w: w.w, id, text: w.def, src: "c" });
  if (w.syn.length) POOL.syn.push({ w: w.w, id, text: synShow(w).join(", "), src: "c" });
  if (w.ant.length) POOL.ant.push({ w: w.w, id, text: w.ant.join(", "), src: "c" });
});
D.sents.forEach(s => { const id = idOf(s.w); (s.f ? POOL.form : POOL.fill).push({ t: s.t, b: [{ a: [s.a, ...s.alt], root: s.w, id, f: !!s.f }], src: "c" }); });

/* ================= TEST SETUP ================= */
let tmode = "custom", origSel = null;
const LVL = {
  easy: "Trắc nghiệm. Có bảng từ gợi ý, chỗ trống cần đổi dạng có ghi chú. Đoạn văn có khung đáp án.",
  medium: "Có bảng từ gợi ý nhưng không ghi chú chỗ nào cần đổi dạng. Đoạn văn có thêm dạng từ gây nhiễu.",
  hard: "Tự gõ đáp án, không có bảng từ (chỉ gợi ý nghĩa tiếng Việt). Bài nối có thêm lựa chọn gây nhiễu. Đoạn văn điền ONE WORD ONLY."
};
const qCount = t => t.sections.reduce((a, s) => a + (s.type === "fill" ? s.items.reduce((x, i) => x + i.b.length, 0) : s.items.length), 0);
$("o-list").innerHTML = BK.tests.map(t => `<button class="tcard" data-id="${t.id}"><b>${esc(t.title)}</b><small>Từ ${t.start}–${t.end >= M ? "hết" : t.end} · ${t.sections.length} phần · ${qCount(t)} câu</small>${t.claude ? '<br><span class="badge">Đáp án Claude soạn, chờ duyệt</span>' : ""}</button>`).join("");
$("o-list").onclick = e => { const b = e.target.closest(".tcard"); if (!b) return; origSel = b.dataset.id; $("o-list").querySelectorAll(".tcard").forEach(x => x.classList.toggle("on", x === b)); refreshSetup(); };
const RANGES = BK.tests.filter(t => t.id !== "1-35b").map(t => [t.start, Math.min(t.end, M)]);
$("c-chips").innerHTML = RANGES.map(([a, z]) => `<button class="chip" data-a="${a}" data-z="${z}">${a}–${z}</button>`).join("") + `<button class="chip" data-a="1" data-z="${M}">Cả ${M} từ</button>`;
$("c-chips").onclick = e => { const b = e.target.closest(".chip"); if (!b) return; $("c-from").value = b.dataset.a; $("c-to").value = b.dataset.z; refreshSetup(); };
document.querySelectorAll("input[name=tmode]").forEach(r => r.onchange = () => { tmode = r.value; refreshSetup(); });

const saved = store.get("tv3-settings", null);
if (saved) {
  ["from","to","count"].forEach(k => { if (saved[k] != null) $("c-" + k).value = saved[k]; });
  if (saved.sec != null) $("t-sec").value = saved.sec;
  if (saved.name) $("t-name").value = saved.name;
  if (saved.types) document.querySelectorAll("input[name=ctype]").forEach(c => c.checked = saved.types.includes(c.value));
  if (saved.level) document.querySelector(`input[name=level][value=${saved.level}]`).checked = true;
}
const clampM = (v, d) => Math.max(1, Math.min(M, parseInt(v) || d));
function readSettings() {
  return { from: clampM($("c-from").value, 1), to: clampM($("c-to").value, M), count: parseInt($("c-count").value) || 0,
    sec: parseInt($("t-sec").value), types: [...document.querySelectorAll("input[name=ctype]:checked")].map(c => c.value),
    level: document.querySelector("input[name=level]:checked").value, prio: $("c-prio").checked, name: $("t-name").value.trim() };
}
const inR = (id, s) => id && id >= s.from && id <= s.to;
function pools(s) {
  const P = {};
  P.vocab = H5.map((w, i) => ({ w, id: i + 1, vi: VI5[w] })).filter(x => inR(x.id, s) && x.vi);
  ["def","syn","ant"].forEach(k => P[k] = POOL[k].filter(p => inR(p.id, s)));
  ["fill","form"].forEach(k => P[k] = POOL[k].filter(p => p.b.every(b => inR(b.id, s))));
  P.passage = (s.from <= 35) ? D.passages : [];
  return P;
}
function refreshSetup() {
  $("p-orig").classList.toggle("hidden", tmode !== "orig");
  $("p-custom").classList.toggle("hidden", tmode !== "custom");
  let msg = "", sum = "";
  const sec = parseInt($("t-sec").value);
  const tdesc = q => sec ? `khoảng ${Math.ceil(q * sec / 60)} phút` : "không giới hạn thời gian";
  if (tmode === "orig") {
    const t = BK.tests.find(x => x.id === origSel);
    if (!t) msg = "Chọn một đề ở trên.";
    else sum = `${t.title}: ${t.sections.length} phần, ${qCount(t)} câu, làm trong ${tdesc(qCount(t))}.`;
  } else {
    const s = readSettings();
    $("lvl-desc").textContent = LVL[s.level];
    const P = pools(s);
    const av = { vi: P.vocab.length, vi2en: P.vocab.length, def2en: P.def.length, mdef: P.def.length, msyn: P.syn.length, mant: P.ant.length,
      fill: P.fill.reduce((a, x) => a + x.b.length, 0), form: P.form.reduce((a, x) => a + x.b.length, 0), passage: P.passage.reduce((a, p) => a + p.gaps.length, 0) };
    document.querySelectorAll("input[name=ctype]").forEach(c => { const lab = c.closest("label"); lab.style.opacity = av[c.value] ? 1 : .5; });
    $("psg-note").textContent = P.passage.length ? "Có 10 đoạn văn cho từ 1–35." : "Hiện chỉ có cho từ 1–35, chưa có cho phạm vi này.";
    const usable = s.types.filter(t => av[t] > 0);
    $("c-avail").innerHTML = `Ngân hàng trong phạm vi ${s.from}–${s.to}: ${av.mdef} định nghĩa, ${av.msyn} cặp đồng nghĩa, ${av.mant} cặp trái nghĩa, ${av.fill} chỗ trống giữ nguyên dạng, ${av.form} chỗ trống đổi dạng.`;
    const maxQ = usable.reduce((a, t) => a + Math.min(av[t], t === "passage" ? 999 : 999), 0);
    if (s.from > s.to) msg = "Số bắt đầu phải nhỏ hơn hoặc bằng số kết thúc.";
    else if (!s.types.length) msg = "Chọn ít nhất một dạng bài.";
    else if (!usable.length) msg = "Phạm vi này chưa có câu hỏi cho các dạng bài đã chọn.";
    else if (s.count < 5) msg = "Số câu tối thiểu là 5.";
    else { const q = Math.min(s.count, maxQ); $("c-count-hint").textContent = `tối đa ${maxQ} câu với lựa chọn này`; sum = `Đề gồm khoảng ${q} câu từ phạm vi ${s.from}–${s.to}, làm trong ${tdesc(q)}.`; }
  }
  $("t-err").textContent = msg; $("t-start").disabled = !!msg; $("t-summary").textContent = sum;
  const ww = wrongList5(), n = $("wrong-notice");
  if (ww.length) { n.classList.remove("hidden"); n.innerHTML = `Bạn đang có <b>${ww.length}</b> từ hay sai.${tmode === "custom" ? " Chọn “Ưu tiên từ hay sai” để ôn lại chúng." : ""}`; } else n.classList.add("hidden");
}
const wrongList5 = () => Object.keys(wrong).filter(k => wrong[k] > 0);
document.querySelectorAll("#v-setup input, #v-setup select").forEach(el => { el.addEventListener("input", refreshSetup); el.addEventListener("change", refreshSetup); });

/* ================= BUILD ================= */
let test = null, timerId = null, endAt = 0, startAt = 0, qid = 0;
const nid = () => "q" + (qid++);
function buildOriginal(t) {
  const items = [], parts = [];
  t.sections.forEach((s, si) => {
    const p = { kind: s.type, title: `Phần ${si + 1}`, instr: s.instr, words: s.words, sec: si };
    if (s.type === "fill") p.sents = s.items.map(it => ({ t: it.t, blanks: it.b.map(b => { const x = { id: nid(), kind: "text", root: b.root, part: si, accept: b.a, show: b.a[0], f: b.f }; items.push(x); return x; }) }));
    else { p.opts = s.opts; p.rows = s.items.map(it => { const x = { id: nid(), kind: "select", root: it.w, part: si, w: it.w, correct: String(s.opts.indexOf(it.text)), show: LET[s.opts.indexOf(it.text)] }; items.push(x); return x; }); }
    parts.push(p);
  });
  return { orig: t, items, parts, total: items.length };
}
function prioSort(arr, wordsOf, s) {
  arr = shuffle(arr);
  if (!s.prio) return arr;
  const sc = x => wordsOf(x).reduce((a, w) => a + (wrong[w] || 0), 0);
  return arr.sort((a, b) => sc(b) - sc(a));
}
function compat(a, b) {
  const ta = norm(a.text), tb = norm(b.text);
  if (a.w === b.w || ta === tb) return false;
  const sa = ta.split(/,\s*/), sb = tb.split(/,\s*/);
  if (sa.some(x => sb.includes(x))) return false;
  if (sa.includes(b.w) || sb.includes(a.w)) return false;
  return true;
}
function buildCustom(s) {
  const P = pools(s), lvl = s.level, items = [], parts = [];
  const types = s.types.filter(t => t !== "passage");
  // quotas
  const avail = { vi: P.vocab.length, vi2en: P.vocab.length, def2en: P.def.length, mdef: P.def.length, msyn: P.syn.length, mant: P.ant.length,
    fill: P.fill.reduce((a, x) => a + x.b.length, 0), form: P.form.reduce((a, x) => a + x.b.length, 0) };
  let target = s.count;
  let psg = [];
  if (s.types.includes("passage") && P.passage.length) {
    const set = new Set(H5.slice(s.from - 1, s.to));
    const n = types.length ? 1 : Math.max(1, Math.round(s.count / 9));
    psg = shuffle(P.passage).map(p => ({ p, hit: p.gaps.filter(g => set.has(g.root)).length })).sort((a, b) => b.hit - a.hit).slice(0, Math.min(3, n)).map(x => x.p);
    target -= psg.reduce((a, p) => a + p.gaps.length, 0);
  }
  const quota = {}; const act = types.filter(t => avail[t] > 0);
  let left = Math.max(0, target), guard = 0;
  act.forEach(t => quota[t] = 0);
  while (left > 0 && guard++ < 1000) { let moved = false; for (const t of act) { if (left <= 0) break; if (quota[t] < avail[t]) { quota[t]++; left--; moved = true; } } if (!moved) break; }
  const usedW = new Set();
  const mk = o => { const x = { id: nid(), ...o }; items.push(x); return x; };
  // vocab
  if (quota.vi) { const ws = prioSort(P.vocab, x => [x.w], s).slice(0, quota.vi); ws.forEach(x => usedW.add(x.w));
    parts.push({ kind: "vi", rows: ws.map(x => { const opts = shuffle([x.vi, ...viDis5(x)]); return mk({ kind: "radio", root: x.w, part: "vi", w: x.w, opts, correct: opts.indexOf(x.vi), show: x.vi }); }) }); }
  if (quota.vi2en) { const ws = prioSort(P.vocab.filter(x => !usedW.has(x.w)), x => [x.w], s).slice(0, quota.vi2en);
    parts.push({ kind: "vi2en", rows: ws.map(x => lvl === "hard" ? mk({ kind: "text", root: x.w, part: "vi2en", prompt: x.vi, accept: [x.w], show: x.w, len: x.w.length })
      : (o => mk({ kind: "radio", root: x.w, part: "vi2en", prompt: x.vi, opts: o, correct: o.indexOf(x.w), show: x.w }))(shuffle([x.w, ...enDis5(x.w, s)]))) }); }
  if (quota.def2en) { const ws = prioSort(P.def, x => [x.w], s).slice(0, quota.def2en);
    parts.push({ kind: "def2en", rows: ws.map(x => lvl === "hard" ? mk({ kind: "text", root: x.w, part: "def2en", prompt: x.text, accept: [x.w], show: x.w, len: x.w.length })
      : (o => mk({ kind: "radio", root: x.w, part: "def2en", prompt: x.text, opts: o, correct: o.indexOf(x.w), show: x.w }))(shuffle([x.w, ...enDis5(x.w, s)]))) }); }
  // matching
  [["mdef","def"],["msyn","syn"],["mant","ant"]].forEach(([t, k]) => {
    if (!quota[t]) return;
    const pool = prioSort(P[k], x => [x.w], s), groups = [], seen = new Set(); let n = 0;
    for (const x of pool) { if (n >= quota[t]) break; if (seen.has(x.w)) continue;
      const g = groups.find(g => g.length < 6 && g.every(y => compat(x, y))); if (g) g.push(x); else groups.push([x]); seen.add(x.w); n++; }
    const gs = groups.filter(g => g.length >= 2);
    if (!gs.length) return;
    parts.push({ kind: t, groups: gs.map(g => {
      let opts = g.map(x => x.text);
      if (lvl === "hard") { const extra = shuffle(P[k].filter(y => !g.some(z => z.w === y.w) && g.every(z => compat(y, z)))).slice(0, 2).map(y => y.text); opts = opts.concat(extra); }
      opts = shuffle([...new Set(opts)]);
      return { opts, rows: g.map(x => mk({ kind: "select", root: x.w, part: t, w: x.w, correct: String(opts.indexOf(x.text)), show: LET[opts.indexOf(x.text)] })) }; }) });
  });
  // fill / form
  ["fill","form"].forEach(t => {
    if (!quota[t]) return;
    const pool = prioSort(P[t], x => x.b.map(b => b.root), s); const chosen = []; let n = 0;
    for (const x of pool) { if (n >= quota[t]) break; if (chosen.some(c => c.t === x.t)) continue; chosen.push(x); n += x.b.length; }
    const groups = []; for (let i = 0; i < chosen.length; i += 6) groups.push(chosen.slice(i, i + 6));
    if (groups.length > 1 && groups[groups.length - 1].length < 3) { const l = groups.pop(); groups[groups.length - 1].push(...l); }
    parts.push({ kind: t, groups: groups.map(g => {
      const roots = [...new Set(g.flatMap(x => x.b.map(b => b.root)))];
      const extra = shuffle(H5.slice(s.from - 1, s.to).filter(w => !roots.includes(w))).slice(0, 2);
      return { bank: lvl === "hard" ? null : shuffle(roots.concat(extra)), sents: g.map(x => ({ t: x.t, blanks: x.b.map(b => mk({ kind: "text", root: b.root, part: t, accept: b.a, show: b.a[0], f: b.f, label: lvl === "easy" && b.f, hint: lvl === "hard" ? (VI5[b.root] || "") : "" })) })) }; }) });
  });
  // passages
  psg.forEach(p => {
    const its = p.gaps.map(g => ({ root: g.root, part: "passage", g, accept: [g.a, ...g.alt], show: g.a }));
    let box = null;
    if (lvl !== "hard") {
      let words = p.gaps.map(g => g.a).concat(p.dis);
      if (lvl === "medium") { let added = 0; shuffle(p.gaps).forEach(g => { if (added >= 3) return; const sib = shuffle((FAMBY[g.root] || []).map(f => f.form)).find(f => !words.includes(f)); if (sib) { words.push(sib); added++; } }); }
      box = shuffle([...new Set(words)]);
      its.forEach(it => { it.kind = "select"; it.correct = String(box.indexOf(it.g.a)); it.show = `${LET[box.indexOf(it.g.a)]} (${it.g.a})`; });
    } else its.forEach(it => it.kind = "text");
    parts.push({ kind: "passage", p, box, rows: its.map(it => mk(it)) });
  });
  const order = ["vi","vi2en","def2en","mdef","msyn","mant","fill","form","passage"];
  parts.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return { s, items, parts, total: items.length };
}
function viOv5(a, b) { const A = a.split(/[,;] /), B2 = b.split(/[,;] /); return A.some(m => B2.some(n => m === n || (m.length > 3 && n.length > 3 && (m.startsWith(n) || n.startsWith(m))))); }
function viDis5(x) { const near = H5.map((w, i) => ({ w, vi: VI5[w], id: i + 1 })).filter(o => o.vi && o.w !== x.w && !viOv5(o.vi, x.vi)); return shuffle(near).slice(0, 3).map(o => o.vi); }
function enDis5(w, s) {
  const id = idOf(w); const near = H5.filter((o, i) => o !== w && Math.abs(i + 1 - id) <= 40 && !viOv5(VI5[o] || "-", VI5[w] || "+"));
  const syn = POOL.syn.filter(p => p.w === w).map(p => norm(p.text));
  return shuffle(near.filter(o => !syn.some(t => t.includes(o)))).slice(0, 3);
}

/* ================= RENDER ================= */
const CUSTOM_TITLES = {
  vi: ["Chọn nghĩa tiếng Việt", "Chọn nghĩa đúng nhất với mỗi từ."],
  vi2en: ["Nghĩa tiếng Việt → từ tiếng Anh", "Tìm từ tiếng Anh có nghĩa sau."],
  def2en: ["Định nghĩa → từ", "Tìm từ phù hợp với định nghĩa tiếng Anh."],
  mdef: ["Nối từ với định nghĩa", "Chọn chữ cái của định nghĩa đúng."],
  msyn: ["Nối từ đồng nghĩa", "Chọn chữ cái của từ có nghĩa gần nhất."],
  mant: ["Nối từ trái nghĩa", "Chọn chữ cái của từ có nghĩa trái ngược."],
  fill: ["Điền từ vào chỗ trống", ""], form: ["Điền từ có đổi dạng", ""], passage: ["Hoàn thành đoạn tóm tắt", ""]
};
const inp = (x, w) => `<input class="blank" id="${x.id}" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" style="width:${w || 8.5}em" aria-label="Chỗ trống">`;
function sentHTML(sn, n) {
  const segs = sn.t.split("____"); let h = `<span class="n">${n}.</span>${esc(segs[0])}`;
  sn.blanks.forEach((x, i) => { h += `<span data-q="${x.id}">${inp(x)}<span class="res"></span>${x.label ? '<span class="formtag">đổi dạng</span>' : ""}${x.hint ? `<span class="vh"> (${esc(x.hint)})</span>` : ""}</span>${esc(segs[i + 1])}`; });
  return `<div class="sent">${h}</div>`;
}
function matchHTML(opts, rows) {
  return `<ul class="defs">${opts.map((o, j) => `<li><b>${LET[j]}</b><span>${esc(o)}</span></li>`).join("")}</ul>` +
    rows.map(x => `<div class="match-row" data-q="${x.id}"><span class="word">${esc(x.w)}</span><span><select id="${x.id}" aria-label="Đáp án cho ${esc(x.w)}"><option value="">—</option>${opts.map((_, j) => `<option value="${j}">${LET[j]}</option>`).join("")}</select><span class="res"></span></span></div>`).join("");
}
function renderTest() {
  let h = "";
  if (test.orig) {
    $("t-head").innerHTML = `<div class="thead"><h2>${esc(test.orig.title)}</h2><div class="hint">Từ ${test.orig.start}–${test.orig.end >= M ? "hết" : test.orig.end}${test.orig.claude ? " · Đáp án do Claude soạn, đang chờ giáo viên duyệt" : ""}</div></div>`;
    test.parts.forEach(p => {
      h += `<div class="part"><div class="part-head"><span class="part-num">${p.sec + 1}.</span><div><h2>${TYPE_NAME[p.kind]}</h2><p>${esc(p.instr)}</p></div></div><div class="group">`;
      if (p.kind === "fill") { h += `<div class="wlist">${p.words.map(w => `<span>${esc(w)}</span>`).join("")}</div>` + p.sents.map((sn, i) => sentHTML(sn, i + 1)).join(""); }
      else h += matchHTML(p.opts, p.rows);
      h += `</div></div>`;
    });
  } else {
    $("t-head").innerHTML = `<div class="thead"><h2>Đề tự tạo</h2><div class="hint">Từ ${test.s.from}–${test.s.to} · ${({ easy: "Dễ", medium: "Trung bình", hard: "Khó" })[test.s.level]}</div></div>`;
    let pn = 0;
    test.parts.forEach(p => {
      pn++; let [title, sub] = CUSTOM_TITLES[p.kind];
      if (p.kind === "fill" || p.kind === "form") sub = test.s.level === "hard" ? "Tự viết từ phù hợp. Nghĩa tiếng Việt của từ gốc ở trong ngoặc." : p.kind === "form" ? (test.s.level === "easy" ? "Dùng các từ trong khung. Chỗ có nhãn “đổi dạng” cần biến đổi từ." : "Dùng các từ trong khung, có thể cần đổi dạng từ.") : "Dùng các từ trong khung.";
      if (p.kind === "passage") sub = p.box ? `Chọn chữ cái đúng từ khung ${LET[0]}–${LET[p.box.length - 1]}. Có nhiều lựa chọn hơn số chỗ trống.` : "Điền NO MORE THAN ONE WORD vào mỗi chỗ trống.";
      h += `<div class="part"><div class="part-head"><span class="part-num">${pn}.</span><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div></div>`;
      if (["vi","vi2en","def2en"].includes(p.kind)) h += p.rows.map(x => {
        const prompt = p.kind === "vi" ? `<div class="word">${esc(x.w)}</div>` : `<div class="prompt">${p.kind === "vi2en" ? `<b>${esc(x.prompt)}</b>` : esc(x.prompt)}</div>`;
        const body = x.kind === "radio" ? optsHTML(x) : `<div class="typed"><input type="text" id="${x.id}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Gõ từ tiếng Anh"><span class="hint">${x.len} chữ cái</span><span class="res"></span></div>`;
        return `<div class="q" data-q="${x.id}">${prompt}${body}</div>`; }).join("");
      if (MATCHT.includes(p.kind)) p.groups.forEach(g => h += `<div class="group">${matchHTML(g.opts, g.rows)}</div>`);
      if (p.kind === "fill" || p.kind === "form") { let n = 0; p.groups.forEach(g => { h += `<div class="group">${g.bank ? `<div class="bank">${g.bank.map(w => `<span>${esc(w)}</span>`).join("")}</div>` : ""}${g.sents.map(sn => sentHTML(sn, ++n)).join("")}</div>`; }); }
      if (p.kind === "passage") {
        h += `<div class="group"><div class="ptitle">${esc(p.p.title)}</div><div class="ptopic">Chủ đề: ${esc(p.p.topic)}</div>`;
        if (p.box) h += `<div class="box">${p.box.map((w, j) => `<div><b>${LET[j]}</b>${esc(w)}</div>`).join("")}</div>`;
        const byN = Object.fromEntries(p.rows.map(x => [x.g.n, x]));
        h += `<div class="passage">${esc(p.p.text).replace(/\[(\d+)\]/g, (m, n) => { const x = byN[n];
          const ctl = p.box ? `<select id="${x.id}" aria-label="Chỗ trống ${n}"><option value="">—</option>${p.box.map((_, j) => `<option value="${j}">${LET[j]}</option>`).join("")}</select>` : inp(x, 7.5);
          return `<span data-q="${x.id}"><span class="gn">(${n})</span>${ctl}<span class="res"></span></span>`; })}</div></div>`;
      }
      h += `</div>`;
    });
  }
  $("t-body").innerHTML = h;
  updateProgress();
}
function answered(x) { if (x.kind === "radio") return !!document.querySelector(`input[name="${x.id}"]:checked`); const el = $(x.id); return el && el.value.trim() !== ""; }
function updateProgress() { if (running && test) $("t-progress").textContent = `Đã làm ${test.items.filter(answered).length}/${test.total} câu`; }
$("t-body").addEventListener("input", updateProgress);
$("t-body").addEventListener("change", updateProgress);

/* ================= RUN / TIMER ================= */
function startTimer() {
  startAt = Date.now();
  const sec = parseInt($("t-sec").value);
  if (!sec) { $("timer").textContent = "∞"; return; }
  endAt = startAt + test.total * sec * 1000;
  const tick = () => { const left = endAt - Date.now(); $("timer").textContent = fmt(left); $("timer").classList.toggle("low", left < 60000); if (left <= 0) { stopTimer(); grade(true); } };
  tick(); timerId = setInterval(tick, 250);
}
function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }
function startTest(fixedWords) {
  const s = readSettings();
  store.set("tv3-settings", { from: s.from, to: s.to, count: s.count, sec: s.sec, name: s.name, types: s.types, level: s.level });
  qid = 0;
  if (fixedWords) {
    const ids = fixedWords.map(idOf).filter(Boolean);
    test = buildCustom({ ...s, from: Math.min(...ids), to: Math.max(...ids), count: Math.max(10, fixedWords.length * 2), prio: true, types: s.types.length ? s.types : ["vi","mdef","fill","form"] });
    const keep = new Set(fixedWords);
    test.parts.forEach(p => { if (p.rows && p.kind !== "passage") p.rows = p.rows.filter(x => keep.has(x.root)); if (p.groups) p.groups.forEach(g => { if (g.rows) g.rows = g.rows.filter(x => keep.has(x.root)); }); });
    test.parts.forEach(p => { if (p.groups) p.groups = p.groups.filter(g => (g.rows || g.sents || []).length); });
    test.parts = test.parts.filter(p => (p.rows && p.rows.length) || (p.groups && p.groups.some(g => (g.rows || g.sents || []).length)));
    const live = new Set(); test.parts.forEach(p => { (p.rows || []).forEach(x => live.add(x.id)); (p.groups || []).forEach(g => { (g.rows || []).forEach(x => live.add(x.id)); (g.sents || []).forEach(sn => sn.blanks.forEach(x => live.add(x.id))); }); });
    test.items = test.items.filter(x => live.has(x.id)); test.total = test.items.length;
  } else if (tmode === "orig") test = buildOriginal(BK.tests.find(x => x.id === origSel));
  else test = buildCustom(s);
  if (!test.total) { $("t-err").textContent = "Không tạo được đề với lựa chọn này."; return; }
  running = true;
  $("t-result").classList.add("hidden"); $("t-result").innerHTML = ""; $("t-after").innerHTML = "";
  $("t-submit").classList.remove("hidden"); $("timer").classList.remove("low");
  renderTest(); show("testrun"); startTimer();
}
$("t-start").onclick = () => startTest();
$("t-submit").onclick = async () => { const left = test.total - test.items.filter(answered).length; if (left > 0 && !(await ask({ title: "Nộp bài khi chưa làm hết?", text: `Bạn còn ${left} câu chưa làm. Những câu này sẽ được tính là chưa đúng, và bạn vẫn xem được đáp án sau khi nộp.`, ok: "Nộp bài", cancel: "Làm tiếp" }))) return; if (!running) return; stopTimer(); grade(false); };

/* ================= GRADE ================= */
function grade(timeUp) {
  running = false;
  const res = [];
  test.items.forEach(x => {
    const wrap = document.querySelector(`[data-q="${x.id}"]`); if (!wrap) return;
    let ok = false;
    if (x.kind === "radio") {
      const sel = document.querySelector(`input[name="${x.id}"]:checked`);
      ok = !!sel && +sel.value === x.correct;
      wrap.querySelectorAll(".opt").forEach((l, j) => { if (j === x.correct) l.classList.add("right"); else if (sel && +sel.value === j) l.classList.add("wrong"); });
      if (x.expl) wrap.insertAdjacentHTML("beforeend", `<div class="fb ${ok ? "ok" : "no"}" style="color:var(--text)">${x.expl}</div>`);
    } else {
      const el = $(x.id);
      ok = x.kind === "select" ? el.value !== "" && el.value === x.correct : accepts(el.value, x.accept);
      const r = wrap.querySelector(".res");
      const fix = x.kind === "select" && x.part !== "passage" ? "→ " + x.show : (x.accept.length > 1 && x.kind === "text" ? x.accept.slice(0, 2).join(" / ") : x.show);
      r.innerHTML = ok ? `<span class="mark ok">✓</span>` : `<span class="mark">✗</span><span class="fix">${esc(fix)}</span>`;
    }
    res.push({ x, ok });
  });
  $("t-body").querySelectorAll("input,select").forEach(el => el.disabled = true);
  const byRoot = {};
  res.forEach(r => { if (!r.x.root) return; byRoot[r.x.root] = byRoot[r.x.root] === false ? false : r.ok; });
  Object.entries(byRoot).forEach(([w, ok]) => ok ? markRight(w) : markWrong(w));
  const right = res.filter(r => r.ok).length, pct = Math.round(right / res.length * 100);
  const used = Math.round((Date.now() - startAt) / 1000);
  const bad = Object.keys(byRoot).filter(w => !byRoot[w]);
  const groupsOf = test.orig ? test.parts.map(p => [p.sec, `Phần ${p.sec + 1} (${TYPE_NAME[p.kind]})`]) : test.parts.map(p => [p.kind, CUSTOM_TITLES[p.kind][0]]);
  const seen = new Set(); const lines = groupsOf.filter(([k]) => !seen.has(k) && seen.add(k)).map(([k, name]) => { const rs = res.filter(r => r.x.part === k); return `${name}: ${rs.filter(r => r.ok).length}/${rs.length}`; });
  const name = $("t-name").value.trim();
  $("t-result").innerHTML = `<div class="sheet" style="background:var(--paper)">
    ${timeUp ? '<div class="notice">Hết giờ. Bài đã được nộp tự động.</div>' : ""}
    <div class="score"><div class="big">${right}<small>/ ${res.length}</small></div>
    <div><h2>${name ? esc(name) + ", " : ""}bạn đúng ${pct}%</h2>
    <p class="lead" style="margin:4px 0 0">Thời gian ${fmt(used * 1000)}.<br>${lines.map(esc).join("<br>")}</p></div></div>
    ${bad.length ? `<h3 style="margin-top:16px">Từ cần ôn lại (${bad.length})</h3><ul class="wronglist">${bad.map(w => `<li><b>${esc(w)}</b><span>${esc(VI5[w] || SATD[w] || "")}</span></li>`).join("")}</ul>` : `<p style="margin-top:14px">Đúng hết. Thử độ khó cao hơn nhé.</p>`}
  </div>`;
  $("t-result").classList.remove("hidden"); $("t-submit").classList.add("hidden");
  $("timer").textContent = fmt(used * 1000); $("timer").classList.remove("low");
  $("t-progress").textContent = "Đã nộp. Xem lại đáp án bên dưới.";
  const acts = $("t-after"); acts.innerHTML = "";
  const mkb = (txt, cls, fn) => { const b = document.createElement("button"); b.className = "btn " + cls; b.textContent = txt; b.onclick = fn; acts.appendChild(b); };
  if (test.sat) {
    if (bad.length) mkb(`Luyện lại ${bad.length} từ sai`, "pen", () => startSatTest(bad));
    mkb("Tạo đề mới", "", () => startSatTest());
    mkb("Đổi cài đặt", "ghost", () => { satRefresh(); show("sattest"); });
  } else {
  if (bad.length) mkb(`Luyện lại ${bad.length} từ sai`, "pen", () => startTest(bad));
  mkb(test.orig ? "Làm lại đề này" : "Tạo đề mới", "", () => startTest());
  mkb("Đổi cài đặt", "ghost", () => { refreshSetup(); show("test"); });
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

refreshSetup();


/* ================= SAT ================= */
let SET = "ielts";
const SW = { bb: SAT.words.filter(x => x.list === "bb"), br: SAT.words.filter(x => x.list === "br") };
const SATD = {}; SAT.words.forEach(x => { if (!SATD[x.core]) SATD[x.core] = x.d; });
const PREP_SET = ["in","to","on","of","by","with","for","about","toward","at","as","from"];
Object.assign(CUSTOM_TITLES, {
  sdef2w: ["Định nghĩa → từ", "Chọn từ đúng với định nghĩa."], sw2def: ["Từ → định nghĩa", "Chọn định nghĩa đúng của từ."],
  smatch: ["Nối từ với định nghĩa", "Chọn chữ cái của định nghĩa đúng."], scol: ["Giới từ đi kèm", "Chọn giới từ (hoặc tiểu từ) thường đi với từ này."],
  swic: ["Words in Context", "Chọn từ logic và chính xác nhất cho chỗ trống, như trong đề Digital SAT."]
});
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>");
const TRAPS = [["T1","Ngược chiều ngữ cảnh"],["T2","Nghĩa thông dụng, không phải nghĩa trong câu"],["T3","Không hợp ngữ cảnh"],["T4","Quá mạnh"],["T5","Quá yếu hoặc thiếu chính xác"],["T6","Sai chủ thể"],["T7","Sai sắc thái +/−"],["T8","Bẫy liên tưởng chủ đề"]];

function setSet(s) {
  SET = s;
  $("set-ielts").classList.toggle("off", s !== "ielts"); $("set-sat").classList.toggle("off", s !== "sat");
  stopTimer(); running = false; stopMatch();
  const keep = CUR_TAB;
  if (s === "sat") { satRefresh(); show("sattest"); } else { refreshSetup(); show("test"); }
  if (["guide", "learned", "home"].includes(keep)) { show(keep); if (keep === "guide") guideFor(); if (keep === "learned") renderLearned(); if (keep === "home") renderHome(); }
  try { ddSync(); } catch (e) {}
  renderHello();
}
$("set-ielts").onclick = async () => { if (!running || await ask(LEAVE)) setSet("ielts"); };
$("set-sat").onclick = async () => { if (!running || await ask(LEAVE)) setSet("sat"); };

/* --- setup --- */
const sList = () => document.querySelector("input[name=slist]:checked").value;
function satChips() { const L = SW[sList()].length, r = []; for (let a = 1; a <= L; a += 50) r.push([a, Math.min(L, a + 49)]);
  $("s-chips").innerHTML = r.map(([a, z]) => `<button class="chip" data-a="${a}" data-z="${z}">${a}–${z}</button>`).join("") + `<button class="chip" data-a="1" data-z="${L}">Cả ${L} từ</button>`; }
$("s-chips").onclick = e => { const b = e.target.closest(".chip"); if (!b) return; $("s-from").value = b.dataset.a; $("s-to").value = b.dataset.z; satRefresh(); };
const S_LVL = { easy: "Trắc nghiệm 4 lựa chọn, lựa chọn gây nhiễu lấy ngẫu nhiên.", medium: "Trắc nghiệm, lựa chọn gây nhiễu là các từ gần nhau trong danh sách nên dễ nhầm hơn.", hard: "Tự gõ từ ở dạng Định nghĩa → từ. Bài nối có thêm lựa chọn gây nhiễu." };
function satSettings() {
  const list = sList(), L = SW[list].length;
  return { list, from: Math.max(1, Math.min(L, parseInt($("s-from").value) || 1)), to: Math.max(1, Math.min(L, parseInt($("s-to").value) || L)),
    count: parseInt($("s-count").value) || 0, both: $("s-both").checked, prio: $("s-prio").checked,
    level: document.querySelector("input[name=slevel]:checked").value, types: [...document.querySelectorAll("input[name=stype]:checked")].map(c => c.value), sec: parseInt($("s-sec").value) };
}
function satPool(s) { let p = SW[s.list].slice(s.from - 1, s.to); if (s.both) p = p.filter(x => x.both); return p; }
function satRefresh() {
  satChips();
  const s = satSettings(); $("s-lvl-desc").textContent = S_LVL[s.level];
  const p = satPool(s), col = p.filter(x => x.prep).length;
  let msg = "";
  if (s.from > s.to) msg = "Số bắt đầu phải nhỏ hơn hoặc bằng số kết thúc.";
  else if (!s.types.length) msg = "Chọn ít nhất một dạng bài.";
  else if (p.length < 4 && s.types.some(t => t !== "swic")) msg = "Phạm vi này có quá ít từ (cần ít nhất 4).";
  else if (s.count < 5) msg = "Số câu tối thiểu là 5.";
  $("s-err").textContent = msg; $("s-start").disabled = !!msg;
  const wn = SAT.wic.filter(q => p.some(x => x.core === q.root)).length;
  $("s-summary").textContent = msg ? "" : `Phạm vi có ${p.length} từ${s.types.includes("scol") ? `, ${col} cụm có giới từ` : ""}${s.types.includes("swic") ? `, ${wn} câu Words in Context` : ""}. Đề khoảng ${s.count} câu${s.sec ? `, làm trong khoảng ${Math.ceil(s.count * s.sec / 60)} phút` : ""}.`;
}
document.querySelectorAll("#v-sat-setup input, #v-sat-setup select").forEach(el => { el.addEventListener("input", satRefresh); el.addEventListener("change", satRefresh); });

/* --- build --- */
function satDis(x, pool, k, lvl) {
  const ok = o => o.core !== x.core && norm(o.d) !== norm(x.d);
  let cand;
  if (lvl === "easy") cand = shuffle(SW[x.list].filter(ok));
  else { const i = SW[x.list].indexOf(x); cand = shuffle(SW[x.list].filter((o, j) => ok(o) && Math.abs(j - i) <= 25)); if (cand.length < k) cand = cand.concat(shuffle(SW[x.list].filter(ok))); }
  const seen = new Set(), out = []; for (const o of cand) { if (seen.has(o.core)) continue; seen.add(o.core); out.push(o); if (out.length >= k) break; } return out;
}
function buildSat(s, fixed) {
  qid = 0; const items = [], parts = [], lvl = s.level;
  const mk = o => { const x = { id: nid(), ...o }; items.push(x); return x; };
  let pool = satPool(s);
  if (fixed) { const f = new Set(fixed); pool = SW.bb.concat(SW.br).filter(x => f.has(x.core)); const seen = new Set(); pool = pool.filter(x => !seen.has(x.core) && seen.add(x.core)); }
  const prioSort2 = arr => { arr = shuffle(arr); if (s.prio || fixed) arr.sort((a, b) => (wrong[b.core] || 0) - (wrong[a.core] || 0)); return arr; };
  const types = s.types.slice(); let target = fixed ? Math.max(pool.length * 2, 8) : s.count;
  if (types.includes("swic")) { const cores = new Set(fixed ? fixed : pool.map(x => x.core));
    const wq = SAT.wic.filter(q => cores.has(q.root));
    const share = types.length === 1 ? s.count : Math.max(3, Math.round(s.count / types.length));
    const n = Math.min(wq.length, fixed ? wq.length : share);
    const qs = (s.prio || fixed ? shuffle(wq).sort((a, b) => (wrong[b.root] || 0) - (wrong[a.root] || 0)) : shuffle(wq)).slice(0, n);
    if (qs.length) { parts.push({ kind: "swic", rows: qs.map(q => mk({ kind: "radio", root: q.root, part: "swic", prompt: q.stem, mnm: q.mnm, opts: q.opts, correct: q.ans, show: q.opts[q.ans], expl: q.expl })) }); target -= qs.length; } }
  const rest = types.filter(t => t !== "swic"); const quota = {}; rest.forEach(t => quota[t] = 0);
  const colPool = pool.filter(x => x.prep);
  let left = Math.max(0, target), g = 0; while (left > 0 && g++ < 500) { let moved = false; for (const t of rest) { if (left <= 0) break; const cap = t === "scol" ? colPool.length : pool.length; if (quota[t] < cap) { quota[t]++; left--; moved = true; } } if (!moved) break; }
  const order = prioSort2(pool); let cur = 0; const take = n => { const out = []; for (let i = 0; i < n; i++) out.push(order[(cur++) % order.length]); return out; };
  if (quota.sdef2w) parts.push({ kind: "sdef2w", rows: take(quota.sdef2w).map(x => lvl === "hard" ? mk({ kind: "text", root: x.core, part: "sdef2w", prompt: x.d, accept: [x.w, x.core], show: x.w, len: x.w.length })
    : (o => mk({ kind: "radio", root: x.core, part: "sdef2w", prompt: x.d, opts: o, correct: o.indexOf(x.w), show: x.w }))(shuffle([x.w, ...satDis(x, pool, 3, lvl).map(o => o.w)]))) });
  if (quota.sw2def) parts.push({ kind: "sw2def", rows: take(quota.sw2def).map(x => (o => mk({ kind: "radio", root: x.core, part: "sw2def", w: x.w, opts: o, correct: o.indexOf(x.d), show: x.d }))(shuffle([x.d, ...satDis(x, pool, 3, lvl).map(o => o.d)]))) });
  if (quota.smatch) { const ws = take(quota.smatch), groups = []; ws.forEach(x => { const gg = groups.find(g => g.length < 6 && g.every(y => y.core !== x.core && norm(y.d) !== norm(x.d))); gg ? gg.push(x) : groups.push([x]); });
    const gs = groups.filter(g => g.length >= 2);
    if (gs.length) parts.push({ kind: "smatch", groups: gs.map(g => { let opts = g.map(x => x.d); if (lvl === "hard") opts = opts.concat(satDis(g[0], pool, 2, "medium").filter(o => !g.some(y => y.core === o.core)).map(o => o.d)); opts = shuffle([...new Set(opts)]);
      return { opts, rows: g.map(x => mk({ kind: "select", root: x.core, part: "smatch", w: x.w, correct: String(opts.indexOf(x.d)), show: LET[opts.indexOf(x.d)] })) }; }) }); }
  if (quota.scol && colPool.length) { const cp = prioSort2(colPool).slice(0, quota.scol);
    parts.push({ kind: "scol", rows: cp.map(x => { const ext = x.prep === "up" || x.prep === "down" ? ["up","down","off","out"] : PREP_SET; const o = shuffle([x.prep, ...shuffle(ext.filter(p => p !== x.prep)).slice(0, 3)]);
      const base = x.w.slice(0, x.w.length - x.prep.length).trim();
      return mk({ kind: "radio", root: x.core, part: "scol", prompt: `${base} ____`, hint: x.d, opts: o, correct: o.indexOf(x.prep), show: `${base} ${x.prep}` }); }) }); }
  const ord = ["swic","sdef2w","sw2def","smatch","scol"]; parts.sort((a, b) => ord.indexOf(a.kind) - ord.indexOf(b.kind));
  return { sat: true, s, items, parts, total: items.length };
}
function renderSat() {
  const s = test.s;
  $("t-head").innerHTML = `<div class="thead"><h2>Đề SAT tự tạo</h2><div class="hint">${s.list === "bb" ? "Danh sách hay gặp" : "Danh sách Barron's"} · từ ${s.from}–${s.to} · ${({ easy: "Dễ", medium: "Trung bình", hard: "Khó" })[s.level]}</div></div>`;
  let h = "", pn = 0;
  test.parts.forEach(p => {
    pn++; const [title, sub] = CUSTOM_TITLES[p.kind];
    h += `<div class="part"><div class="part-head"><span class="part-num">${pn}.</span><div><h2>${title}</h2><p>${sub}</p></div></div>`;
    if (p.kind === "swic") h += `<div class="legend" aria-label="Mã bẫy">${TRAPS.map(([k, v]) => `<span><b>${k}</b> ${esc(v)}</span>`).join("")}</div><p class="hint" style="margin-top:-4px">Sau khi nộp bài, mỗi lựa chọn sai được gắn một mã bẫy. Xem ví dụ cho từng mã trong tab Hướng dẫn.</p>`;
    if (p.kind === "smatch") p.groups.forEach(g => h += `<div class="group">${matchHTML(g.opts, g.rows)}</div>`);
    else h += p.rows.map(x => {
      let prompt;
      if (p.kind === "sw2def") prompt = `<div class="word">${esc(x.w)}</div>`;
      else if (p.kind === "scol") prompt = `<div class="prompt"><b>${esc(x.prompt)}</b> <span class="hint">(${esc(x.hint)})</span></div>`;
      else if (p.kind === "swic") { const u = (x.prompt.match(/\[\[(.+?)\]\]/) || [])[1];
        const ask = x.mnm ? (x.prompt.includes("most nearly mean") ? "" : `As used in the text, what does the word “${u}” most nearly mean?`) : "Which choice completes the text with the most logical and precise word or phrase?";
        prompt = `<div class="prompt">${md(x.prompt).replace("____", '<span style="display:inline-block;border-bottom:2px solid var(--ink);width:5em"></span>').replace(/\[\[(.+?)\]\]/, "<u>$1</u>")}</div>${ask ? `<div class="hint" style="margin-top:6px">${ask}</div>` : ""}`; }
      else prompt = `<div class="prompt">${esc(x.prompt)}</div>`;
      const body = x.kind === "radio" ? optsHTML(x) : `<div class="typed"><input type="text" id="${x.id}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Gõ từ tiếng Anh"><span class="hint">${x.len} ký tự</span><span class="res"></span></div>`;
      return `<div class="q" data-q="${x.id}">${prompt}${body}</div>`; }).join("");
    h += `</div>`;
  });
  $("t-body").innerHTML = h; updateProgress();
}
function startSatTest(fixed) {
  const s = satSettings();
  test = buildSat(s, fixed);
  if (!test.total) { $("s-err").textContent = "Không tạo được đề với lựa chọn này."; return; }
  running = true;
  $("t-result").classList.add("hidden"); $("t-result").innerHTML = ""; $("t-after").innerHTML = "";
  $("t-submit").classList.remove("hidden"); $("timer").classList.remove("low");
  renderSat(); show("testrun");
  startAt = Date.now(); stopTimer();
  if (!s.sec) $("timer").textContent = "∞";
  else { endAt = startAt + test.total * s.sec * 1000; const tick = () => { const left = endAt - Date.now(); $("timer").textContent = fmt(left); $("timer").classList.toggle("low", left < 60000); if (left <= 0) { stopTimer(); grade(true); } }; tick(); timerId = setInterval(tick, 250); }
}
$("s-start").onclick = () => startSatTest();

/* --- SAT learn: 4 modes --- */
let curSatLearn = "flash", SF = null, SA = null, SD = null, SMG = null;
const satMeaning = (x, useVi) => useVi ? x.vi : x.d;
function satLearnPool() {
  const list = $("sl-list").value, L = SW[list].length;
  const a = Math.max(1, Math.min(L, parseInt($("sl-from").value) || 1)), z = Math.max(1, Math.min(L, parseInt($("sl-to").value) || L));
  if (a > z) return { err: "Số bắt đầu phải nhỏ hơn hoặc bằng số kết thúc." };
  let p = SW[list].slice(a - 1, z); if ($("sl-wrong").checked) p = p.filter(x => wrong[x.core] > 0);
  const seen = new Set(); p = p.filter(x => !seen.has(x.core) && seen.add(x.core));
  if (!p.length) return { err: "Chưa có từ hay sai trong phạm vi này. Bỏ chọn “Chỉ từ hay sai” để học tất cả." };
  return { pool: p };
}
function satLearnStart(mode) {
  if (mode) curSatLearn = mode;
  stopSatMatch();
  document.querySelectorAll("#sl-modes .chip").forEach(c => c.classList.toggle("on", c.dataset.mode === curSatLearn));
  const { pool, err } = satLearnPool();
  if (err) { $("sl-area").innerHTML = `<div class="err">${err}</div>`; return; }
  ({ flash: satFlash, adapt: satAdapt, dict: satDict, match: satMatch })[curSatLearn](pool);
}
$("sl-modes").onclick = e => { const b = e.target.closest(".chip"); if (b) satLearnStart(b.dataset.mode); };
["sl-list","sl-from","sl-to","sl-wrong"].forEach(id => $(id).addEventListener("change", () => satLearnStart()));
const satNoVi = pool => pool.some(x => !x.vi) ? `<div class="notice" style="border-left-color:var(--ink);background:var(--soft)">Một số từ trong phạm vi này chưa có nghĩa tiếng Việt, nên sẽ hiện định nghĩa tiếng Anh thay thế.</div>` : "";

/* flashcards */
function satFlash(pool) {
  SF = { deck: shuffle(pool), size: pool.length, ok: 0 };
  $("sl-area").innerHTML = `${satNoVi(pool)}
    <div class="cardbar"><span class="counter" id="sf-prog"></span>${hasSpeech ? '<span><button class="speak" id="sf-say">🔊 Từ</button> <button class="speak" id="sf-sayex">🔊 Câu ví dụ</button></span>' : ""}</div>
    <div class="card" id="sf"><div class="card-inner" id="sf-in" role="button" tabindex="0" aria-label="Lật thẻ">
      <div class="face"><div class="bigword" id="sf-w"></div><div class="pos" id="sf-tag"></div><div class="tap">Chạm để lật thẻ</div></div>
      <div class="face back" id="sf-back"></div></div></div>
    <div class="actions" id="sf-acts"><button class="btn ghost" id="sf-again">Chưa thuộc</button><button class="btn" id="sf-ok">Đã thuộc</button></div>`;
  const flip = () => $("sf").classList.toggle("flipped");
  $("sf-in").onclick = flip; $("sf-in").onkeydown = e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } };
  $("sf-ok").onclick = () => { SF.ok++; markRight(SF.cur.core); markLearned("sat", SF.cur.core); satNext(); };
  $("sf-again").onclick = () => { markWrong(SF.cur.core); SF.deck.push(SF.cur); satNext(); };
  if ($("sf-say")) { $("sf-say").onclick = e => { e.stopPropagation(); speak(SF.cur.w); }; $("sf-sayex").onclick = e => { e.stopPropagation(); if (SF.cur.ex) speak(SF.cur.ex, .9); }; }
  satNext();
}
function satNext() {
  $("sf").classList.remove("flipped");
  if (!SF.deck.length) { $("sf-w").textContent = "Xong rồi!"; $("sf-tag").textContent = `Bạn đã thuộc ${SF.size} từ.`; $("sf-back").innerHTML = ""; $("sf-acts").innerHTML = `<button class="btn" onclick="satLearnStart('flash')">Học lại</button><button class="btn ghost" onclick="satLearnStart('adapt')">Chuyển sang học thích ứng</button>`; $("sf-prog").textContent = ""; return; }
  SF.cur = SF.deck.shift(); $("sf-prog").textContent = `Đã thuộc ${SF.ok}/${SF.size}`;
  if ($("sf-sayex")) $("sf-sayex").disabled = !SF.cur.ex;
  setTimeout(() => { if (!$("sf-w")) return; $("sf-w").textContent = SF.cur.w; $("sf-tag").textContent = SF.cur.both ? "Có trong cả hai danh sách" : "";
    const vi = SF.cur.vi || VI5[SF.cur.core];
    $("sf-back").innerHTML = `<dl>${vi ? `<div data-lang="vi"><dt>Nghĩa tiếng Việt</dt><dd class="vi">${esc(vi)}</dd></div>` : ""}<div><dt>Định nghĩa</dt><dd>${esc(SF.cur.d)}</dd></div>${SF.cur.ex ? `<div><dt>Ví dụ</dt><dd class="ex">${esc(SF.cur.ex)}</dd></div>` : ""}</dl>`; }, 160);
}

/* adaptive learn */
function satAdapt(pool) {
  SA = { total: pool.length, queue: shuffle(pool), active: [], lvl: {}, done: 0, last: null, pool };
  satAdaptFill();
  $("sl-area").innerHTML = `${satNoVi(pool)}<div class="counter" id="sa-prog"></div><div class="pbar"><i id="sa-bar"></i></div><div id="sa-q"></div>`;
  satAdaptNext();
}
function satAdaptFill() { while (SA.active.length < 6 && SA.queue.length) { const x = SA.queue.shift(); SA.active.push(x); SA.lvl[x.core] = 0; } }
function satAdaptNext() {
  $("sa-prog").textContent = `Đã thuộc ${SA.done}/${SA.total} · Đang học ${SA.active.length} từ`;
  $("sa-bar").style.width = (SA.done / SA.total * 100) + "%";
  if (!SA.active.length) { $("sa-q").innerHTML = `<div class="qcard"><div class="big">Hoàn thành!</div><p>Bạn đã thuộc cả ${SA.total} từ trong phạm vi này.</p><div class="actions"><button class="btn" onclick="satLearnStart('adapt')">Học lại</button><button class="btn ghost" id="sa-test">Làm bài kiểm tra ngay</button></div></div>`; $("sa-test").onclick = () => { satRefresh(); show("sattest"); }; return; }
  let c = SA.active.filter(x => x !== SA.last); if (!c.length) c = SA.active;
  const x = pick(c); SA.last = x;
  const L = SA.lvl[x.core];
  const dis = satDis(x, SA.pool, 3, "medium");
  const useVi = !!x.vi && dis.every(o => o.vi);
  let html, check, answer;
  if (L === 0) {
    const dir = Math.random() < .5;
    const right = dir ? satMeaning(x, useVi) : x.w;
    const opts = shuffle([right, ...dis.map(o => dir ? satMeaning(o, useVi) : o.w)]);
    html = `<div class="ask">${dir ? (useVi ? "Chọn nghĩa tiếng Việt" : "Chọn định nghĩa đúng") : "Chọn từ đúng"}</div><div class="${dir ? "big" : "mid"}">${esc(dir ? x.w : satMeaning(x, useVi))}</div>${optsHTML({ id: "saq", opts })}`;
    check = () => { const s = document.querySelector('input[name="saq"]:checked'); return s ? opts[s.value] === right : null; };
    answer = right;
  } else if (L === 1) {
    const opts = shuffle([x.w, ...dis.map(o => o.w)]);
    html = `<div class="ask">Định nghĩa này là của từ nào?</div><div class="mid">${esc(x.d)}</div>${optsHTML({ id: "saq", opts })}`;
    check = () => { const s = document.querySelector('input[name="saq"]:checked'); return s ? opts[s.value] === x.w : null; };
    answer = x.w;
  } else {
    html = `<div class="ask">Gõ từ tiếng Anh</div><div class="mid"><b>${esc(x.vi || x.d)}</b> <span class="hint">(${x.w.length} ký tự)</span></div><div class="typed"><input type="text" id="saq-t" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn sm" id="saq-go">Kiểm tra</button></div>`;
    check = () => { const v = $("saq-t").value; return v.trim() ? accepts(v, [x.w, x.core]) : null; };
    answer = x.w;
  }
  $("sa-q").innerHTML = `<div class="qcard">${html}<div id="sa-fb"></div></div>`;
  const submit = () => {
    const ok = check(); if (ok === null) return;
    $("sa-q").querySelectorAll("input").forEach(i => i.disabled = true); if ($("saq-go")) $("saq-go").disabled = true;
    if (ok) { SA.lvl[x.core]++; markRight(x.core); } else { SA.lvl[x.core] = 0; markWrong(x.core); }
    let mastered = false;
    if (SA.lvl[x.core] >= 3) { SA.active = SA.active.filter(y => y !== x); SA.done++; satAdaptFill(); mastered = true; markLearned("sat", x.core); }
    const ex = x.ex ? `<div class="ex" style="margin-top:6px;color:var(--text)">${esc(x.ex)}</div>` : "";
    $("sa-fb").innerHTML = ok ? `<div class="fb ok">Đúng rồi${mastered ? `. Bạn đã thuộc <b>${esc(x.w)}</b>!` : "!"}</div>`
      : `<div class="fb no">Chưa đúng. Đáp án: <b>${esc(answer)}</b><br><span style="color:var(--text)">${esc(x.w)}: ${esc(x.vi || x.d)}</span>${ex}</div><div class="actions"><button class="btn sm" id="sa-next">Tiếp tục</button></div>`;
    const run = SA; if (ok) setTimeout(() => { if (SA === run && $("sa-q")) satAdaptNext(); }, mastered ? 1100 : 700); else { $("sa-next").onclick = satAdaptNext; $("sa-next").focus(); }
  };
  $("sa-q").querySelectorAll('input[name="saq"]').forEach(r => r.addEventListener("change", submit));
  if ($("saq-t")) { $("saq-t").focus(); $("saq-go").onclick = submit; $("saq-t").onkeydown = e => { if (e.key === "Enter") submit(); }; }
}

/* dictation */
function satDict(pool) {
  if (!hasSpeech) { $("sl-area").innerHTML = `<div class="notice">Trình duyệt này không hỗ trợ phát âm, nên chưa dùng được chế độ nghe chép. Hãy thử Chrome hoặc Safari.</div>`; return; }
  SD = { list: shuffle(pool), i: 0, right: 0 };
  $("sl-area").innerHTML = `<div class="counter" id="sd-prog"></div><div class="pbar"><i id="sd-bar"></i></div>
    <div class="qcard"><div class="ask">Nghe và gõ lại từ</div>
    <div class="actions" style="margin:0 0 10px"><button class="btn sm" id="sd-say">🔊 Nghe</button><button class="btn sm ghost" id="sd-slow">🐢 Nghe chậm</button>
    <label class="hint" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sd-hint"> Hiện nghĩa gợi ý</label></div>
    <div id="sd-vi" class="mid hidden"></div>
    <div class="typed"><input type="text" id="sd-in" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Gõ từ bạn nghe được"><button class="btn sm" id="sd-go">Kiểm tra</button></div>
    <div id="sd-fb"></div></div>`;
  $("sd-say").onclick = () => speak(SD.w.w, .9); $("sd-slow").onclick = () => speak(SD.w.w, .5);
  $("sd-hint").onchange = () => $("sd-vi").classList.toggle("hidden", !$("sd-hint").checked);
  $("sd-go").onclick = satDictCheck; $("sd-in").onkeydown = e => { if (e.key === "Enter") satDictCheck(); };
  satDictNext();
}
function satDictNext() {
  $("sd-prog").textContent = `Câu ${Math.min(SD.i + 1, SD.list.length)}/${SD.list.length} · Đúng ${SD.right}`;
  $("sd-bar").style.width = (SD.i / SD.list.length * 100) + "%";
  if (SD.i >= SD.list.length) { $("sl-area").querySelector(".qcard").innerHTML = `<div class="big">Xong!</div><p>Bạn viết đúng ${SD.right}/${SD.list.length} từ.</p><div class="actions"><button class="btn" onclick="satLearnStart('dict')">Làm lại</button></div>`; return; }
  SD.w = SD.list[SD.i]; SD.done = false;
  $("sd-vi").textContent = SD.w.vi || SD.w.d;
  $("sd-in").value = ""; $("sd-in").disabled = false; $("sd-fb").innerHTML = ""; $("sd-go").textContent = "Kiểm tra";
  $("sd-in").focus(); speak(SD.w.w, .9);
}
function satDictCheck() {
  if (SD.done) { SD.i++; satDictNext(); return; }
  const v = $("sd-in").value; if (!v.trim()) return;
  SD.done = true; $("sd-in").disabled = true;
  const x = SD.w, ok = accepts(v, [x.w, x.core]);
  if (ok) { SD.right++; markRight(x.core); } else markWrong(x.core);
  const exBtn = x.ex ? ` <button class="speak" id="sd-ex">🔊 Câu ví dụ</button>` : "";
  $("sd-fb").innerHTML = `<div class="fb ${ok ? "ok" : "no"}">${ok ? "Chính xác" : `Bạn viết “${esc(v)}”. Đúng là`}: <b>${esc(x.w)}</b> – <span style="color:var(--text)">${esc(x.vi || x.d)}</span>${x.ex ? `<div class="ex" style="margin-top:6px;color:var(--text)">${esc(x.ex)}</div>` : ""}${exBtn}</div>`;
  if ($("sd-ex")) $("sd-ex").onclick = () => speak(x.ex, .9);
  $("sd-go").textContent = "Từ tiếp theo"; $("sd-go").focus();
}

/* match game */
function stopSatMatch() { if (SMG && SMG.timer) clearInterval(SMG.timer); if (SMG) SMG.timer = null; }
function satMatch(pool) {
  if (pool.length < 3) { $("sl-area").innerHTML = `<div class="err">Cần ít nhất 3 từ để chơi ghép cặp.</div>`; return; }
  const viCount = pool.filter(x => x.vi).length;
  let mode = (SMG && SMG.mode) || (viCount >= 3 ? "vi" : "def"); if (mode === "vi" && viCount < 3) mode = "def";
  SMG = { mode, pool };
  $("sl-area").innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div class="row"><span class="hint">Ghép từ với</span><div class="chips" style="margin:0" id="smg-mode">
        <button class="chip ${mode === "vi" ? "on" : ""}" data-m="vi" ${viCount < 3 ? "disabled" : ""}>Nghĩa tiếng Việt</button><button class="chip ${mode === "def" ? "on" : ""}" data-m="def">Định nghĩa</button></div></div>
      <div class="bigtime" id="smg-time">0.0</div></div>
    <div class="hint" id="smg-best" style="margin-bottom:10px"></div><div id="smg-board"></div>`;
  $("smg-mode").onclick = e => { const b = e.target.closest(".chip"); if (!b || b.disabled) return; stopSatMatch(); SMG.mode = b.dataset.m; satMatch(pool); };
  satMatchRound();
}
function satMatchRound() {
  stopSatMatch();
  const src = SMG.mode === "vi" ? SMG.pool.filter(x => x.vi) : SMG.pool;
  const ws = []; for (const x of shuffle(src)) { if (ws.length >= 6) break; if (ws.every(y => norm(y.d) !== norm(x.d))) ws.push(x); }
  const text = x => SMG.mode === "vi" ? x.vi : x.d;
  const tiles = shuffle(ws.flatMap(x => [{ k: x.core, t: x.w, en: true }, { k: x.core, t: text(x), en: false }]));
  const key = `sat-best-${SMG.mode}-${ws.length}`, best = store.get(key, null);
  $("smg-best").textContent = best ? `Kỷ lục của bạn (${ws.length} cặp): ${best.toFixed(1)} giây` : `Ghép ${ws.length} cặp nhanh nhất có thể. Chọn sai bị cộng 1 giây.`;
  $("smg-board").innerHTML = `<div class="tiles ${SMG.mode === "def" ? "wide" : ""}">${tiles.map((t, i) => `<button class="tile ${t.en ? "en" : ""}" data-i="${i}">${esc(t.t)}</button>`).join("")}</div>`;
  let sel = null, left = ws.length, penalty = 0; const t0 = Date.now();
  SMG.timer = setInterval(() => { $("smg-time").textContent = ((Date.now() - t0) / 1000 + penalty).toFixed(1); }, 100);
  $("smg-board").onclick = e => {
    const b = e.target.closest(".tile"); if (!b || b.classList.contains("gone")) return;
    const t = tiles[b.dataset.i];
    if (!sel) { sel = b; b.classList.add("sel"); return; }
    if (sel === b) { b.classList.remove("sel"); sel = null; return; }
    const a = tiles[sel.dataset.i];
    if (a.k === t.k && a.en !== t.en) { sel.classList.add("gone"); b.classList.add("gone"); sel = null; left--;
      if (!left) { stopSatMatch(); const tt = (Date.now() - t0) / 1000 + penalty; $("smg-time").textContent = tt.toFixed(1);
        const nb = !best || tt < best; if (nb) store.set(key, tt);
        $("smg-board").innerHTML = `<div class="qcard"><div class="big">${tt.toFixed(1)} giây</div><p>${nb ? "Kỷ lục mới!" : `Kỷ lục vẫn là ${best.toFixed(1)} giây.`}</p><div class="actions"><button class="btn" id="smg-again">Chơi lại</button></div></div>`;
        $("smg-again").onclick = () => satMatch(SMG.pool); } }
    else { penalty += 1; const s = sel; s.classList.remove("sel"); s.classList.add("bad"); b.classList.add("bad"); sel = null; setTimeout(() => { s.classList.remove("bad"); b.classList.remove("bad"); }, 350); }
  };
}

satRefresh();

/* ================= SAT: TIỀN TỐ – HẬU TỐ – GỐC TỪ ================= */
const SAFF_ROOT = Object.fromEntries(SAFF.roots.map(r => [r.id, r]));
const SAFF_PRE = Object.fromEntries(SAFF.prefixes.map(p => [p.id, p]));
const SAFF_SUF = Object.fromEntries(SAFF.suffixes.map(s => [s.id, s]));
const SATWORD = {}; SAT.words.forEach(x => { if (!SATWORD[x.core]) SATWORD[x.core] = x; });
let curSatAff = "roots", SAS = { n: 0, ok: 0 };
const POSNAME = { n: "Danh từ", v: "Động từ", adj: "Tính từ", adv: "Trạng từ" };
function satAffWords() {
  const f = $("sx-list").value;
  if (f === "all") return null;
  return new Set(SAT.words.filter(x => x.list === f).map(x => x.core));
}
const inList = (w, set) => !set || set.has(w);
function satAffixStart(mode) {
  if (mode) curSatAff = mode;
  document.querySelectorAll("#sx-modes .chip").forEach(c => c.classList.toggle("on", c.dataset.mode === curSatAff));
  ({ roots: sxRoots, affixes: sxAffixes, split: sxSplit, pos: sxPos, rootmean: sxRootMean, family: sxFamily })[curSatAff]();
}
$("sx-modes").onclick = e => { const b = e.target.closest(".chip"); if (b) satAffixStart(b.dataset.mode); };
$("sx-list").onchange = () => satAffixStart();
const wv = w => (SATWORD[w] && (SATWORD[w].vi || SATWORD[w].d)) || "";
function sxShell(title, sub, next) {
  SAS = { n: 0, ok: 0 };
  $("sx-area").innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:10px"><div><h3 style="margin:0">${title}</h3><div class="hint">${sub}</div></div><span class="counter" id="sx-score"></span></div><div id="sx-q"></div>`;
  next();
}
const sxScore = () => { $("sx-score").textContent = `Đúng ${SAS.ok}/${SAS.n}`; };
function sxSplitHTML(parts) {
  return parts.map(([a, t]) => `<span class="${t === "p" ? "pre" : t === "s" ? "suf" : "rt"}">${esc(a)}</span>`).join(" | ");
}
function sxExplain(w) {
  const parts = SAFF.splits[w];
  const li = parts.map(([a, t, id]) => {
    if (t === "p") { const p = SAFF_PRE[id]; return `<li><b class="pre">${esc(a)}-</b> tiền tố ${esc(p ? p.id : id)}: ${esc(p ? p.vi : "")}</li>`; }
    if (t === "r") { const r = SAFF_ROOT[id]; return `<li><b class="rt">${esc(a)}</b> gốc ${esc(r.origin)} <i>${esc(r.id)}</i>: ${esc(r.vi)} (${esc(r.en)})</li>`; }
    const s = SAFF_SUF[id]; return `<li><b class="suf">-${esc(a)}</b> hậu tố ${esc(s ? s.id : id)}: ${esc(s ? s.vi : "")}${s ? ` → ${esc(s.pos)}` : ""}</li>`;
  }).join("");
  return `<ul class="wx">${li}</ul><div style="margin-top:4px"><b>${esc(SATWORD[w] ? SATWORD[w].w : w)}</b>: ${esc(wv(w))}</div>`;
}

/* bảng gốc từ */
function sxRoots() {
  const set = satAffWords();
  const rs = SAFF.roots.map(r => ({ ...r, ws: r.words.filter(w => inList(w, set)) })).filter(r => r.ws.length);
  $("sx-area").innerHTML = `<p class="lead">Gốc Latin và Hy Lạp xuất hiện trong list SAT. Biết gốc từ giúp đoán nghĩa của từ lạ ngay trong phòng thi.</p>
    <div class="afflist">${rs.map(r => `<div class="aff"><div><div class="k">${esc(r.forms.join(", "))}</div><div class="e">${esc(r.origin)}</div></div>
      <div><div class="m"><b>${esc(r.vi)}</b> <span class="hint" data-lang="vi">(${esc(r.en)})</span></div><div class="e">${r.ws.slice(0, 8).map(w => `<span title="${esc(wv(w))}">${esc(w)}</span>`).join(", ")}${r.ws.length > 8 ? "…" : ""}</div></div></div>`).join("")}</div>`;
}
/* bảng tiền tố, hậu tố */
function sxAffixes() {
  const set = satAffWords();
  const row = (k, sub, vi, ws) => `<div class="aff"><div><div class="k">${esc(k)}</div><div class="e">${esc(sub)}</div></div><div><div class="m">${esc(vi)}</div><div class="e">${ws.slice(0, 6).map(w => `<span title="${esc(wv(w))}">${esc(w)}</span>`).join(", ")}</div></div></div>`;
  const pre = SAFF.prefixes.map(p => ({ ...p, ws: p.words.filter(w => inList(w, set)) })).filter(p => p.ws.length);
  const suf = SAFF.suffixes.map(s => ({ ...s, ws: s.words.filter(w => inList(w, set)) })).filter(s => s.ws.length);
  $("sx-area").innerHTML = `<div class="chips" id="sx-af" style="margin-bottom:12px"><button class="chip on" data-f="p">Tiền tố (${pre.length})</button><button class="chip" data-f="s">Hậu tố (${suf.length})</button></div><div class="afflist" id="sx-afl"></div>`;
  const draw = f => { $("sx-afl").innerHTML = f === "p" ? pre.map(p => row(p.id, p.origin, p.vi, p.ws)).join("") : suf.map(s => row(s.id, s.pos, s.vi + " → " + s.pos, s.ws)).join(""); };
  $("sx-af").onclick = e => { const b = e.target.closest(".chip"); if (!b) return; $("sx-af").querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c === b)); draw(b.dataset.f); };
  draw("p");
}
/* tách từ */
function sxSplit() {
  const set = satAffWords(); const pool = Object.keys(SAFF.splits).filter(w => inList(w, set) && SAFF.splits[w].length >= 2);
  if (!pool.length) { $("sx-area").innerHTML = `<div class="err">Danh sách này chưa có từ để tách.</div>`; return; }
  const next = () => {
    sxScore();
    const w = pick(pool), parts = SAFF.splits[w], form = parts.map(p => p[0]).join("");
    const correct = parts.map(p => p[0]).join(" | ");
    const cuts = []; let acc = 0; parts.slice(0, -1).forEach(p => { acc += p[0].length; cuts.push(acc); });
    const mk = cs => { const out = []; let last = 0; cs.forEach(c => { out.push(form.slice(last, c)); last = c; }); out.push(form.slice(last)); return out.join(" | "); };
    const opts = new Set([correct]); let g = 0;
    while (opts.size < 4 && g++ < 80) { const cs = cuts.map(c => c + pick([-2, -1, 1, 2, 0])); if (cs.every((c, i) => c > 0 && c < form.length && (i === 0 || c > cs[i - 1]))) opts.add(mk(cs)); }
    const list = shuffle([...opts]);
    $("sx-q").innerHTML = `<div class="qcard"><div class="ask">Cách tách nào đúng?</div><div class="big">${esc(form)}</div><div class="hint">${esc(wv(w))}</div>${optsHTML({ id: "sxq", opts: list })}<div id="sx-fb"></div></div>`;
    $("sx-q").querySelectorAll('input[name="sxq"]').forEach(r => r.onchange = () => {
      const ok = list[r.value] === correct; SAS.n++; if (ok) SAS.ok++; sxScore();
      $("sx-q").querySelectorAll("input").forEach(i => i.disabled = true);
      $("sx-q").querySelectorAll(".opt").forEach((l, j) => { if (list[j] === correct) l.classList.add("right"); else if (+r.value === j) l.classList.add("wrong"); });
      $("sx-fb").innerHTML = `<div class="fb ${ok ? "ok" : "no"}" style="color:var(--text)"><div class="split">${sxSplitHTML(parts)}</div>${sxExplain(w)}</div><div class="actions"><button class="btn sm" id="sx-next">Câu tiếp</button></div>`;
      $("sx-next").onclick = next;
    });
  };
  sxShell("Tách từ", "Chọn cách chia đúng thành tiền tố, gốc từ và hậu tố.", next);
}
/* đoán từ loại */
const SUFRULE = [["ness","-ness"],["ment","-ment"],["ity","-ity"],["ism","-ism"],["ist","-ist"],["itude","-tude"],["tion","-ion"],["sion","-ion"],["ance","-ance/-ence"],["ence","-ance/-ence"],["ancy","-ance/-ence"],["ency","-ance/-ence"],["acy","-acy/-cy"],["ous","-ous"],["ive","-ive"],["able","-able/-ible"],["ible","-able/-ible"],["ful","-ful"],["less","-less"],["ical","-ic/-ical"],["ic","-ic/-ical"],["al","-al"],["ize","-ize"],["ify","-ify"],["ly","-ly"]];
function sxPos() {
  const set = satAffWords(); const pool = Object.keys(SAFF.pos).filter(w => inList(w, set));
  if (!pool.length) { $("sx-area").innerHTML = `<div class="err">Danh sách này chưa có từ phù hợp.</div>`; return; }
  const next = () => {
    sxScore();
    const w = pick(pool), p = SAFF.pos[w], rule = SUFRULE.find(([s]) => w.endsWith(s)), suf = rule ? SAFF_SUF[rule[1]] : null;
    $("sx-q").innerHTML = `<div class="qcard"><div class="ask">Từ này thuộc từ loại nào?</div><div class="big">${esc(SATWORD[w] ? SATWORD[w].w : w)}</div><div class="opts">${Object.entries(POSNAME).map(([k, v]) => `<button class="opt" data-k="${k}" style="justify-content:center;font:600 1rem var(--sans);color:var(--text)">${v}</button>`).join("")}</div><div id="sx-fb"></div></div>`;
    $("sx-q").querySelectorAll(".opt").forEach(b => b.onclick = () => {
      const ok = b.dataset.k === p; SAS.n++; if (ok) SAS.ok++; sxScore();
      $("sx-q").querySelectorAll(".opt").forEach(x => { x.disabled = true; if (x.dataset.k === p) x.classList.add("right"); else if (x === b) x.classList.add("wrong"); });
      const why = rule ? `Đuôi <b class="suf">-${esc(rule[0])}</b> ${suf ? `(${esc(suf.vi)})` : ""} thường tạo ra ${esc(POSNAME[p].toLowerCase())}.` : "";
      $("sx-fb").innerHTML = `<div class="fb ${ok ? "ok" : "no"}" style="color:var(--text)">${why}<div style="margin-top:4px"><b>${esc(SATWORD[w].w)}</b> (${esc(POSNAME[p].toLowerCase())}): ${esc(wv(w))}</div></div><div class="actions"><button class="btn sm" id="sx-next">Câu tiếp</button></div>`;
      $("sx-next").onclick = next;
    });
  };
  sxShell("Đoán từ loại", "Dựa vào hậu tố để đoán từ loại của từ.", next);
}
/* gốc từ → nghĩa */
function sxRootMean() {
  const set = satAffWords();
  const rs = SAFF.roots.map(r => ({ ...r, ws: r.words.filter(w => inList(w, set)) })).filter(r => r.ws.length);
  if (rs.length < 4) { $("sx-area").innerHTML = `<div class="err">Danh sách này có quá ít gốc từ.</div>`; return; }
  const next = () => {
    sxScore();
    const r = pick(rs), hints = shuffle(r.ws).slice(0, 3);
    const dis = shuffle(SAFF.roots.filter(o => o.id !== r.id && o.vi !== r.vi)).slice(0, 3).map(o => o.vi);
    const list = shuffle([r.vi, ...dis]);
    $("sx-q").innerHTML = `<div class="qcard"><div class="ask">Gốc từ này có nghĩa là gì?</div><div class="big">${esc(r.forms.join(" / "))}</div><div class="hint">Gặp trong: ${hints.map(esc).join(", ")}</div>${optsHTML({ id: "sxq", opts: list })}<div id="sx-fb"></div></div>`;
    $("sx-q").querySelectorAll('input[name="sxq"]').forEach(x => x.onchange = () => {
      const ok = list[x.value] === r.vi; SAS.n++; if (ok) SAS.ok++; sxScore();
      $("sx-q").querySelectorAll("input").forEach(i => i.disabled = true);
      $("sx-q").querySelectorAll(".opt").forEach((l, j) => { if (list[j] === r.vi) l.classList.add("right"); else if (+x.value === j) l.classList.add("wrong"); });
      $("sx-fb").innerHTML = `<div class="fb ${ok ? "ok" : "no"}" style="color:var(--text)"><b class="rt">${esc(r.id)}</b> (${esc(r.origin)}) = ${esc(r.vi)} (${esc(r.en)})<ul class="wx">${hints.map(w => `<li><span class="split">${sxSplitHTML(SAFF.splits[w])}</span> – ${esc(wv(w))}</li>`).join("")}</ul></div><div class="actions"><button class="btn sm" id="sx-next">Câu tiếp</button></div>`;
      $("sx-next").onclick = next;
    });
  };
  sxShell("Gốc từ → nghĩa", "Đoán nghĩa của gốc từ, dựa vào những từ chứa nó.", next);
}
/* từ cùng gốc */
function sxFamily() {
  const set = satAffWords();
  const rs = SAFF.roots.map(r => ({ ...r, ws: r.words.filter(w => inList(w, set)) })).filter(r => r.ws.length >= 2);
  const all = Object.keys(SAFF.splits).filter(w => inList(w, set));
  if (!rs.length) { $("sx-area").innerHTML = `<div class="err">Danh sách này chưa có nhóm từ cùng gốc.</div>`; return; }
  const next = () => {
    sxScore();
    const r = pick(rs), [a, b] = shuffle(r.ws);
    const rootsOf = w => SAFF.splits[w].filter(p => p[1] === "r").map(p => p[2]);
    const dis = shuffle(all.filter(w => !rootsOf(w).includes(r.id) && w !== a)).slice(0, 3);
    const list = shuffle([b, ...dis]);
    $("sx-q").innerHTML = `<div class="qcard"><div class="ask">Từ nào có cùng gốc với</div><div class="big">${esc(SATWORD[a].w)}</div><div class="hint">${esc(wv(a))}</div>${optsHTML({ id: "sxq", opts: list.map(w => SATWORD[w].w) })}<div id="sx-fb"></div></div>`;
    $("sx-q").querySelectorAll('input[name="sxq"]').forEach(x => x.onchange = () => {
      const ok = list[x.value] === b; SAS.n++; if (ok) SAS.ok++; sxScore();
      $("sx-q").querySelectorAll("input").forEach(i => i.disabled = true);
      $("sx-q").querySelectorAll(".opt").forEach((l, j) => { if (list[j] === b) l.classList.add("right"); else if (+x.value === j) l.classList.add("wrong"); });
      $("sx-fb").innerHTML = `<div class="fb ${ok ? "ok" : "no"}" style="color:var(--text)">Cả hai đều có gốc <b class="rt">${esc(r.id)}</b> = ${esc(r.vi)}.<ul class="wx"><li><span class="split">${sxSplitHTML(SAFF.splits[a])}</span> – ${esc(wv(a))}</li><li><span class="split">${sxSplitHTML(SAFF.splits[b])}</span> – ${esc(wv(b))}</li></ul></div><div class="actions"><button class="btn sm" id="sx-next">Câu tiếp</button></div>`;
      $("sx-next").onclick = next;
    });
  };
  sxShell("Từ cùng gốc", "Tìm từ có chung gốc với từ đã cho.", next);
}

/* ================= LEARN ================= */
let curLearn = "flash";
$("l-modes").onclick = e => { const b = e.target.closest(".chip"); if (!b) return; stopMatch(); startLearn(b.dataset.mode); };
["l-from","l-to","l-wrong"].forEach(id => $(id).addEventListener("change", () => { stopMatch(); startLearn(curLearn); }));
function learnPool() {
  const a = clampN($("l-from").value, 1), z = clampN($("l-to").value, N);
  if (a > z) return { err: "Số bắt đầu phải nhỏ hơn hoặc bằng số kết thúc." };
  let p = rangeWords(a, z);
  if ($("l-wrong").checked) p = p.filter(w => wrong[w.w] > 0);
  if (!p.length) return { err: "Chưa có từ hay sai trong phạm vi này. Bỏ chọn “Chỉ từ hay sai” để học tất cả." };
  return { pool: p };
}
function startLearn(mode) {
  curLearn = mode;
  document.querySelectorAll("#l-modes .chip").forEach(c => c.classList.toggle("on", c.dataset.mode === mode));
  const { pool, err } = learnPool();
  if (err) { $("l-area").innerHTML = `<div class="err">${err}</div>`; return; }
  ({ flash: flashStart, adapt: adaptStart, dict: dictStart, match: matchStart })[mode](pool);
}

/* --- flashcards --- */
let deck = [], cur = null, learned = 0, deckSize = 0;
function flashStart(pool) {
  deck = shuffle(pool); deckSize = deck.length; learned = 0;
  $("l-area").innerHTML = `
    <div class="cardbar"><span class="counter" id="fc-prog"></span>${hasSpeech ? '<button class="speak" id="fc-say">🔊 Nghe</button>' : ""}</div>
    <div class="card" id="fc"><div class="card-inner" id="fc-in" role="button" tabindex="0" aria-label="Lật thẻ">
      <div class="face"><div class="bigword" id="fc-w"></div><div class="pos" id="fc-pos"></div><div class="tap">Chạm để lật thẻ</div></div>
      <div class="face back" id="fc-back"></div></div></div>
    <div class="actions" id="fc-acts"><button class="btn ghost" id="fc-again">Chưa thuộc</button><button class="btn" id="fc-ok">Đã thuộc</button></div>`;
  const flip = () => $("fc").classList.toggle("flipped");
  $("fc-in").onclick = flip;
  $("fc-in").onkeydown = e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } };
  $("fc-ok").onclick = () => { learned++; markRight(cur.w); markLearned("ielts", cur.w); flashNext(); };
  $("fc-again").onclick = () => { markWrong(cur.w); deck.push(cur); flashNext(); };
  if ($("fc-say")) $("fc-say").onclick = e => { e.stopPropagation(); speak(cur.w); };
  flashNext();
}
function flashNext() {
  $("fc").classList.remove("flipped");
  if (!deck.length) { $("fc-w").textContent = "Xong rồi!"; $("fc-pos").textContent = `Bạn đã thuộc ${deckSize} từ.`; $("fc-back").innerHTML = ""; $("fc-acts").innerHTML = `<button class="btn" onclick="startLearn('flash')">Học lại</button><button class="btn ghost" onclick="startLearn('adapt')">Chuyển sang học thích ứng</button>`; $("fc-prog").textContent = ""; return; }
  cur = deck.shift();
  $("fc-prog").textContent = `Đã thuộc ${learned}/${deckSize}`;
  setTimeout(() => { if (!$("fc-w")) return;
    $("fc-w").textContent = cur.w; $("fc-pos").textContent = cur.pos;
    const fam = (FAMBY[cur.w] || []).filter(f => f.form !== cur.w);
    $("fc-back").innerHTML = `<dl>
      <div data-lang="vi"><dt>Nghĩa tiếng Việt</dt><dd class="vi">${esc(cur.vi)}</dd></div>
      <div><dt>Định nghĩa</dt><dd>${esc(cur.def)}</dd></div>
      ${exampleOf(cur) ? `<div><dt>Ví dụ</dt><dd class="ex">${exampleOf(cur)}</dd></div>` : ""}
      ${cur.syn.length ? `<div><dt>Đồng nghĩa</dt><dd>${esc(cur.syn.join(", "))}</dd></div>` : ""}
      ${cur.ant.length ? `<div><dt>Trái nghĩa</dt><dd>${esc(cur.ant.join(", "))}</dd></div>` : ""}
      ${fam.length ? `<div><dt>Họ từ</dt><dd>${fam.map(f => `${esc(f.form)}${f.pos ? ` <i style="color:var(--muted)">${esc(f.pos)}</i>` : ""}`).join(", ")}</dd></div>` : ""}
      ${cur.note ? `<div><dt>Lưu ý</dt><dd>${esc(cur.note)}</dd></div>` : ""}</dl>`;
  }, 160);
}

/* --- adaptive learn --- */
let AD = null;
function adaptStart(pool) {
  const q = shuffle(pool);
  AD = { total: q.length, queue: q, active: [], lvl: {}, done: 0, last: null };
  adaptFill();
  $("l-area").innerHTML = `<div class="counter" id="ad-prog"></div><div class="pbar"><i id="ad-bar"></i></div><div id="ad-q"></div>`;
  adaptNext();
}
function adaptFill() { while (AD.active.length < 6 && AD.queue.length) { const w = AD.queue.shift(); AD.active.push(w); AD.lvl[w.w] = 0; } }
function adaptNext() {
  $("ad-prog").textContent = `Đã thuộc ${AD.done}/${AD.total} · Đang học ${AD.active.length} từ`;
  $("ad-bar").style.width = (AD.done / AD.total * 100) + "%";
  if (!AD.active.length) { $("ad-q").innerHTML = `<div class="qcard"><div class="big">Hoàn thành!</div><p>Bạn đã thuộc cả ${AD.total} từ trong phạm vi này.</p><div class="actions"><button class="btn" onclick="startLearn('adapt')">Học lại</button><button class="btn ghost" id="ad-test">Làm bài kiểm tra ngay</button></div></div>`; $("ad-test").onclick = () => { refreshSetup(); show("test"); }; return; }
  let cands = AD.active.filter(w => w !== AD.last); if (!cands.length) cands = AD.active;
  const w = pick(cands); AD.last = w;
  const L = AD.lvl[w.w];
  let html, check, answerText;
  if (L === 0) {
    const dir = Math.random() < .5;
    const opts = dir ? shuffle([w.vi, ...viDistractors(w)]) : shuffle([w.w, ...enDistractors(w)]);
    const right = dir ? w.vi : w.w;
    html = `<div class="ask">${dir ? "Chọn nghĩa tiếng Việt" : "Chọn từ tiếng Anh"}</div><div class="${dir ? "big" : "mid"}">${esc(dir ? w.w : w.vi)}</div>${optsHTML({ id: "adq", opts })}`;
    check = () => { const s = document.querySelector('input[name="adq"]:checked'); return s ? opts[s.value] === right : null; };
    answerText = right;
  } else if (L === 1) {
    const opts = shuffle([w.w, ...enDistractors(w)]);
    html = `<div class="ask">Định nghĩa này là của từ nào?</div><div class="mid">${esc(w.def)}</div>${optsHTML({ id: "adq", opts })}`;
    check = () => { const s = document.querySelector('input[name="adq"]:checked'); return s ? opts[s.value] === w.w : null; };
    answerText = w.w;
  } else {
    html = `<div class="ask">Gõ từ tiếng Anh</div><div class="mid"><b>${esc(w.vi)}</b> <span class="hint">(${esc(w.pos)}, ${w.w.length} chữ cái)</span></div><div class="typed"><input type="text" id="adq-t" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn sm" id="adq-go">Kiểm tra</button></div>`;
    check = () => { const v = $("adq-t").value; return v.trim() ? norm(v) === w.w : null; };
    answerText = w.w;
  }
  $("ad-q").innerHTML = `<div class="qcard">${html}<div id="ad-fb"></div></div>`;
  const submit = () => {
    const ok = check(); if (ok === null) return;
    $("ad-q").querySelectorAll("input").forEach(i => i.disabled = true);
    if ($("adq-go")) $("adq-go").disabled = true;
    if (ok) { AD.lvl[w.w]++; markRight(w.w); } else { AD.lvl[w.w] = 0; markWrong(w.w); }
    let mastered = false;
    if (AD.lvl[w.w] >= 3) { AD.active = AD.active.filter(x => x !== w); AD.done++; adaptFill(); mastered = true; markLearned("ielts", w.w); }
    $("ad-fb").innerHTML = ok ? `<div class="fb ok">Đúng rồi${mastered ? `. Bạn đã thuộc <b>${esc(w.w)}</b>!` : "!"}</div>`
      : `<div class="fb no">Chưa đúng. Đáp án: <b>${esc(answerText)}</b> (${esc(w.w)}: ${esc(w.vi)})</div><div class="actions"><button class="btn sm" id="ad-next">Tiếp tục</button></div>`;
    const run = AD; if (ok) setTimeout(() => { if (AD === run && $("ad-q")) adaptNext(); }, mastered ? 1100 : 700); else { $("ad-next").onclick = adaptNext; $("ad-next").focus(); }
  };
  $("ad-q").querySelectorAll('input[name="adq"]').forEach(r => r.addEventListener("change", submit));
  if ($("adq-t")) { $("adq-t").focus(); $("adq-go").onclick = submit; $("adq-t").onkeydown = e => { if (e.key === "Enter") submit(); }; }
}

/* --- dictation --- */
let DC = null;
function dictStart(pool) {
  if (!hasSpeech) { $("l-area").innerHTML = `<div class="notice">Trình duyệt này không hỗ trợ phát âm, nên chưa dùng được chế độ nghe chép. Hãy thử Chrome hoặc Safari.</div>`; return; }
  DC = { list: shuffle(pool), i: 0, right: 0 };
  $("l-area").innerHTML = `<div class="counter" id="dc-prog"></div><div class="pbar"><i id="dc-bar"></i></div>
    <div class="qcard"><div class="ask">Nghe và gõ lại từ</div>
    <div class="actions" style="margin:0 0 10px"><button class="btn sm" id="dc-say">🔊 Nghe</button><button class="btn sm ghost" id="dc-slow">🐢 Nghe chậm</button>
    <label class="hint" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="dc-hint"> Hiện nghĩa tiếng Việt</label></div>
    <div id="dc-vi" class="mid hidden"></div>
    <div class="typed"><input type="text" id="dc-in" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Gõ từ bạn nghe được"><button class="btn sm" id="dc-go">Kiểm tra</button></div>
    <div id="dc-fb"></div></div>`;
  $("dc-say").onclick = () => speak(DC.w.w, .9);
  $("dc-slow").onclick = () => speak(DC.w.w, .5);
  $("dc-hint").onchange = () => $("dc-vi").classList.toggle("hidden", !$("dc-hint").checked);
  $("dc-go").onclick = dictCheck;
  $("dc-in").onkeydown = e => { if (e.key === "Enter") dictCheck(); };
  dictNext();
}
function dictNext() {
  $("dc-prog").textContent = `Câu ${Math.min(DC.i + 1, DC.list.length)}/${DC.list.length} · Đúng ${DC.right}`;
  $("dc-bar").style.width = (DC.i / DC.list.length * 100) + "%";
  if (DC.i >= DC.list.length) { $("l-area").querySelector(".qcard").innerHTML = `<div class="big">Xong!</div><p>Bạn viết đúng ${DC.right}/${DC.list.length} từ.</p><div class="actions"><button class="btn" onclick="startLearn('dict')">Làm lại</button></div>`; return; }
  DC.w = DC.list[DC.i]; DC.done = false;
  $("dc-vi").textContent = `${DC.w.vi} (${DC.w.pos})`;
  $("dc-in").value = ""; $("dc-in").disabled = false; $("dc-fb").innerHTML = ""; $("dc-go").textContent = "Kiểm tra";
  $("dc-in").focus(); speak(DC.w.w, .9);
}
function dictCheck() {
  if (DC.done) { DC.i++; dictNext(); return; }
  const v = $("dc-in").value; if (!v.trim()) return;
  DC.done = true; $("dc-in").disabled = true;
  const ok = norm(v) === DC.w.w;
  if (ok) { DC.right++; markRight(DC.w.w); } else markWrong(DC.w.w);
  $("dc-fb").innerHTML = ok ? `<div class="fb ok">Chính xác: <b>${esc(DC.w.w)}</b> – ${esc(DC.w.vi)}</div>` : `<div class="fb no">Bạn viết “${esc(v)}”. Đúng là <b>${esc(DC.w.w)}</b> – ${esc(DC.w.vi)}</div>`;
  $("dc-go").textContent = "Từ tiếp theo"; $("dc-go").focus();
}

/* --- match game --- */
let MG = null;
function stopMatch() { if (MG && MG.timer) clearInterval(MG.timer); if (MG) MG.timer = null; if (typeof stopSatMatch === "function") stopSatMatch(); }
function matchStart(pool) {
  if (pool.length < 3) { $("l-area").innerHTML = `<div class="err">Cần ít nhất 3 từ để chơi ghép cặp.</div>`; return; }
  const mode = (MG && MG.mode) || "vi";
  MG = { mode, pool };
  $("l-area").innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div class="row"><span class="hint">Ghép từ với</span><div class="chips" style="margin:0" id="mg-mode">
        <button class="chip ${mode === "vi" ? "on" : ""}" data-m="vi">Nghĩa tiếng Việt</button><button class="chip ${mode === "def" ? "on" : ""}" data-m="def">Định nghĩa</button><button class="chip ${mode === "syn" ? "on" : ""}" data-m="syn">Đồng nghĩa</button></div></div>
      <div class="bigtime" id="mg-time">0.0</div></div>
    <div class="hint" id="mg-best" style="margin-bottom:10px"></div>
    <div id="mg-board"></div>`;
  $("mg-mode").onclick = e => { const b = e.target.closest(".chip"); if (!b) return; stopMatch(); MG.mode = b.dataset.m; matchStart(pool); };
  matchRound();
}
function matchRound() {
  stopMatch();
  let ws = [];
  const src = MG.mode === "syn" ? MG.pool.filter(w => w.syn.length) : MG.pool;
  if (src.length < 3) { $("mg-board").innerHTML = `<div class="err">Phạm vi này có quá ít từ có từ đồng nghĩa. Hãy chọn kiểu ghép khác.</div>`; return; }
  for (const w of shuffle(src)) { if (ws.length >= 6) break; if (MG.mode !== "syn" || ws.every(x => compatible("msyn", x, w))) ws.push(w); }
  const text = w => MG.mode === "vi" ? w.vi : MG.mode === "def" ? w.def : synShow(w).join(", ");
  const tiles = shuffle(ws.flatMap(w => [{ k: w.w, t: w.w, en: true }, { k: w.w, t: text(w), en: false }]));
  const key = `tv2-best-${MG.mode}-${ws.length}`;
  const best = store.get(key, null);
  $("mg-best").textContent = best ? `Kỷ lục của bạn (${ws.length} cặp): ${best.toFixed(1)} giây` : `Ghép ${ws.length} cặp nhanh nhất có thể. Chọn sai bị cộng 1 giây.`;
  $("mg-board").innerHTML = `<div class="tiles ${MG.mode === "def" ? "wide" : ""}">${tiles.map((t, i) => `<button class="tile ${t.en ? "en" : ""}" data-i="${i}">${esc(t.t)}</button>`).join("")}</div>`;
  let sel = null, left = ws.length, penalty = 0;
  const t0 = Date.now();
  MG.timer = setInterval(() => { $("mg-time").textContent = ((Date.now() - t0) / 1000 + penalty).toFixed(1); }, 100);
  $("mg-board").onclick = e => {
    const b = e.target.closest(".tile"); if (!b || b.classList.contains("gone")) return;
    const t = tiles[b.dataset.i];
    if (!sel) { sel = b; b.classList.add("sel"); return; }
    if (sel === b) { b.classList.remove("sel"); sel = null; return; }
    const a = tiles[sel.dataset.i];
    if (a.k === t.k && a.en !== t.en) { sel.classList.add("gone"); b.classList.add("gone"); sel = null; left--;
      if (!left) { stopMatch(); const tt = (Date.now() - t0) / 1000 + penalty; $("mg-time").textContent = tt.toFixed(1);
        const nb = !best || tt < best; if (nb) store.set(key, tt);
        $("mg-board").innerHTML = `<div class="qcard"><div class="big">${tt.toFixed(1)} giây</div><p>${nb ? "Kỷ lục mới!" : `Kỷ lục vẫn là ${best.toFixed(1)} giây.`}</p><div class="actions"><button class="btn" id="mg-again">Chơi lại</button></div></div>`;
        $("mg-again").onclick = () => matchStart(MG.pool); } }
    else { penalty += 1; const s = sel; s.classList.remove("sel"); s.classList.add("bad"); b.classList.add("bad"); sel = null; setTimeout(() => { s.classList.remove("bad"); b.classList.remove("bad"); }, 350); }
  };
}

/* ================= AFFIX ================= */
let curAffix = "table";
$("a-modes").onclick = e => { const b = e.target.closest(".chip"); if (!b) return; startAffix(b.dataset.mode); };
["a-from","a-to"].forEach(id => $(id).addEventListener("change", () => startAffix(curAffix)));
const AFFROWS = D.affixes.map(a => ({ ...a, keys: a.a.split(" / ").map(x => x.trim()) }));
const affFor = tok => AFFROWS.find(r => r.keys.includes(tok));
function derived() {
  const a = clampN($("a-from").value, 1), z = clampN($("a-to").value, N);
  const roots = new Set(rangeWords(a, Math.max(a, z)).map(w => w.w));
  return D.fam.filter(f => roots.has(f.root) && f.split.includes("|"));
}
function startAffix(mode) {
  curAffix = mode;
  document.querySelectorAll("#a-modes .chip").forEach(c => c.classList.toggle("on", c.dataset.mode === mode));
  ({ table: affTable, split: affSplit, pos: affPos, family: affFamily })[mode]();
}
function affTable() {
  const draw = f => { $("af-list").innerHTML = AFFROWS.filter(r => f === "all" || r.type === f).map(r => `<div class="aff"><div class="k">${esc(r.a)}</div><div><div class="m">${esc(r.mean)} · <b>${esc(r.pos)}</b></div><div class="e">Ví dụ: ${esc(r.ex)}${r.note ? ". " + esc(r.note) : ""}</div></div></div>`).join(""); };
  $("a-area").innerHTML = `<p class="lead">Nắm được phụ tố, học sinh đoán được nghĩa và từ loại của từ mới, và đổi dạng từ chính xác hơn.</p>
    <div class="chips" id="af-f" style="margin-bottom:12px"><button class="chip on" data-f="all">Tất cả</button><button class="chip" data-f="Tiền tố">Tiền tố</button><button class="chip" data-f="Hậu tố">Hậu tố</button></div><div class="afflist" id="af-list"></div>`;
  $("af-f").onclick = e => { const b = e.target.closest(".chip"); if (!b) return; $("af-f").querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c === b)); draw(b.dataset.f); };
  draw("all");
}
function splitHTML(f) {
  const parts = f.split.split(" | ");
  const pre = f.pre ? f.pre.replace("-", "") : null;
  return parts.map((p, i) => { const cls = i === 0 && pre && p === pre ? "pre" : (i > 0 && (i === parts.length - 1 || (f.suf && f.suf.split(", ").length > 1 && i >= parts.length - f.suf.split(", ").length))) ? "suf" : ""; return `<span class="${cls}">${esc(p)}</span>`; }).join(" | ");
}
function explain(f) {
  const out = [];
  if (f.pre) { const r = affFor(f.pre); out.push(`<b>${esc(f.pre)}</b>: ${esc(r ? r.mean : "")}`); }
  if (f.suf) f.suf.split(", ").forEach(s => { const r = affFor(s); out.push(`<b>${esc(s)}</b>: ${esc(r ? r.mean + " → " + r.pos.toLowerCase() : "")}`); });
  return out.join("<br>");
}
let AFS = { n: 0, ok: 0 };
function affShell(title, sub, next) {
  AFS = { n: 0, ok: 0 };
  $("a-area").innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:10px"><div><h3 style="margin:0">${title}</h3><div class="hint">${sub}</div></div><span class="counter" id="af-score"></span></div><div id="af-q"></div>`;
  next();
}
const affScore = () => { $("af-score").textContent = `Đúng ${AFS.ok}/${AFS.n}`; };
function affSplit() {
  const pool = derived();
  if (!pool.length) { $("a-area").innerHTML = `<div class="err">Phạm vi này chưa có từ phái sinh.</div>`; return; }
  const next = () => {
    affScore();
    const f = pick(pool), form = f.form;
    const parts = f.split.split(" | "); const cuts = []; let acc = 0; parts.slice(0, -1).forEach(p => { acc += p.length; cuts.push(acc); });
    const mk = cs => { let out = [], last = 0; cs.forEach(c => { out.push(form.slice(last, c)); last = c; }); out.push(form.slice(last)); return out.join(" | "); };
    const opts = new Set([f.split]); let guard = 0;
    while (opts.size < 4 && guard++ < 60) { const cs = cuts.map(c => c + pick([-2, -1, 1, 2, 0])); if (cs.every((c, i) => c > 0 && c < form.length && (i === 0 || c > cs[i - 1]))) opts.add(mk(cs)); }
    const list = shuffle([...opts]);
    $("af-q").innerHTML = `<div class="qcard"><div class="ask">Cách tách nào đúng?</div><div class="big">${esc(form)}</div><div class="hint">${esc(f.pos)} · ${esc(f.vi)}</div>${optsHTML({ id: "afq", opts: list })}<div id="af-fb"></div></div>`;
    $("af-q").querySelectorAll('input[name="afq"]').forEach(r => r.onchange = () => {
      const ok = list[r.value] === f.split; AFS.n++; if (ok) AFS.ok++; affScore();
      $("af-q").querySelectorAll("input").forEach(i => i.disabled = true);
      $("af-q").querySelectorAll(".opt").forEach((l, j) => { if (list[j] === f.split) l.classList.add("right"); else if (+r.value === j) l.classList.add("wrong"); });
      $("af-fb").innerHTML = `<div class="fb ${ok ? "ok" : "no"}"><div class="split">${splitHTML(f)}</div><div style="margin-top:6px;color:var(--text)">Từ gốc: <b>${esc(f.root)}</b><br>${explain(f)}</div></div><div class="actions"><button class="btn sm" id="af-next">Câu tiếp</button></div>`;
      $("af-next").onclick = next;
    });
  };
  affShell("Tách từ", "Chọn cách chia đúng thành tiền tố, phần gốc và hậu tố.", next);
}
function affPos() {
  const pool = derived().filter(f => !f.pos.includes(","));
  if (!pool.length) { $("a-area").innerHTML = `<div class="err">Phạm vi này chưa có từ phái sinh.</div>`; return; }
  const POS = [["n.","Danh từ"],["v.","Động từ"],["adj.","Tính từ"],["adv.","Trạng từ"]];
  const next = () => {
    affScore();
    const f = pick(pool);
    $("af-q").innerHTML = `<div class="qcard"><div class="ask">Từ này thuộc từ loại nào?</div><div class="big">${esc(f.form)}</div><div class="opts">${POS.map(([k, v]) => `<button class="opt" data-k="${k}" style="justify-content:center;font:600 1rem var(--sans);color:var(--text)">${v}</button>`).join("")}</div><div id="af-fb"></div></div>`;
    $("af-q").querySelectorAll(".opt").forEach(b => b.onclick = () => {
      const ok = b.dataset.k === f.pos; AFS.n++; if (ok) AFS.ok++; affScore();
      $("af-q").querySelectorAll(".opt").forEach(x => { x.disabled = true; if (x.dataset.k === f.pos) x.classList.add("right"); else if (x === b) x.classList.add("wrong"); });
      const lastSuf = f.suf ? f.suf.split(", ").pop() : null;
      const why = lastSuf ? `Hậu tố <b>${esc(lastSuf)}</b> thường tạo ra ${esc((affFor(lastSuf) || {}).pos || "").toLowerCase()}.` : `Tiền tố <b>${esc(f.pre)}</b> không đổi từ loại, nên ${esc(f.form)} cùng từ loại với ${esc(f.split.split(" | ").slice(1).join(""))}.`;
      $("af-fb").innerHTML = `<div class="fb ${ok ? "ok" : "no"}"><div class="split">${splitHTML(f)}</div><div style="margin-top:6px;color:var(--text)">${why} Nghĩa: ${esc(f.vi)}.</div></div><div class="actions"><button class="btn sm" id="af-next">Câu tiếp</button></div>`;
      $("af-next").onclick = next;
    });
  };
  affShell("Đoán từ loại", "Dựa vào hậu tố để đoán từ loại.", next);
}
function affFamily() {
  const a = clampN($("a-from").value, 1), z = clampN($("a-to").value, N);
  const roots = rangeWords(a, Math.max(a, z)).filter(w => (FAMBY[w.w] || []).length >= 3);
  if (!roots.length) { $("a-area").innerHTML = `<div class="err">Phạm vi này chưa có họ từ đủ lớn.</div>`; return; }
  let order = shuffle(roots), idx = 0;
  const next = () => {
    affScore();
    const w = order[idx++ % order.length];
    const fam = FAMBY[w.w].filter(f => f.form !== w.w);
    $("af-q").innerHTML = `<div class="qcard"><div class="ask">Điền các dạng từ trong họ của</div><div class="big">${esc(w.w)} <span class="hint" style="font-family:var(--sans);font-weight:400">${esc(w.pos)} · ${esc(w.vi)}</span></div>
      <table class="fam">${fam.map((f, i) => `<tr><td>${esc(f.pos)}</td><td><div class="hint">${esc(f.vi)}</div><input type="text" id="fm-${i}" autocomplete="off" autocapitalize="off" spellcheck="false"><span class="res" id="fr-${i}"></span></td></tr>`).join("")}</table>
      <div class="actions"><button class="btn sm" id="fm-go">Kiểm tra</button></div><div id="af-fb"></div></div>`;
    $("fm-go").onclick = () => {
      let c = 0;
      fam.forEach((f, i) => { const ok = norm($(`fm-${i}`).value) === f.form; if (ok) c++; $(`fm-${i}`).disabled = true; $(`fr-${i}`).innerHTML = ok ? `<span class="mark ok">✓</span>` : `<span class="mark">✗</span><span class="fix">${esc(f.form)}</span>`; });
      AFS.n += fam.length; AFS.ok += c; affScore();
      $("fm-go").textContent = "Từ tiếp theo"; $("fm-go").onclick = next;
    };
  };
  affShell("Bảng họ từ", "Cho từ gốc, viết các dạng danh từ, tính từ, trạng từ... Đây là nền tảng cho bài đổi dạng từ.", next);
}
/* ================= MODAL ================= */
let modalDone = null;
function openModal(html) { $("m-box").innerHTML = html; $("modal").classList.remove("hidden"); const f = $("m-box").querySelector("input,button"); if (f) f.focus(); }
function closeModal(v) { $("modal").classList.add("hidden"); $("m-box").innerHTML = ""; const d = modalDone; modalDone = null; if (d) d(v); }
$("modal").addEventListener("click", e => { if (e.target === $("modal")) closeModal(false); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("modal").classList.contains("hidden")) closeModal(false); });
function ask({ title, text, ok = "Đồng ý", cancel = "Huỷ" }) {
  return new Promise(res => {
    openModal(`<h3 id="m-title">${esc(title)}</h3><p>${esc(text)}</p><div class="actions"><button class="btn ghost" id="m-no">${esc(cancel)}</button><button class="btn" id="m-ok">${esc(ok)}</button></div>`);
    modalDone = res; $("m-ok").onclick = () => closeModal(true); $("m-no").onclick = () => closeModal(false); $("m-ok").focus();
  });
}
const LEAVE = { title: "Thoát bài đang làm?", text: "Bài kiểm tra đang làm sẽ bị huỷ và không được chấm.", ok: "Thoát", cancel: "Ở lại làm tiếp" };

/* ================= GUIDE ================= */
const TRAP_EX = {
  T1: "Đoạn văn nói giá rau tăng gấp ba vì thiếu hàng, nên đáp án là <i>scarce</i>. Chọn <i>plentiful</i> là T1.",
  T2: "\"During the <u>lean</u> years after the factory closed\": <i>lean</i> ở đây là \"thiếu thốn\". Chọn <i>thin</i> (gầy) là T2.",
  T3: "Từ có thật, đặt vào câu vẫn đúng ngữ pháp, nhưng đoạn văn không có chi tiết nào ủng hộ.",
  T4: "Bức tường cổ \"has begun to ___\", từng mảng đá rơi xuống: đáp án là <i>crumble</i>. Chọn <i>collapse</i> (sụp hẳn) là quá mạnh.",
  T5: "Nhân viên bị dọa mất việc nếu từ chối, nên đáp án là <i>coerced</i>. Chọn <i>invited</i> thì đúng chiều nhưng quá nhẹ.",
  T6: "\"Fallen trees were ___ rescue efforts\": cây đổ không thể <i>documenting</i> hay <i>funding</i> được gì.",
  T7: "Khách sạn được khách khen và quay lại nhiều lần, nên đáp án là <i>reputation</i>. Chọn <i>complaint</i> là sai sắc thái.",
  T8: "Đoạn văn nói về cấu trúc nguyên tử của thủy tinh. Chọn <i>transparent</i> hay <i>fragile</i> vì liên tưởng đến thủy tinh là T8.",
};
function guideOpen(g) {
  document.querySelectorAll("#g-chips .chip").forEach(c => c.classList.toggle("on", c.dataset.g === g));
  document.querySelectorAll("#v-guide .gsec").forEach(s => s.classList.toggle("hidden", s.dataset.g !== g));
}
const TRAP_EX_EN = {"T1": "The text says vegetable prices tripled because of a shortage, so the answer is <i>scarce</i>. Choosing <i>plentiful</i> is T1.", "T2": "\"During the <u>lean</u> years after the factory closed\": here <i>lean</i> means \"scarce\". Choosing <i>thin</i> is T2.", "T3": "A real word that even fits the grammar, but nothing in the text supports it.", "T4": "An old wall \"has begun to ___\", with pieces of stone falling off: the answer is <i>crumble</i>. Choosing <i>collapse</i> is too strong.", "T5": "Workers were warned they would lose their jobs if they refused, so the answer is <i>coerced</i>. <i>Invited</i> points the right way but is far too mild.", "T6": "\"Fallen trees were ___ rescue efforts\": fallen trees cannot be <i>documenting</i> or <i>funding</i> anything.", "T7": "Guests praise the hotel and keep coming back, so the answer is <i>reputation</i>. Choosing <i>complaint</i> has the wrong tone.", "T8": "The text is about the atomic structure of glass. Choosing <i>transparent</i> or <i>fragile</i> because they remind you of glass is T8."};
$("g-traps").innerHTML = TRAPS.map(([k, v]) => `<div class="trap"><div class="code">${k}</div><div><b>${esc(v)}</b><div class="ex" data-lang="vi" data-noi18n>Ví dụ: ${TRAP_EX[k]}</div><div class="ex" data-lang="en">Example: ${TRAP_EX_EN[k]}</div></div></div>`).join("");
function guideFor() {
  document.querySelectorAll("#g-chips .chip").forEach(c => c.classList.toggle("hidden", !!c.dataset.set && c.dataset.set !== SET));
  $("g-title").textContent = SET === "sat" ? "Hướng dẫn học SAT" : "Hướng dẫn học IELTS";
  guideOpen(SET === "sat" ? "wic" : "ielts");
}
$("g-chips").onclick = e => { const b = e.target.closest(".chip"); if (b) guideOpen(b.dataset.g); };

/* ================= HELLO STRIP ================= */
function renderHello() {
  const nm = (AUTH.user && (AUTH.user.displayName || (AUTH.user.email || "").split("@")[0])) || ($("t-name") ? $("t-name").value.trim() : "") || "";
  const cores = SET === "sat" ? new Set(SAT.words.map(x => x.core)) : new Set(D.words.map(x => x.w));
  const nWrong = Object.entries(wrong).filter(([k, v]) => v > 0 && cores.has(k)).length;
  document.querySelectorAll("[data-hello]").forEach(el => el.textContent = nm ? `Chào ${nm}!` : "Chào bạn!");
  document.querySelectorAll("[data-stat]").forEach(el => el.innerHTML = `<span>Từ hay sai: <b>${nWrong}</b></span><span>${AUTH.user ? "Tiến độ đồng bộ theo tài khoản" : "Tiến độ lưu trên thiết bị này"}</span>`);
}

/* ================= TÀI KHOẢN ================= */
// Khi chuyển trang sang hosting riêng: tạo dự án Firebase, bật Authentication (Email/Password và Google),
// bật Firestore, rồi dán cấu hình web của dự án vào đây, ví dụ:
// const FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", projectId: "...", appId: "..." };
const FIREBASE_CONFIG = null;
const AUTH = { mode: "local", user: null, fb: null };
const loadScript = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
async function authInit() {
  renderAcct();
  if (!FIREBASE_CONFIG) return;
  try {
    const base = "https://www.gstatic.com/firebasejs/10.12.2/";
    await loadScript(base + "firebase-app-compat.js");
    await loadScript(base + "firebase-auth-compat.js");
    await loadScript(base + "firebase-firestore-compat.js");
    firebase.initializeApp(FIREBASE_CONFIG);
    AUTH.fb = { auth: firebase.auth(), db: firebase.firestore() }; AUTH.mode = "cloud";
    AUTH.fb.auth.languageCode = "vi";
    AUTH.fb.auth.onAuthStateChanged(async u => { AUTH.user = u; if (u && u.displayName && !$("t-name").value) $("t-name").value = u.displayName; renderAcct(); renderHello(); if (u) await syncDown(); });
  } catch (e) { console.error("Không tải được Firebase", e); AUTH.mode = "local"; renderAcct(); }
}
let syncTimer = null;
function scheduleSync() { if (!AUTH.user || !AUTH.fb) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncUp, 1500); }
async function syncUp() {
  if (!AUTH.user || !AUTH.fb) return;
  try { await AUTH.fb.db.collection("users").doc(AUTH.user.uid).set({ wrong, updatedAt: Date.now() }, { merge: true }); } catch (e) { console.error(e); }
}
async function syncDown() {
  try {
    const snap = await AUTH.fb.db.collection("users").doc(AUTH.user.uid).get();
    const remote = (snap.exists && snap.data().wrong) || {};
    for (const [k, v] of Object.entries(remote)) wrong[k] = Math.max(wrong[k] || 0, v);
    const rl = (snap.exists && snap.data().learned) || {};
    if (typeof LEARNED !== "undefined") { for (const [k, e] of Object.entries(rl)) if (!LEARNED[k] || (e.due || 0) > (LEARNED[k].due || 0)) LEARNED[k] = e; store.set("tv2-learned", LEARNED); if (Object.keys(rl).length) AUTH.fb.db.collection("users").doc(AUTH.user.uid).set({ learned: LEARNED }, { merge: true }).catch(() => {}); }
    store.set("tv2-wrong", wrong); await syncUp(); renderHello();
  } catch (e) { console.error(e); }
}
const AUTH_ERR = {
  "auth/email-already-in-use": "Email này đã được dùng để đăng ký. Hãy đăng nhập hoặc đặt lại mật khẩu.",
  "auth/invalid-email": "Email chưa đúng định dạng.",
  "auth/weak-password": "Mật khẩu cần ít nhất 6 ký tự.",
  "auth/user-not-found": "Email hoặc mật khẩu không đúng.",
  "auth/wrong-password": "Email hoặc mật khẩu không đúng.",
  "auth/invalid-credential": "Email hoặc mật khẩu không đúng.",
  "auth/too-many-requests": "Bạn thử quá nhiều lần. Hãy đợi vài phút rồi thử lại.",
  "auth/network-request-failed": "Không có kết nối mạng.",
  "auth/popup-closed-by-user": "Bạn đã đóng cửa sổ đăng nhập Google.",
};
const authMsg = e => AUTH_ERR[e && e.code] || "Có lỗi xảy ra. Hãy thử lại.";
function renderAcct() {
  const u = AUTH.user;
  if (u) {
    const nm = u.displayName || (u.email || "").split("@")[0];
    $("acct-name").textContent = nm;
    $("acct-ava").textContent = (nm[0] || "?").toUpperCase();
  } else {
    $("acct-name").textContent = "Đăng nhập";
    $("acct-ava").innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6Z"/></svg>`;
  }
}
const LOCAL_NOTE = `<div class="infonote">Bản trên Claude chưa kết nối máy chủ tài khoản. Đăng ký, đăng nhập Google và email đặt lại mật khẩu sẽ hoạt động khi trang được đưa lên hosting riêng. Hiện tiến độ được lưu trên thiết bị này.</div>`;
const GICON = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
function openAcct(tab = "in") {
  if (AUTH.user) {
    const u = AUTH.user, via = (u.providerData[0] || {}).providerId === "google.com" ? "Google" : "email và mật khẩu";
    openModal(`<h3 id="m-title">Tài khoản</h3><p><b style="color:var(--ink)">${esc(u.displayName || "")}</b><br>${esc(u.email || "")}<br><span class="hint">Đăng nhập bằng ${via}. Tiến độ học được đồng bộ giữa các thiết bị.</span></p>
      <div class="actions"><button class="btn ghost" id="a-out">Đăng xuất</button><button class="btn" id="a-close">Đóng</button></div>`);
    $("a-close").onclick = () => closeModal();
    $("a-out").onclick = async () => { await AUTH.fb.auth.signOut(); closeModal(); };
    return;
  }
  const local = AUTH.mode === "local";
  const forms = {
    in: `<div class="af"><input type="email" id="a-email" placeholder="Email" autocomplete="email"><input type="password" id="a-pass" placeholder="Mật khẩu" autocomplete="current-password">
         <button class="btn" id="a-go">Đăng nhập</button><div style="text-align:right"><button class="linkbtn" id="a-forgot">Quên mật khẩu?</button></div></div>`,
    up: `<div class="af"><input type="text" id="a-name" placeholder="Họ và tên" autocomplete="name"><input type="email" id="a-email" placeholder="Email" autocomplete="email">
         <input type="password" id="a-pass" placeholder="Mật khẩu (ít nhất 6 ký tự)" autocomplete="new-password"><input type="password" id="a-pass2" placeholder="Nhập lại mật khẩu" autocomplete="new-password">
         <button class="btn" id="a-go">Tạo tài khoản</button></div>`,
    reset: `<div class="af"><p style="margin:0">Nhập email đã dùng khi đăng ký. Chúng tôi sẽ gửi đường dẫn để đặt lại mật khẩu.</p><input type="email" id="a-email" placeholder="Email" autocomplete="email">
         <button class="btn" id="a-go">Gửi email đặt lại mật khẩu</button><div><button class="linkbtn" id="a-back">← Quay lại đăng nhập</button></div></div>`,
  };
  openModal(`<h3 id="m-title">${tab === "reset" ? "Đặt lại mật khẩu" : "Tài khoản học sinh"}</h3>${local ? LOCAL_NOTE : ""}
    ${tab === "reset" ? "" : `<div class="authtabs"><button data-t="in" class="${tab === "in" ? "on" : ""}">Đăng nhập</button><button data-t="up" class="${tab === "up" ? "on" : ""}">Đăng ký</button></div>
    <button class="gbtn" id="a-google">${GICON}Tiếp tục với Google</button><div class="or">hoặc dùng email</div>`}
    ${forms[tab]}<div class="amsg" id="a-msg" role="status"></div>
    <div class="actions" style="margin-top:6px"><button class="btn ghost sm" id="a-cancel">Đóng</button></div>`);
  const msg = (t, ok) => { $("a-msg").textContent = t; $("a-msg").className = "amsg " + (ok ? "ok" : "err"); };
  $("a-cancel").onclick = () => closeModal();
  $("m-box").querySelectorAll(".authtabs button").forEach(b => b.onclick = () => openAcct(b.dataset.t));
  if ($("a-forgot")) $("a-forgot").onclick = () => openAcct("reset");
  if ($("a-back")) $("a-back").onclick = () => openAcct("in");
  const needCloud = () => { if (local) { msg("Chức năng này sẽ hoạt động khi trang được đưa lên hosting riêng."); return true; } return false; };
  if ($("a-google")) $("a-google").onclick = async () => {
    if (needCloud()) return;
    const p = new firebase.auth.GoogleAuthProvider();
    try { await AUTH.fb.auth.signInWithPopup(p); closeModal(); }
    catch (e) { if (e.code === "auth/popup-blocked") await AUTH.fb.auth.signInWithRedirect(p); else msg(authMsg(e)); }
  };
  const go = async () => {
    const email = $("a-email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg("Hãy nhập email hợp lệ."); return; }
    if (tab === "reset") {
      if (needCloud()) return;
      try { await AUTH.fb.auth.sendPasswordResetEmail(email); } catch (e) { if (!["auth/user-not-found"].includes(e.code)) { msg(authMsg(e)); return; } }
      msg("Nếu email này đã đăng ký, bạn sẽ nhận được thư đặt lại mật khẩu trong vài phút. Hãy kiểm tra cả hộp thư rác.", true); return;
    }
    const pass = $("a-pass").value;
    if (tab === "up") {
      const name = $("a-name").value.trim();
      if (!name) { msg("Hãy nhập họ và tên."); return; }
      if (pass.length < 6) { msg("Mật khẩu cần ít nhất 6 ký tự."); return; }
      if (pass !== $("a-pass2").value) { msg("Hai mật khẩu chưa khớp nhau."); return; }
      if (needCloud()) return;
      try { const c = await AUTH.fb.auth.createUserWithEmailAndPassword(email, pass); await c.user.updateProfile({ displayName: name }); AUTH.user = c.user; renderAcct(); renderHello(); try { await c.user.sendEmailVerification(); } catch (e) {} closeModal(); }
      catch (e) { msg(authMsg(e)); }
      return;
    }
    if (!pass) { msg("Hãy nhập mật khẩu."); return; }
    if (needCloud()) return;
    try { await AUTH.fb.auth.signInWithEmailAndPassword(email, pass); closeModal(); } catch (e) { msg(authMsg(e)); }
  };
  $("a-go").onclick = go;
  $("m-box").querySelectorAll(".af input").forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter") go(); }));
}
$("acct-btn").onclick = () => openAcct("in");

renderHello();
authInit();
$("t-name").addEventListener("input", renderHello);
/* ================= NGÔN NGỮ (VI / EN) ================= */
const I18N_RULES = [["^Đáp án cho (.+)$", "Answer for $1"], ["^Gặp trong: (.+)$", "Found in: $1"], ["^Bạn viết “(.*)”\\. Đúng là:?$", "You wrote “$1”. The correct answer is"], ["^Chủ đề: (.+)$", "Topic: $1"], ["^Chào (.+)!$", "Hi $1!"], ["^Danh sách hay gặp · từ (\\d+)–(\\d+) · (.+)$", "High-frequency list · words $1–$2 · $3"], ["^Danh sách Barron's · từ (\\d+)–(\\d+) · (.+)$", "Barron's list · words $1–$2 · $3"], ["^Từ (\\d+)–(\\d+) · (.+)$", "Words $1–$2 · $3"], ["^Từ (\\d+)–hết · (\\d+) phần · (\\d+) câu$", "Words $1–end · $2 parts · $3 questions"], ["^Từ (\\d+)–(\\d+) · (\\d+) phần · (\\d+) câu$", "Words $1–$2 · $3 parts · $4 questions"], ["^Ví dụ: (.+)$", "Example: $1"], ["^(.*)\\. Chưa có trong (\\d+) từ đầu$", "$1. Not yet in the first $2 words"], ["^(.*)\\. Chưa có nhiều trong (\\d+) từ đầu$", "$1. Few in the first $2 words"], ["^Ghép (\\d+) cặp$", "Match $1 pairs"], ["^\\((.+)\\) thường tạo ra danh từ\\.$", "($1) usually makes a noun."], ["^thường tạo ra danh từ\\. Nghĩa: (.+)$", "usually makes a noun. Meaning: $1"], ["^\\((.+)\\) thường tạo ra động từ\\.$", "($1) usually makes a verb."], ["^thường tạo ra động từ\\. Nghĩa: (.+)$", "usually makes a verb. Meaning: $1"], ["^\\((.+)\\) thường tạo ra tính từ\\.$", "($1) usually makes an adjective."], ["^thường tạo ra tính từ\\. Nghĩa: (.+)$", "usually makes an adjective. Meaning: $1"], ["^\\((.+)\\) thường tạo ra trạng từ\\.$", "($1) usually makes an adverb."], ["^thường tạo ra trạng từ\\. Nghĩa: (.+)$", "usually makes an adverb. Meaning: $1"], ["^(.*)\\. im- trước b/m/p, il- trước l, ir- trước r$", "$1. im- before b/m/p, il- before l, ir- before r"], ["^Bạn đã học (\\d+) từ (IELTS|SAT)\\.$", "You have learned $1 $2 words."], ["^Đáp án ([A-D])\\. (.+)$", "Answer $1. $2"], ["^· Manh mối: (.+)$", "· Clue: $1"], ["^Manh mối: (.+)$", "Clue: $1"], ["^(T\\d) · (.+)$", "$1 · $2"], ["^tiền tố (.+?): (.+)$", "prefix $1: $2"], ["^hậu tố (.+?): (.+) → (.+)$", "suffix $1: $2 → $3"], ["^gốc (Latin|Hy Lạp|Latin/Hy Lạp)$", "$1 root"], ["^: (.+) \\(([A-Za-z ,;/]+)\\)$", ": $2"], ["^\\((.+?)\\) = (.+) \\(([A-Za-z ,;/]+)\\)$", "($1) = $3"], ["^= (.+)\\.$", "= $1."], ["^(.+) \\(([a-z]+\\.?(?:, [a-z]+\\.)?), (\\d+) chữ cái\\)$", "$1 ($2, $3 letters)"], ["^Chọn chữ cái đúng từ khung (A–[A-Z])\\. Có nhiều lựa chọn hơn số chỗ trống\\.$", "Choose the correct letter from the box $1. There are more options than blanks."]].map(([p, r]) => [new RegExp(p), r]);
const VNRE = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;
const NUMRE = /\d+(?:[.,]\d+)?/g;
const ASCII_VI = new Set(["🔊 Nghe", "Xong!", "Kinh doanh", "Song song", "Flashcard"]);
/* ---- nghĩa tiếng Việt → định nghĩa tiếng Anh (dùng khi giao diện tiếng Anh) ---- */
const MEAN = new Map(), WDEF = new Map();
function addMean(vi, en) { if (vi && en && !MEAN.has(vi)) MEAN.set(vi, en); }
D.words.forEach(w => addMean(w.vi, w.def));
Object.entries(VI5).forEach(([w, v]) => addMean(v, (BYW[w] || {}).def));
SAT.words.forEach(x => addMean(x.vi, x.d));
SAFF.roots.forEach(r => addMean(r.vi, r.en));
Object.entries(EXTRA_EN).forEach(([k, v]) => addMean(k, v));
D.words.forEach(w => WDEF.set(w.w.toLowerCase(), w.def));
SAT.words.forEach(x => { WDEF.set(x.w.toLowerCase(), x.d); WDEF.set(x.core, x.d); });
let MEANKEYS = null;
function trMean(t) {
  if (MEAN.has(t)) return MEAN.get(t);
  let m;
  if ((m = t.match(/^(.+?): (.+)$/)) && WDEF.has(m[1].toLowerCase()) && VNRE.test(m[2])) return m[1] + ": " + WDEF.get(m[1].toLowerCase());
  if ((m = t.match(/^\((.+)\)$/)) && MEAN.has(m[1])) return "(" + MEAN.get(m[1]) + ")";
  if ((m = t.match(/^([–·:=]\s*)(.+?)(\.?)$/)) && MEAN.has(m[2])) return m[1] + MEAN.get(m[2]) + m[3];
  if ((m = t.match(/^(\S+\.(?:, \S+\.)?) · (.+)$/)) && MEAN.has(m[2])) return m[1] + " · " + MEAN.get(m[2]);
  if (!MEANKEYS) MEANKEYS = [...MEAN.keys()].filter(k => k.length >= 4).sort((a, b) => b.length - a.length);
  let out = t, hit = false;
  for (const k of MEANKEYS) { if (out.includes(k)) { out = out.split(k).join(MEAN.get(k)); hit = true; if (!VNRE.test(out)) break; } }
  return hit && !VNRE.test(out) ? out : null;
}
let LANG = store.get("tv2-lang", "vi");
function trCore(t) {
  const flat = t.replace(/\s+/g, " ");
  const v = I18N_DICT[flat.replace(NUMRE, "{n}")];
  if (v != null) { const nums = flat.match(NUMRE) || []; let i = 0; return v.replace(/\{n\}/g, () => nums[i++] ?? ""); }
  for (const [re, rep] of I18N_RULES) { const m = flat.match(re); if (m) return rep.replace(/\$(\d)/g, (_, k) => { const g = m[k] || ""; return VNRE.test(g) ? tr(g) : g; }); }
  return null;
}
function tr(text) {
  const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/), core = m[2];
  if (!VNRE.test(core)) { const v = I18N_DICT[core.replace(/\s+/g, " ").replace(NUMRE, "{n}")]; if (v == null || !ASCII_VI.has(core.replace(/\s+/g, " ").replace(NUMRE, "{n}"))) return text; }
  let r = trCore(core);
  if (r == null) {
    const parts = core.split(/(?<=[.!?])\s+(?=\p{Lu})/u);
    if (parts.length > 1) { let changed = false; const out = parts.map(p => { if (!VNRE.test(p)) return p; const x = trCore(p); if (x != null) { changed = true; return x; } return p; }); if (changed) r = out.join(" "); }
  }
  if (r == null || VNRE.test(r)) { const x = trMean(r == null ? core : r); if (x != null) r = x; }
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
  document.title = "StillHere Words – IELTS & SAT";
  $("lang-vi").classList.toggle("on", l === "vi"); $("lang-en").classList.toggle("on", l === "en");
  $("lang-vi").setAttribute("aria-pressed", l === "vi"); $("lang-en").setAttribute("aria-pressed", l === "en");
  trTree(document.body);
  try { ddSync(); } catch (e) {}
}
$("lang-vi").onclick = () => setLang("vi");
$("lang-en").onclick = () => setLang("en");
i18nObs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
setLang(LANG);
var CUR_TAB = "home";
/* ================= v4: DROPDOWN, TRANG CHỦ, TỪ ĐÃ HỌC, TÊN HỌC SINH ================= */

function ddClose() { document.querySelectorAll(".dd.open").forEach(d => { d.classList.remove("open"); d.querySelector(".ddbtn").setAttribute("aria-expanded", "false"); }); }
document.querySelectorAll(".dd").forEach(dd => {
  const b = dd.querySelector(".ddbtn");
  b.addEventListener("click", e => { e.stopPropagation(); const op = !dd.classList.contains("open"); ddClose(); if (op) { dd.classList.add("open"); b.setAttribute("aria-expanded", "true"); } });
  dd.querySelector(".ddmenu").addEventListener("click", () => setTimeout(ddClose, 0));
});
document.addEventListener("click", e => { if (!e.target.closest(".dd")) ddClose(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") ddClose(); });
function ddSync() {
  $("dd-set-label").textContent = SET === "sat" ? "SAT" : "IELTS";
  const img = (LANG === "en" ? $("lang-en") : $("lang-vi")).querySelector("img").cloneNode(true);
  $("dd-lang-label").innerHTML = ""; $("dd-lang-label").appendChild(img);
  $("dd-lang-label").insertAdjacentText("beforeend", LANG === "en" ? " EN" : " VI");
  $("dd-lang-label").style.display = "flex"; $("dd-lang-label").style.alignItems = "center"; $("dd-lang-label").style.gap = "6px";
}

/* ---- tên học sinh: lấy từ tài khoản ---- */
const profile = store.get("tv2-profile", {});
function studentName() { return (AUTH.user && (AUTH.user.displayName || (AUTH.user.email || "").split("@")[0])) || profile.name || ""; }
function syncName() {
  $("t-name").value = studentName();
  const nm = studentName();
  if (nm) { $("acct-name").textContent = nm; $("acct-ava").textContent = nm[0].toUpperCase(); $("acct-ava").classList.remove("hidden"); }
  else { $("acct-name").textContent = "Đăng nhập"; $("acct-ava").classList.add("hidden"); }
  renderHello();
}
renderAcct = function () { syncName(); };
$("t-name").closest(".field").classList.add("hidden");

/* ---- từ đã học + lịch ôn ---- */
const DAY = 864e5, INTERVALS = [1, 3, 7, 14, 30, 60];
let LEARNED = store.get("tv2-learned", {});
const saveLearned = () => { store.set("tv2-learned", LEARNED); if (AUTH.user && AUTH.fb) { clearTimeout(syncTimer); syncTimer = setTimeout(async () => { try { await AUTH.fb.db.collection("users").doc(AUTH.user.uid).set({ learned: LEARNED }, { merge: true }); } catch (e) {} }, 1500); } };
function markLearned(set, w) {
  const k = (set === "sat" ? "s:" : "i:") + w;
  if (LEARNED[k]) return;
  LEARNED[k] = { s: set, w, at: Date.now(), lvl: 0, due: Date.now() + DAY };
  saveLearned(); renderHello();
}
function wordInfo(e) {
  if (e.s === "sat") { const x = SATWORD[e.w]; return x ? { w: x.w, vi: x.vi || x.d, d: x.d, ex: x.ex } : { w: e.w, vi: "", d: "" }; }
  const x = D.words.find(y => y.w === e.w); return x ? { w: x.w, vi: x.vi, d: x.def || "", ex: "" } : { w: e.w, vi: "", d: "" };
}
const learnedOf = set => Object.entries(LEARNED).filter(([, e]) => e.s === set);
const dueOf = set => learnedOf(set).filter(([, e]) => e.due <= Date.now());
function dueLabel(e) {
  const d = Math.ceil((e.due - Date.now()) / DAY);
  if (d <= 0) return ["Đến hạn hôm nay", true];
  if (d === 1) return ["Ôn vào ngày mai", false];
  return [`Ôn sau ${d} ngày`, false];
}
function renderLearned(q = "") {
  const all = learnedOf(SET), due = dueOf(SET), strong = all.filter(([, e]) => e.lvl >= 3);
  $("lw-kpis").innerHTML = `<div class="kpi"><b>${all.length}</b><span>Từ đã học</span></div><div class="kpi"><b>${due.length}</b><span>Đến hạn ôn</span></div><div class="kpi"><b>${strong.length}</b><span>Đã nhớ vững</span></div>`;
  $("lw-due").textContent = `Ôn từ đến hạn (${due.length})`; $("lw-due").disabled = !due.length; $("lw-all").disabled = !all.length;
  if (!all.length) {
    $("lw-area").innerHTML = `<div class="qcard" style="text-align:center"><p style="margin:0 0 12px">Chưa có từ nào trong danh sách ${SET === "sat" ? "SAT" : "IELTS"}. Vào Học từ, bấm “Đã thuộc” ở Flashcard hoặc học thuộc một nhóm từ ở chế độ Học thích ứng.</p><button class="btn" id="lw-go">Đi tới Học từ</button></div>`;
    $("lw-go").onclick = () => document.querySelector('.tabs [data-tab="learn"]').click(); return;
  }
  const rows = all.sort((a, b) => a[1].due - b[1].due).filter(([, e]) => { if (!q) return true; const i = wordInfo(e); return (i.w + " " + i.vi).toLowerCase().includes(q.toLowerCase()); });
  $("lw-area").innerHTML = `<input class="lwsearch" id="lw-q" type="search" placeholder="Tìm từ đã học" value="${esc(q)}"><div class="lwlist">${rows.map(([k, e]) => { const i = wordInfo(e), [lab, now] = dueLabel(e);
    return `<div class="lwrow"><div class="w">${esc(i.w)}<span class="dots" title="Mức nhớ">${[0, 1, 2, 3, 4].map(n => `<i class="${e.lvl > n ? "on" : ""}"></i>`).join("")}</span></div><div class="m">${esc(i.vi)}</div><span class="due ${now ? "now" : ""}">${lab}</span><button class="x" data-k="${esc(k)}" aria-label="Bỏ khỏi danh sách" title="Bỏ khỏi danh sách">×</button></div>`; }).join("") || `<div class="lwrow"><div class="m">Không tìm thấy từ nào.</div></div>`}</div>`;
  const qi = $("lw-q"); qi.oninput = () => { const v = qi.value, pos = qi.selectionStart; renderLearned(v); const n = $("lw-q"); n.focus(); n.setSelectionRange(pos, pos); };
  $("lw-area").querySelectorAll(".x").forEach(b => b.onclick = async () => {
    if (!(await ask({ title: "Bỏ từ này khỏi danh sách?", text: "Từ sẽ không còn trong danh sách đã học và lịch ôn tập. Bạn có thể học lại để thêm vào sau.", ok: "Bỏ khỏi danh sách", cancel: "Giữ lại" }))) return;
    delete LEARNED[b.dataset.k]; saveLearned(); renderLearned($("lw-q") ? $("lw-q").value : "");
  });
}
let RV = null;
function startReview(onlyDue) {
  const list = shuffle(onlyDue ? dueOf(SET) : learnedOf(SET));
  if (!list.length) return;
  const mode = $("lw-mode").value;
  if (mode === "listen" && !hasSpeech) { $("lw-area").innerHTML = `<div class="notice">Trình duyệt này không hỗ trợ phát âm, nên chưa dùng được chế độ nghe chép. Hãy thử Chrome hoặc Safari.</div>`; return; }
  RV = { list, i: 0, ok: 0, mode };
  rvNext();
}
function rvNext() {
  const r = RV;
  if (r.i >= r.list.length) {
    $("lw-area").innerHTML = `<div class="qcard" style="text-align:center"><div class="big">Ôn xong!</div><p>Bạn nhớ đúng ${r.ok}/${r.list.length} từ. Các từ nhớ đúng được dời lịch ôn ra xa hơn; từ nhớ sai sẽ quay lại vào ngày mai.</p><div class="actions" style="justify-content:center"><button class="btn" id="rv-back">Xem danh sách</button></div></div>`;
    $("rv-back").onclick = () => renderLearned(); renderHello(); return;
  }
  const [k, e] = r.list[r.i], info = wordInfo(e);
  const pool = learnedOf(SET).concat(Object.keys(SET === "sat" ? SATWORD : {}).slice(0, 0)).map(([, x]) => wordInfo(x)).filter(x => x.w !== info.w && x.vi);
  const extra = SET === "sat" ? shuffle(Object.values(SATWORD).filter(x => x.vi && x.w !== info.w)).slice(0, 6).map(x => ({ w: x.w, vi: x.vi })) : shuffle(D.words.filter(x => x.vi && x.w !== info.w)).slice(0, 6).map(x => ({ w: x.w, vi: x.vi }));
  const dis = shuffle(pool.concat(extra)).filter((x, i, a) => a.findIndex(y => y.vi === x.vi) === i && x.vi !== info.vi).slice(0, 3);
  let body;
  if (r.mode === "mcq") { const opts = shuffle([info.vi, ...dis.map(x => x.vi)]); r.opts = opts; body = `<div class="ask">Chọn nghĩa đúng</div><div class="big">${esc(info.w)}</div>${optsHTML({ id: "rvq", opts })}`; }
  else body = `<div class="ask">${r.mode === "listen" ? "Nghe và gõ lại từ" : "Gõ từ tiếng Anh"}</div>${r.mode === "listen" ? `<div class="actions" style="margin:0 0 10px"><button class="btn sm" id="rv-say">🔊 Nghe</button></div>` : `<div class="mid"><b>${esc(info.vi || info.d)}</b></div>`}<div class="typed"><input type="text" id="rv-in" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn sm" id="rv-go">Kiểm tra</button></div>`;
  $("lw-area").innerHTML = `<div class="counter">Từ ${r.i + 1}/${r.list.length} · Đúng ${r.ok}</div><div class="pbar"><i style="width:${r.i / r.list.length * 100}%"></i></div><div class="qcard">${body}<div id="rv-fb"></div></div>`;
  const finish = ok => {
    $("lw-area").querySelectorAll("input,#rv-go").forEach(x => x.disabled = true);
    if (ok) { r.ok++; e.lvl = Math.min(e.lvl + 1, INTERVALS.length - 1); e.due = Date.now() + INTERVALS[e.lvl] * DAY; markRight(e.w); }
    else { e.lvl = 0; e.due = Date.now() + DAY; markWrong(e.w); }
    LEARNED[k] = e; saveLearned();
    $("rv-fb").innerHTML = `<div class="fb ${ok ? "ok" : "no"}">${ok ? "Đúng rồi!" : "Chưa đúng."} <b>${esc(info.w)}</b>: <span style="color:var(--text)">${esc(info.vi || info.d)}</span>${info.ex ? `<div class="ex" style="margin-top:6px;color:var(--text)">${esc(info.ex)}</div>` : ""}</div><div class="actions"><button class="btn sm" id="rv-next">Từ tiếp theo</button></div>`;
    $("rv-next").onclick = () => { r.i++; rvNext(); }; $("rv-next").focus();
  };
  if (r.mode === "mcq") $("lw-area").querySelectorAll('input[name="rvq"]').forEach(x => x.onchange = () => {
    const ok = r.opts[x.value] === info.vi;
    $("lw-area").querySelectorAll(".opt").forEach((l, j) => { if (r.opts[j] === info.vi) l.classList.add("right"); else if (+x.value === j) l.classList.add("wrong"); });
    finish(ok);
  });
  else {
    const go = () => { const v = $("rv-in").value; if (!v.trim()) return; finish(accepts(v, [info.w, e.w])); };
    $("rv-go").onclick = go; $("rv-in").onkeydown = ev => { if (ev.key === "Enter") go(); }; $("rv-in").focus();
    if ($("rv-say")) { $("rv-say").onclick = () => speak(info.w, .9); speak(info.w, .9); }
  }
}
$("lw-due").onclick = () => startReview(true);
$("lw-all").onclick = () => startReview(false);

/* ---- trang chủ ---- */
function renderHome() {
  const due = dueOf(SET).length, all = learnedOf(SET).length;
  $("h-review").innerHTML = all ? `<div class="revcard"><div>Bạn đã học <b>${all}</b> từ ${SET === "sat" ? "SAT" : "IELTS"}. <b>${due}</b> từ đến hạn ôn hôm nay.</div><button class="btn ${due ? "" : "ghost"}" id="h-rev">${due ? "Ôn tập ngay" : "Xem từ đã học"}</button></div>` : "";
  if ($("h-rev")) $("h-rev").onclick = () => { document.querySelector('.tabs [data-tab="learned"]').click(); if (due) setTimeout(() => startReview(true), 0); };
}
$("h-learn").onclick = () => document.querySelector('.tabs [data-tab="learn"]').click();
$("h-test").onclick = () => document.querySelector('.tabs [data-tab="test"]').click();
$("cta-start").onclick = () => document.querySelector('.tabs [data-tab="learn"]').click();
$("logo-home").onclick = async () => { if (running && !(await ask(LEAVE))) return; stopTimer(); running = false; stopMatch(); show("home"); renderHome(); };

/* ---- lời chào: thêm số từ đã học ---- */
const _renderHello = renderHello;
renderHello = function () {
  _renderHello();
  const nm = studentName();
  document.querySelectorAll("[data-hello]").forEach(el => el.textContent = nm ? `Chào ${nm}!` : "Chào bạn!");
  const l = learnedOf(SET).length, d = dueOf(SET).length;
  document.querySelectorAll("[data-stat]").forEach(el => el.insertAdjacentHTML("afterbegin", `<span>Đã học: <b>${l}</b></span><span>Đến hạn ôn: <b>${d}</b></span>`));
};

const _openAcct = openAcct;
openAcct = function (tab = "in") {
  _openAcct(tab);
  const note = $("m-box").querySelector(".infonote");
  if (!note || AUTH.user) return;
  note.insertAdjacentHTML("afterend", `<div class="af" style="margin-bottom:14px"><label class="lbl" for="a-local-name" style="margin:0">Trong lúc chờ có máy chủ tài khoản, bạn có thể nhập tên để hiển thị trên kết quả bài làm.</label><div style="display:flex;gap:8px"><input type="text" id="a-local-name" placeholder="Tên của bạn" value="${esc(profile.name || "")}"><button class="btn ghost sm" id="a-local-save" style="flex:none">Lưu tên</button></div></div>`);
  $("a-local-save").onclick = () => { profile.name = $("a-local-name").value.trim(); store.set("tv2-profile", profile); syncName(); $("a-local-save").textContent = "Đã lưu"; };
};

/* ---- BẮT BUỘC ĐĂNG NHẬP ----
   Yêu cầu của giáo viên: học sinh chỉ xem được nội dung sau khi đăng nhập.
   Cờ này chỉ có tác dụng khi trang đã có máy chủ tài khoản (FIREBASE_CONFIG khác null).
   Bản chạy trên Claude chưa có máy chủ nên vẫn mở tự do để xem thử. */
const REQUIRE_LOGIN = true;
const isGated = () => REQUIRE_LOGIN && AUTH.mode === "cloud" && !AUTH.user;
function applyGate() {
  const g = isGated();
  document.body.classList.toggle("gated", g);
  if (g) { stopTimer(); running = false; stopMatch(); show("home"); }
  renderHome();
}
const _show = show;
show = function (tab) { if (isGated() && tab !== "home") { openAcct("in"); tab = "home"; } _show(tab); };
["h-learn", "h-test", "cta-start"].forEach(id => $(id).addEventListener("click", e => { if (isGated()) { e.stopImmediatePropagation(); openAcct("in"); } }, true));
const _renderAcct2 = renderAcct;
renderAcct = function () { _renderAcct2(); try { applyGate(); } catch (e) {} };
applyGate();

$("foot-about").onclick = async () => { if (running && !(await ask(LEAVE))) return; stopTimer(); running = false; stopMatch(); show("home"); renderHome(); setTimeout(() => $("about").scrollIntoView({ behavior: "smooth", block: "start" }), 50); };
show("home"); renderHome(); syncName(); ddSync();
