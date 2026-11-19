const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(process.env.TARGET_FILE || require('path').join(__dirname, '../app/single-file/index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'});
const w=dom.window,d=w.document; w.confirm=()=>true; w.scrollTo=()=>{};
const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
setTimeout(()=>{ try{
 d.getElementById('set-sat').click(); d.querySelector('.tabs [data-tab=affix]').click();
 console.log('visible', !d.getElementById('v-sat-affix').classList.contains('hidden'), d.querySelectorAll('#sx-area .aff').length,'roots');
 for (const list of ['all','bb','br']) {
   d.getElementById('sx-list').value=list; d.getElementById('sx-list').dispatchEvent(new w.Event('change'));
   for (const m of ['roots','affixes','split','pos','rootmean','family']) {
     w.satAffixStart(m);
     for (let k=0;k<15;k++){
       const q=d.getElementById('sx-q'); if(!q) break;
       const r=q.querySelector('input[name="sxq"]'); const b=q.querySelector('button.opt');
       if(r){ r.checked=true; r.dispatchEvent(new w.Event('change')); } else if(b){ b.click(); } else break;
       const nx=d.getElementById('sx-next'); if(nx) nx.click();
     }
     const sc=d.getElementById('sx-score'); process.stdout.write(`${list}/${m}:${sc?sc.textContent:d.getElementById('sx-area').children.length} `);
   }
   console.log();
 }
 w.satAffixStart('split'); const r=d.querySelector('#sx-q input[name="sxq"]'); r.checked=true; r.dispatchEvent(new w.Event('change'));
 console.log(d.getElementById('sx-fb').textContent.slice(0,200));
 d.getElementById('set-ielts').click(); d.querySelector('.tabs [data-tab=affix]').click(); console.log('ielts affix', !d.getElementById('v-affix').classList.contains('hidden'));
}catch(e){console.log('EXC',e.stack)} console.log('errors',errs); process.exit(0); },300);
