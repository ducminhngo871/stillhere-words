const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(process.env.TARGET_FILE || require('path').join(__dirname, '../app/single-file/index.html'),'utf8');
const spoken=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',beforeParse(w){ w.speechSynthesis={speak:u=>spoken.push(u.text),cancel(){}}; w.SpeechSynthesisUtterance=function(t){this.text=t}; }});
const w=dom.window,d=w.document; w.confirm=()=>true; w.scrollTo=()=>{};
const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
setTimeout(async()=>{ try{
 d.getElementById('set-sat').click(); d.querySelector('.tabs [data-tab=learn]').click();
 d.getElementById('sl-from').value=1; d.getElementById('sl-to').value=20;
 // flash
 w.satLearnStart('flash'); d.getElementById('sf-say').click(); d.getElementById('sf-sayex').click(); console.log('flash spoken',spoken.slice(-2));
 // adaptive: answer correctly until done
 w.satLearnStart('adapt'); let steps=0;
 while(steps<400){ steps++; const q=d.getElementById('sa-q'); if(q.textContent.includes('Hoàn thành')) break;
   const SA=w.eval('SA'); const x=SA.last; const lvl=SA.lvl[x.core];
   const radios=[...q.querySelectorAll('input[name="saq"]')];
   if(radios.length){ const labels=[...q.querySelectorAll('.opt span')].map(s=>s.textContent);
     const want = lvl===0 ? (labels.includes(x.w)?x.w:(labels.includes(x.vi)?x.vi:x.d)) : x.w;
     const idx=labels.indexOf(want); if(idx<0){console.log('no correct opt',x.w,labels);break;}
     radios[idx].checked=true; radios[idx].dispatchEvent(new w.Event('change',{bubbles:true})); }
   else { d.getElementById('saq-t').value=x.w; d.getElementById('saq-go').click(); }
   await new Promise(r=>setTimeout(r,1200));
 }
 console.log('adapt finished?', d.getElementById('sa-q').textContent.slice(0,40), 'steps',steps);
 // dictation
 w.satLearnStart('dict'); const SD=w.eval('SD'); d.getElementById('sd-in').value=SD.w.w; d.getElementById('sd-go').click(); console.log('dict fb',d.getElementById('sd-fb').textContent.slice(0,80));
 d.getElementById('sd-go').click(); console.log('dict next', w.eval('SD.i'));
 // match
 w.satLearnStart('match'); const tiles=[...d.querySelectorAll('#smg-board .tile')]; const T=w.eval('(()=>0)()');
 const map={}; tiles.forEach(t=>{ const i=+t.dataset.i; }); 
 console.log('match tiles', tiles.length, d.getElementById('smg-best').textContent);
 d.querySelectorAll('#smg-mode .chip')[1].click(); console.log('def mode tiles', d.querySelectorAll('#smg-board .tile').length);
 // switching tabs stops timer
 d.querySelector('.tabs [data-tab=test]').click(); console.log('timer stopped', w.eval('SMG.timer'));
 // Barron's range without vi
 d.querySelector('.tabs [data-tab=learn]').click(); d.getElementById('sl-list').value='br'; d.getElementById('sl-from').value=300; d.getElementById('sl-to').value=319; w.satLearnStart('adapt');
 console.log('br notice', d.getElementById('sl-area').textContent.slice(0,90));
}catch(e){console.log('EXC',e.stack)} console.log('errors',errs); process.exit(0); },300);
