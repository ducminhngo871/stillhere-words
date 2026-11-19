"""Nạp dữ liệu SAT (data/sat/sat.json) vào ứng dụng.

Cách dùng:
    python tools/sat/inject_sat.py data/sat/sat.json app/single-file/index.html   # bản một file
    python tools/sat/inject_sat.py data/sat/sat.json app/split/js/data/SAT.js      # bản nhiều file
"""
import json, sys

def main(json_path, target):
    data = json.load(open(json_path, encoding="utf-8"))
    assert "words" in data and "wic" in data, "sat.json phải có hai khóa 'words' và 'wic'"
    lit = json.dumps(data, ensure_ascii=False)
    if target.endswith(".js"):
        open(target, "w", encoding="utf-8").write(f"const SAT = {lit};\n")
    else:
        s = open(target, encoding="utf-8").read()
        i = s.index("const SAT = {"); j = s.index(";\n", i)
        s = s[:i] + "const SAT = " + lit + s[j:]
        open(target, "w", encoding="utf-8").write(s)
    print(f"Đã nạp {len(data['words'])} mục từ và {len(data['wic'])} câu Words in Context vào {target}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
