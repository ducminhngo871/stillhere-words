import asyncio, base64
from playwright.async_api import async_playwright
import os
F=os.environ.get('FONTSOURCE_DIR','/tmp/fonts/')  # thư mục chứa gói npm @fontsource/lora và @fontsource/inter đã giải nén
def face(fam,path,w):
    return f"@font-face{{font-family:'{fam}';font-weight:{w};font-style:normal;src:url(data:font/woff2;base64,{base64.b64encode(open(path,'rb').read()).decode()}) format('woff2');}}\n"
css=''
for w in (400,700):
    for sub in ('latin','vietnamese'): css+=face('Lora',f'{F}fontsource-lora/files/lora-{sub}-{w}-normal.woff2',w)
for w in (400,500,600):
    for sub in ('latin','vietnamese'): css+=face('Inter',f'{F}fontsource-inter/files/inter-{sub}-{w}-normal.woff2',w)
