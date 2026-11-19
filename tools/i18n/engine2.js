/* ---- nghĩa tiếng Việt → định nghĩa tiếng Anh (dùng khi giao diện tiếng Anh) ---- */
const EXTRA_EN = __EXTRA__;
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
