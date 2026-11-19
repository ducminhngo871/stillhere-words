"""Tách file index.html một-file thành cấu trúc dự án nhiều file.

Cách dùng: python split_single_file.py <single-file index.html> <thư mục đích>

- <style>        → css/styles.css
- Các hằng số dữ liệu lớn (const X = {...}; / [...];) → js/data/X.js (giữ nguyên `const`,
  vì các <script> thường dùng chung phạm vi toàn cục nên app.js vẫn thấy được)
- Phần còn lại của <script> → js/app.js
- Ảnh base64 (cờ, ảnh giới thiệu) → assets/*.png
"""
import re, sys, os, base64, json
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()
os.makedirs(f"{out}/css", exist_ok=True); os.makedirs(f"{out}/js/data", exist_ok=True); os.makedirs(f"{out}/assets", exist_ok=True)
# css
i = s.index("<style>"); j = s.index("</style>", i)
open(f"{out}/css/styles.css", "w", encoding="utf-8").write(s[i + 7:j].strip() + "\n")
s = s[:i] + '<link rel="stylesheet" href="css/styles.css">' + s[j + 8:]
# script
i = s.index("<script>"); j = s.rindex("</script>")
code = s[i + 8:j]
lines = code.split("\n"); keep = []; data_files = []
for ln in lines:
    m = re.match(r"^const ([A-Z][A-Z0-9_]*) = ([\[{].*);\s*$", ln)
    if m and len(ln) > 3000:
        name, lit = m.group(1), m.group(2)
        try: json.loads(lit)
        except Exception: keep.append(ln); continue
        open(f"{out}/js/data/{name}.js", "w", encoding="utf-8").write(f"const {name} = {lit};\n")
        data_files.append(name); continue
    keep.append(ln)
open(f"{out}/js/app.js", "w", encoding="utf-8").write("\n".join(keep).strip() + "\n")
tags = "\n".join(f'<script src="js/data/{n}.js"></script>' for n in data_files) + '\n<script src="js/app.js"></script>'
s = s[:i] + tags + s[j + 9:]
# images
n = 0
def img(m):
    global n
    n += 1; data = base64.b64decode(m.group(2)); name = {1: "flag-vi.png", 2: "flag-en.png", 3: "about-avatar.png"}.get(n, f"image-{n}.png")
    open(f"{out}/assets/{name}", "wb").write(data); return f'src="assets/{name}"'
s = re.sub(r'src="data:image/(png);base64,([A-Za-z0-9+/=]+)"', img, s)
open(f"{out}/index.html", "w", encoding="utf-8").write(s)
print("data files:", data_files); print("images:", n)
