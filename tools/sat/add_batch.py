"""Thêm một đợt câu hỏi SAT mới vào dữ liệu.

Cách dùng:
    python add_batch.py batch1.py [batch2.py ...] [--ref thu_muc_de_mau]

Mỗi file batch là một file Python định nghĩa danh sách Q, mỗi phần tử có dạng:
    dict(w="core", vi="nghĩa tiếng Việt", ex="câu ví dụ",
         stem="... ______ ..."   # hoặc dùng [[word]] cho câu most nearly mean
         opts=[("đáp án đúng","OK","lý do"), ("lựa chọn","T1","lý do"), ...],  # đúng 4, phần tử đầu là đáp án
         clue="Diễn giải lại", key="câu chứa manh mối")

Script sẽ:
  1. Kiểm tra định dạng (đúng 4 lựa chọn, 1 đáp án, mã bẫy hợp lệ, đúng 1 chỗ trống, từ mục tiêu có trong list).
  2. Kiểm tra không trùng chuỗi 7 từ với các câu đã có (và với đề mẫu trong thư mục --ref nếu có).
  3. Trộn vị trí đáp án sao cho A/B/C/D chia đều.
  4. Cập nhật sat.json và satq.json trong cùng thư mục.
Sau đó chạy inject_sat.py để nạp vào trang.
"""
import json, random, re, html, glob, importlib.util, sys, os
from collections import Counter
args = sys.argv[1:]; ref = None
if "--ref" in args:
    i = args.index("--ref"); ref = args[i + 1]; args = args[:i] + args[i + 2:]
NEW = []
for path in args:
    spec = importlib.util.spec_from_file_location(os.path.basename(path)[:-3], path)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); NEW += m.Q
d = json.load(open("sat.json", encoding="utf-8")); old = json.load(open("satq.json", encoding="utf-8"))
cores = {x["core"] for x in d["words"]}; done = {q["w"] for q in old}
codes = {"OK", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"}
for q in NEW:
    assert q["w"] in cores, ("Không có trong list", q["w"])
    assert q["w"] not in done, ("Đã làm rồi", q["w"])
    assert len(q["opts"]) == 4 and q["opts"][0][1] == "OK" and sum(o[1] == "OK" for o in q["opts"]) == 1, q["w"]
    assert all(o[1] in codes for o in q["opts"]) and len({o[0].lower() for o in q["opts"]}) == 4, q["w"]
    if "[[" not in q["stem"]:
        assert q["stem"].count("______") == 1, ("Cần đúng 1 chỗ trống ______", q["w"])
norm = lambda t: re.findall(r"[a-z']+", t.lower())
src = " ".join(q["stem"] for q in old)
if ref:
    src += " ".join(open(f, encoding="utf-8", errors="ignore").read() for f in glob.glob(os.path.join(ref, "*.txt")))
sw = norm(src); grams = set(tuple(sw[i:i + 7]) for i in range(len(sw) - 6))
bad = [q["w"] for q in NEW if any(tuple(w[i:i + 7]) in grams for w in [norm(q["stem"].replace("[[", "").replace("]]", ""))] for i in range(len(w) - 6))]
assert not bad, ("Trùng chuỗi 7 từ", bad)
TR = {"T1": "Ngược chiều", "T2": "Nghĩa thông dụng", "T3": "Không hợp ngữ cảnh", "T4": "Quá mạnh", "T5": "Quá yếu, thiếu chính xác", "T6": "Sai chủ thể", "T7": "Sai sắc thái", "T8": "Bẫy liên tưởng"}
e = html.escape; by = {q["w"]: q for q in NEW}
for x in d["words"]:
    q = by.get(x["core"])
    if q: x["vi"] = q["vi"]; x["ex"] = q["ex"]
start = sum(1 for w in d["wic"] if w["src"] == "claude"); rng = random.Random(1000 + start)
targets = [(start + i) % 4 for i in range(len(NEW))]; rng.shuffle(targets); L = "ABCD"
for q, t in zip(NEW, targets):
    correct = q["opts"][0]; others = q["opts"][1:]; rng.shuffle(others); arr = others[:t] + [correct] + others[t:]
    lis = "".join(f'<li><b>{L[i]}. {e(o[0])}</b> – ' + ('<span class="tg ok">Đúng</span> ' if o[1] == "OK" else f'<span class="tg">{o[1]} · {TR[o[1]]}</span> ') + f'<span data-lang="vi" data-noi18n>{e(o[2])}</span>' + "</li>" for i, o in enumerate(arr))
    quotes = re.findall(r'"([^"]+)"', q["key"])
    en = f'<div class="hint" data-lang="en">Clue in the text: {" … ".join(e(chr(34) + x + chr(34)) for x in quotes)}</div>' if quotes else ""
    ex = f'<div><b>Đáp án {L[t]}. {e(correct[0])}</b> · Manh mối: {e(q["clue"])}</div><div class="hint" data-lang="vi" data-noi18n>{e(q["key"])}</div>{en}<ul class="wx">{lis}</ul>'
    d["wic"].append(dict(src="claude", stem=q["stem"].replace("______", "____"), opts=[o[0] for o in arr], ans=t, root=q["w"], expl=ex, mnm="[[" in q["stem"]))
json.dump(d, open("sat.json", "w", encoding="utf-8"), ensure_ascii=False)
json.dump(old + NEW, open("satq.json", "w", encoding="utf-8"), ensure_ascii=False)
cl = [w for w in d["wic"] if w["src"] == "claude"]
print("Đã thêm", len(NEW), "| Tổng câu mới", len(cl), "| Phân bố đáp án", dict(Counter(L[w["ans"]] for w in cl)))
print("Từ gốc đã có nội dung:", len({x["core"] for x in d["words"] if x.get("vi")}), "/", len(cores))
