const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(process.env.TARGET_FILE || require('path').join(__dirname, '../app/single-file/index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'});
const w=dom.window,d=w.document; w.confirm=()=>true; w.scrollTo=()=>{};
const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
function answerAll(frac){ const t=w.eval('test'); t.items.forEach((it,i)=>{ if(i%frac) return;
  if(it.kind==='radio') d.querySelector(`input[name="${it.id}"][value="${it.correct}"]`).checked=true;
  else if(it.kind==='select') d.getElementById(it.id).value=it.correct; else d.getElementById(it.id).value=it.accept[0]; }); }
setTimeout(()=>{ try{
  // originals
  const ids=[...d.querySelectorAll('.tcard')].map(b=>b.dataset.id);
  for(const id of ids){ d.querySelector(`.tcard[data-id="${id}"]`).click(); d.getElementById('t-start').click();
    const t=w.eval('test'); answerAll(1); w.eval('grade(false)');
    const sc=d.querySelector('.score .big').textContent.replace(/\s+/g,'');
    if(!sc.startsWith(t.total+'/')) console.log('ORIG FAIL',id,sc,t.total);
    else process.stdout.write(id+':'+sc+' ');
  }
  console.log();
  // custom
  d.querySelector('input[name=tmode][value=custom]').click(); d.querySelector('input[name=tmode][value=custom]').dispatchEvent(new w.Event('change'));
  for(const lvl of ['easy','medium','hard']) for(const [a,z] of [[1,35],[1,70],[140,210],[400,500],[1,500]]){
    d.querySelector(`input[name=level][value=${lvl}]`).checked=true;
    d.querySelectorAll('input[name=ctype]').forEach(c=>c.checked=true);
    d.getElementById('c-from').value=a; d.getElementById('c-to').value=z; d.getElementById('c-count').value=40;
    w.refreshSetup(); if(d.getElementById('t-start').disabled){console.log('disabled',lvl,a,z,d.getElementById('t-err').textContent);continue;}
    d.getElementById('t-start').click(); const t=w.eval('test'); answerAll(1); w.eval('grade(false)');
    const sc=d.querySelector('.score .big').textContent.replace(/\s+/g,'');
    console.log(lvl,a,z,'parts',t.parts.map(p=>p.kind).join(','),'score',sc);
    if(lvl==='hard'&&a===1&&z===500){ d.querySelector('#t-after .btn.pen')?.click(); console.log(' retry total',w.eval('test.total')); }
  }
  // wrong-answers test
  d.getElementById('c-from').value=1; d.getElementById('c-to').value=70; w.refreshSetup(); d.getElementById('t-start').click(); w.eval('grade(false)');
  d.querySelector('#t-after .btn.pen').click(); const t2=w.eval('test'); console.log('retry wrong total',t2.total, 'parts',t2.parts.map(p=>p.kind).join(','));
  // tabs
  d.querySelector('.tabs [data-tab=learn]').click(); d.querySelector('.tabs [data-tab=affix]').click(); d.querySelector('.tabs [data-tab=test]').click();
 }catch(e){console.log('EXC',e.stack)} console.log('errors',errs); process.exit(0); },300);
