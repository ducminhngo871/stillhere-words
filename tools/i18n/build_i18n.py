"""Ghi lại từ điển giao diện tiếng Anh (en_dict.py) vào ứng dụng.

Sửa bản dịch trong tools/i18n/en_dict.py (EN = chuỗi tiếng Việt → tiếng Anh, RULES = mẫu regex),
rồi chạy:
    python tools/i18n/build_i18n.py app/single-file/index.html
    python tools/i18n/build_i18n.py app/split            # cập nhật js/data/I18N_DICT.js và js/app.js
Chuỗi có số được chuẩn hoá thành {n}. Nhóm bắt trong RULES viết \\1, \\2 (script đổi sang $1, $2 cho JavaScript).
"""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from en_dict import EN, RULES
target = sys.argv[1]
dict_line = "const I18N_DICT = " + json.dumps(EN, ensure_ascii=False) + ";"
rules = [(p, re.sub(r"\\(\d)", r"$\1", r)) for p, r in RULES]
rules_line = "const I18N_RULES = " + json.dumps(rules, ensure_ascii=False) + ".map(([p, r]) => [new RegExp(p), r]);"
def put(path, prefix, line):
    s = open(path, encoding="utf-8").read(); i = s.index(prefix); j = s.index("\n", i)
    open(path, "w", encoding="utf-8").write(s[:i] + line + s[j:])
if os.path.isdir(target):
    open(os.path.join(target, "js/data/I18N_DICT.js"), "w", encoding="utf-8").write(dict_line + "\n")
    put(os.path.join(target, "js/app.js"), "const I18N_RULES = ", rules_line)
else:
    put(target, "const I18N_DICT = ", dict_line); put(target, "const I18N_RULES = ", rules_line)
print(f"Đã ghi {len(EN)} chuỗi và {len(rules)} mẫu vào {target}")
