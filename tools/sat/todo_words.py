"""In ra các từ SAT chưa có nghĩa tiếng Việt / câu Words in Context (theo thứ tự list).

Cách dùng: python todo_words.py [bb|br] [số lượng]
"""
import json, sys
lst = sys.argv[1] if len(sys.argv) > 1 else "br"; n = int(sys.argv[2]) if len(sys.argv) > 2 else 100
d = json.load(open("sat.json", encoding="utf-8"))
done = {x["core"] for x in d["words"] if x.get("vi")}; seen = set(); out = []
for x in d["words"]:
    if x["list"] != lst or x["core"] in done or x["core"] in seen: continue
    seen.add(x["core"]); out.append(x)
print(f"Còn {len(out)} từ chưa làm trong list {lst}")
for x in out[:n]: print(x["n"], x["w"], "|", x["core"], "|", x["d"])
