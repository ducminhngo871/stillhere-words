import asyncio, sys, os
from playwright.async_api import async_playwright
sys.path.insert(0,os.path.dirname(__file__)); from _fonts_helper import css
TARGET=os.environ.get('TARGET','file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'../app/single-file/index.html')))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for lang in ['vi','en']:
          for wd in [320,375,430,768,900,1024,1180,1440]:
            pg=await b.new_page(viewport={'width':wd,'height':700})
            await pg.route('https://fonts.googleapis.com/**',lambda r: r.fulfill(status=200,content_type='text/css',body=css))
            await pg.goto(TARGET); await pg.wait_for_timeout(400)
            if lang=='en': await pg.click('#dd-lang .ddbtn'); await pg.click('#lang-en'); await pg.wait_for_timeout(200)
            res=await pg.evaluate("""()=>{const nav=document.querySelector('.appbar .tabs').getBoundingClientRect(); const bs=[...document.querySelectorAll('.appbar .tabs button')].map(b=>{const r=b.getBoundingClientRect(); return [b.textContent, r.left>=-1 && r.right<=innerWidth+1 && r.top>=0]});
              const right=[...document.querySelectorAll('.bar-right > *')].map(e=>{const r=e.getBoundingClientRect(); return r.width===0 || (r.left>=-1 && r.right<=innerWidth+1)});
              return {hidden:bs.filter(x=>!x[1]).map(x=>x[0]), rightOk:right.every(Boolean), docW:document.documentElement.scrollWidth, h:document.querySelector('.appbar').getBoundingClientRect().height}}""")
            print(lang,wd,res)
            await pg.close()
        await b.close()
asyncio.run(main())
