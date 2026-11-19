import asyncio, json, sys, os
TARGET=os.environ.get('TARGET','file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'../app/single-file/index.html')))
from playwright.async_api import async_playwright
sys.path.insert(0,os.path.dirname(__file__)); from _fonts_helper import css
GRAB = """()=>{const VN=/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i; const out=[];
 const tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); let n;
 while(n=tw.nextNode()){ const el=n.parentElement; if(!el||el.closest('script,style')) continue; const t=n.nodeValue.trim(); if(!t||!(VN.test(t)||/\bNghe\b|Xong!|Kinh doanh|Song song/.test(t))) continue;
   const r=el.getBoundingClientRect(); const cs=getComputedStyle(el); if(r.width===0&&r.height===0) continue; if(el.closest('[data-lang="vi"]')) continue;
   let vis=true; for(let e=el;e;e=e.parentElement){ const c=getComputedStyle(e); if(c.display==='none'||c.visibility==='hidden'){vis=false;break;} } if(!vis) continue;
   if(el.closest('#lang-vi')) continue; out.push(t.slice(0,120)); }
 document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(e=>['placeholder','title','aria-label'].forEach(a=>{const v=e.getAttribute(a); if(v&&VN.test(v)&&!e.closest('#lang-vi')) out.push('@'+a+':'+v)})); return out;}"""
async def main():
    found={}
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await b.new_page(viewport={'width':1280,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('https://fonts.googleapis.com/**',lambda r: r.fulfill(status=200,content_type='text/css',body=css))
        await pg.add_init_script("window.speechSynthesis=window.speechSynthesis||{speak(){},cancel(){}};")
        await pg.goto(TARGET); await pg.wait_for_timeout(500)
        await pg.click('#dd-lang .ddbtn'); await pg.click('#lang-en'); await pg.wait_for_timeout(200)
        async def grab(tag):
            await pg.wait_for_timeout(150)
            for t in await pg.evaluate(GRAB): found.setdefault(t,tag)
        async def js(code): 
            try: await pg.evaluate(code)
            except Exception as e: print('JS ERR',tag_now,e)
        await grab('home')
        for st in ['ielts','sat']:
            await js(f'setSet("{st}")'); await pg.wait_for_timeout(100)
            tag_now=st
            await js('document.querySelector(\'.tabs [data-tab="test"]\').click()'); await grab(st+':setup')
            if st=='ielts':
                await js('document.querySelectorAll("input[name=ctype]").forEach(c=>c.checked=true); document.getElementById("c-to").value=500; refreshSetup()')
                for lv in ['easy','medium','hard']:
                    await js(f'document.querySelector("input[name=level][value={lv}]").click()'); await grab(st+':lvl')
                    await js('document.getElementById("t-start").click()'); await grab(st+':test-'+lv)
                    await js('document.getElementById("t-submit").click()'); await pg.wait_for_timeout(100); await grab(st+':ask')
                    await js('document.getElementById("m-ok").click()'); await grab(st+':result-'+lv)
                    await js('document.querySelector(\'.tabs [data-tab="test"]\').click()')
            else:
                await js('document.querySelectorAll("input[name=stype]").forEach(c=>c.checked=true); satRefresh()')
                for lv in ['easy','medium','hard']:
                    await js(f'document.querySelector("input[name=slevel][value={lv}]").click()'); await grab(st+':lvl')
                    await js('document.getElementById("s-start").click()'); await grab(st+':test-'+lv)
                    await js('document.getElementById("t-submit").click()'); await pg.wait_for_timeout(100)
                    await js('document.getElementById("m-ok").click()'); await grab(st+':result-'+lv)
                    await js('document.querySelector(\'.tabs [data-tab="test"]\').click()')
            await js('document.querySelector(\'.tabs [data-tab="learn"]\').click()'); await grab(st+':learn')
            modes = '#l-modes .chip' if st=='ielts' else '#sl-modes .chip'
            n = await pg.evaluate(f'document.querySelectorAll("{modes}").length')
            for i in range(n):
                await js(f'document.querySelectorAll("{modes}")[{i}].click()'); await grab(st+f':learn{i}')
                await js('(()=>{const f=document.querySelector("#fc-in,#sf-in"); if(f) f.click();})()'); await grab(st+':flip')
                await js('(()=>{const r=document.querySelector("#l-area input[type=radio],#sl-area input[type=radio]"); if(r){r.checked=true;r.dispatchEvent(new Event("change",{bubbles:true}));}})()'); await grab(st+':ans')
                await js('(()=>{const t=document.querySelector("#l-area .typed input,#sl-area .typed input"); if(t){t.value="xyz"; t.parentNode.querySelector("button").click();}})()'); await grab(st+':typed')
                await js('(()=>{const c=document.querySelectorAll("#mg-mode .chip,#smg-mode .chip"); c.forEach(x=>x.click());})()'); await grab(st+':match')
                await js('(()=>{const b=document.querySelector("#fc-ok,#sf-ok"); if(b) for(let i=0;i<3;i++) b.click();})()')
            await js('document.querySelector(\'.tabs [data-tab="learned"]\').click()'); await grab(st+':learned')
            for mode in ['mcq','type','listen']:
                await js(f'document.getElementById("lw-mode").value="{mode}"; document.getElementById("lw-all").click()'); await grab(st+':review-'+mode)
                await js('(()=>{const r=document.querySelector("#lw-area input[name=rvq]"); if(r){r.checked=true;r.dispatchEvent(new Event("change"));} const t=document.getElementById("rv-in"); if(t){t.value="xyz"; document.getElementById("rv-go").click();}})()'); await grab(st+':rv')
            await js('document.querySelector(\'.tabs [data-tab="affix"]\').click()'); await grab(st+':affix')
            modes = '#a-modes .chip' if st=='ielts' else '#sx-modes .chip'
            n = await pg.evaluate(f'document.querySelectorAll("{modes}").length')
            for i in range(n):
                await js(f'document.querySelectorAll("{modes}")[{i}].click()'); await grab(st+f':affix{i}')
                await js('(()=>{const a=document.querySelector("#v-affix:not(.hidden), #v-sat-affix:not(.hidden)"); if(!a) return; const r=a.querySelector("input[type=radio]"); if(r){r.checked=true;r.dispatchEvent(new Event("change",{bubbles:true}));} const o=a.querySelector("button.opt"); if(o) o.click(); const t=a.querySelector(".typed input, input[type=text]"); if(t){t.value="xyz"; const g=t.parentNode.querySelector("button"); if(g) g.click();} a.querySelectorAll("#sx-af .chip").forEach(c=>c.click());})()'); await grab(st+':affixans')
            await js('document.querySelector(\'.tabs [data-tab="guide"]\').click()'); await grab(st+':guide')
            await js('document.querySelectorAll("#g-chips .chip").forEach(c=>c.click())'); await grab(st+':guide2')
            await js('document.getElementById("logo-home").click()'); await grab(st+':home')
        await js('document.getElementById("acct-btn").click()'); await grab('acct')
        await js('document.querySelector(".authtabs [data-t=up]").click()'); await grab('acct-up')
        await js('document.getElementById("a-go").click()'); await grab('acct-err')
        print('PAGE ERRORS', errs)
        await b.close()
    pass
    for t,tag in found.items(): print(tag,'|',t)
asyncio.run(main())
