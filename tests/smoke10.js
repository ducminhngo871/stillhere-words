const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(process.env.TARGET_FILE || require('path').join(__dirname, '../app/single-file/index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'});
const w=dom.window,d=w.document; w.scrollTo=()=>{}; w.confirm=()=>{throw new Error('confirm called')};
const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
const tick=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(async()=>{ try{
 console.log('seg removed', !d.querySelector('input[name=tmode]'), 'custom visible', !d.getElementById('p-custom').classList.contains('hidden'));
 console.log('hello', d.querySelector('[data-hello]').textContent, '|', d.querySelector('[data-stat]').textContent);
 // start IELTS custom test, answer only 2, submit -> modal
 d.getElementById('t-start').click(); await tick(50);
 console.log('running test', !d.getElementById('v-test').classList.contains('hidden'));
 d.getElementById('t-submit').click(); await tick(20);
 console.log('modal', d.getElementById('m-title').textContent);
 d.getElementById('m-ok').click(); await tick(50);
 console.log('graded', d.querySelector('.score .big') ? d.querySelector('.score .big').textContent.replace(/\s+/g,'') : 'no score');
 // guide tab
 d.querySelector('.tabs [data-tab=guide]').click(); await tick(20);
 console.log('guide', !d.getElementById('v-guide').classList.contains('hidden'), d.querySelectorAll('#g-traps .trap').length,'traps');
 d.querySelector('#g-chips [data-g=wic]').click(); console.log('wic sec', !d.querySelector('.gsec[data-g=wic]').classList.contains('hidden'));
 // SAT test, leave mid-way -> modal cancel then ok
 d.getElementById('set-sat').click(); await tick(20); d.getElementById('s-start').click(); await tick(50);
 d.querySelector('.tabs [data-tab=learn]').click(); await tick(20);
 console.log('leave modal', d.getElementById('m-title').textContent); d.getElementById('m-no').click(); await tick(20);
 console.log('still in test', !d.getElementById('v-test').classList.contains('hidden'));
 console.log('legend', d.querySelectorAll('#v-test .legend span').length);
 d.getElementById('t-submit').click(); await tick(20); d.getElementById('m-ok').click(); await tick(50);
 console.log('sat graded', !!d.querySelector('.score .big'));
 // account modal (local)
 d.getElementById('acct-btn').click(); await tick(10);
 console.log('acct', d.getElementById('m-title').textContent, '| note', !!d.querySelector('#m-box .notice'));
 d.getElementById('a-email').value='a@b.com'; d.getElementById('a-pass').value='123456'; d.getElementById('a-go').click(); await tick(10);
 console.log('msg', d.getElementById('a-msg').textContent);
 d.querySelector('.authtabs [data-t=up]').click(); d.getElementById('a-name').value='X'; d.getElementById('a-email').value='a@b.com'; d.getElementById('a-pass').value='123456'; d.getElementById('a-pass2').value='12345'; d.getElementById('a-go').click(); await tick(10);
 console.log('signup msg', d.getElementById('a-msg').textContent);
 d.querySelector('.authtabs [data-t=in]').click(); d.getElementById('a-forgot').click(); console.log('reset', d.getElementById('m-title').textContent);
 d.getElementById('a-cancel').click(); console.log('closed', d.getElementById('modal').classList.contains('hidden'));
}catch(e){console.log('EXC',e.stack)} console.log('errors',errs); process.exit(0); },300);
