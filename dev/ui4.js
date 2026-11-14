/* v1.28.1: the app must still work when Apps Script has NOT been updated (config has no deptGroups) */
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const m=require('./mock.js')();
let fails=0;const ok=(c,t)=>{console.log((c?'PASS ':'FAIL ')+t);if(!c)fails++};
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').replace(/var API_URL='[^']*';/,"var API_URL='https://gas.test/exec';");
(async()=>{
const br=await chromium.launch();const ctx=await br.newContext({viewport:{width:390,height:844},locale:'en-US'});const page=await ctx.newPage();
await page.route('https://gp.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:html}));
await page.route('https://gas.test/**',async r=>{const b=JSON.parse(r.request().postData());const res=m.call(b);if(b.action==='config'){delete res.deptGroups;delete res.hofName;}await r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(res)});});
await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));await page.route('https://fonts.gstatic.com/**',r=>r.abort());
await page.goto('https://gp.test/');await page.waitForSelector('#hNew');await page.waitForTimeout(500);await page.click('#hNew');
await page.click('[data-purpose=B]');await page.fill('#fCarrier','Dewi Lestari');await page.selectOption('#fIcType','KTP');await page.fill('#fIcNo','1271012345678901');await page.selectOption('#fCompany','KKS');await page.click('[data-mode=hand]');
await page.selectOption('#fReason',{index:1});await page.fill('#fPT','Test');
await page.fill('[data-i="0"][data-k=item]','Torque wrench');await page.fill('[data-i="0"][data-k=qty]','2');await page.selectOption('[data-i="0"][data-k=unit]','Pcs');
await page.fill('#fRep','Josep Siregar');await page.fill('#fPos','Store');await page.fill('#fPhone','82299049786');
ok(await page.locator('[data-mode^="sec:"]').count()===0,'old server: no Project/Operations buttons, plain department list');
ok((await page.locator('#fDept option').allTextContents()).includes('HSSE'),'old server: the old department list is offered');
await page.evaluate(()=>{D.dept='Operations - Laboratory';});await page.click('#nNext');ok((await page.inputValue('#fDept'))===''&&(await page.textContent('#nErr')).length>3,'old server: a stale new-style department from a saved draft is dropped, not sent');
await page.selectOption('#fDept','HSSE');await page.click('#nNext');
ok((await page.textContent('.stepl')).includes('2'),'old server: the form passes to photos without the section');
console.log(fails?'FAILED':'ALL PASSED');await br.close();process.exit(fails?1:0);})();
