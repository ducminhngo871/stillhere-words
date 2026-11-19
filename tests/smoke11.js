const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(process.env.TARGET_FILE || require('path').join(__dirname, '../app/single-file/index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',beforeParse(w){w.speechSynthesis={speak(){},cancel(){}};w.SpeechSynthesisUtterance=function(t){this.text=t};}});
const w=dom.window,d=w.document; w.scrollTo=()=>{}; const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
const tick=ms=>new Promise(r=>setTimeout(r,ms)); const vis=id=>!d.getElementById(id).classList.contains('hidden');
setTimeout(async()=>{ try{
 console.log('home visible',vis('v-home'),'name field hidden',d.getElementById('t-name').closest('.field').classList.contains('hidden'));
 // dropdown
 d.querySelector('#dd-set .ddbtn').click(); console.log('dd open', d.getElementById('dd-set').classList.contains('open'));
 d.getElementById('set-sat').click(); await tick(20); console.log('set label', d.getElementById('dd-set-label').textContent, 'still home', vis('v-home'), 'dd closed', !d.getElementById('dd-set').classList.contains('open'));
 // learn SAT flashcards, mark 3 as learned
 d.querySelector('.tabs [data-tab=learn]').click(); await tick(20); w.satLearnStart('flash'); for(let i=0;i<3;i++){ d.getElementById('sf-ok').click(); await tick(5);} 
 d.querySelector('.tabs [data-tab=learned]').click(); await tick(20);
 console.log('kpis', d.getElementById('lw-kpis').textContent, '| rows', d.querySelectorAll('.lwrow').length);
 // review all, mcq
 d.getElementById('lw-all').click(); 
 for(let k=0;k<3;k++){ const r=d.querySelector('#lw-area input[name="rvq"]'); r.checked=true; r.dispatchEvent(new w.Event('change')); await tick(5); d.getElementById('rv-next').click(); await tick(5);} 
 console.log('review end', d.getElementById('lw-area').textContent.slice(0,60));
 d.getElementById('rv-back').click(); console.log('rows after', d.querySelectorAll('.lwrow').length, [...d.querySelectorAll('.lwrow .due')].map(x=>x.textContent).join(','));
 // type mode
 d.getElementById('lw-mode').value='type'; d.getElementById('lw-all').click(); const LE=w.eval('RV'); d.getElementById('rv-in').value=LE.list[0][1].w; d.getElementById('rv-go').click(); console.log('typed fb', d.getElementById('rv-fb').textContent.slice(0,30));
 // remove word
 d.querySelector('.tabs [data-tab=learned]').click(); await tick(10); d.querySelector('.lwrow .x').click(); await tick(10); d.getElementById('m-ok').click(); await tick(10); console.log('rows after remove', d.querySelectorAll('.lwrow').length);
 // home review card
 d.getElementById('logo-home').click(); await tick(10); console.log('home card', d.getElementById('h-review').textContent.trim().slice(0,70));
 // IELTS adaptive -> learned
 d.querySelector('#dd-set .ddbtn').click(); d.getElementById('set-ielts').click(); await tick(20);
 console.log('ielts learned', w.eval('learnedOf("ielts").length'));
 // name via local account
 d.getElementById('acct-btn').click(); d.getElementById('a-local-name').value='Minh Anh'; d.getElementById('a-local-save').click(); d.getElementById('a-cancel').click();
 console.log('acct name', d.getElementById('acct-name').textContent, '| t-name', d.getElementById('t-name').value, '| hello', d.querySelector('[data-hello]').textContent);
 // test + result shows name
 d.querySelector('.tabs [data-tab=test]').click(); await tick(10); d.getElementById('t-start').click(); await tick(30); d.getElementById('t-submit').click(); await tick(10); d.getElementById('m-ok').click(); await tick(30);
 console.log('result', d.querySelector('#t-result h2').textContent);
 // lang dropdown
 d.querySelector('#dd-lang .ddbtn').click(); d.getElementById('lang-en').click(); await tick(20);
 console.log('lang label', d.getElementById('dd-lang-label').textContent, '| tabs', [...d.querySelectorAll('.tabs button')].map(b=>b.textContent).join(' | '));
 d.getElementById('logo-home').click(); await tick(10); console.log('hero EN', d.getElementById('h-title').textContent, '|', d.querySelector('.trust-row').textContent);
 d.querySelector('.tabs [data-tab=learned]').click(); await tick(10); console.log('learned EN', d.getElementById('lw-kpis').textContent, d.getElementById('lw-due').textContent);
}catch(e){console.log('EXC',e.stack)} console.log('errors',errs); process.exit(0); },300);
