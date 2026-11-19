const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(process.env.TARGET_FILE || require('path').join(__dirname, '../app/single-file/index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'});
const w=dom.window,d=w.document; w.confirm=()=>true; w.scrollTo=()=>{};
const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
setTimeout(()=>{ try{
 d.getElementById('set-sat').click();
 d.querySelectorAll('input[name=stype]').forEach(c=>c.checked=true);
 d.getElementById('s-from').value=1; d.getElementById('s-to').value=140; d.getElementById('s-count').value=60; w.satRefresh();
 console.log(d.getElementById('s-summary').textContent);
 d.getElementById('s-start').click(); const t=w.eval('test');
 t.items.forEach(it=>{ if(it.kind==='radio') d.querySelector(`input[name="${it.id}"][value="${it.correct}"]`).checked=true; else if(it.kind==='select') d.getElementById(it.id).value=it.correct; else d.getElementById(it.id).value=it.accept[0]; });
 w.eval('grade(false)'); console.log(t.parts.map(p=>p.kind).join(','), d.querySelector('.score .big').textContent.replace(/\s+/g,''));
 d.querySelector('.tabs [data-tab=learn]').click(); w.satLearnStart(); console.log('card', w.eval('SF.cur.w'), w.eval('SF.cur.vi'));
}catch(e){console.log('EXC',e.stack)} setTimeout(()=>{console.log('errors',errs); process.exit(0);},300); },300);
