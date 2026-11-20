/* v1.34: EcoOils Rep department 'Other (type it)' */
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const m=require('./mock.js')();
let fails=0;const ok=(c,t)=>{console.log((c?'PASS ':'FAIL ')+t);if(!c)fails++};
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').replace(/var API_URL='[^']*';/,"var API_URL='https://gas.test/exec';");
(async()=>{
const br=await chromium.launch();const ctx=await br.newContext({viewport:{width:390,height:844},locale:'en-US'});const page=await ctx.newPage();
await page.route('https://gp.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:html}));
await page.route('https://gas.test/**',async r=>{const b=JSON.parse(r.request().postData());const res=m.call(b);await r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(res)});});
await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));await page.route('https://fonts.gstatic.com/**',r=>r.abort());
await page.goto('https://gp.test/');await page.waitForSelector('#hNew');await page.waitForTimeout(500);await page.click('#hNew');
await page.click('[data-mode="sec:Project"]');
const opts=await page.$$eval('#fDept option',o=>o.map(x=>x.textContent));
ok(opts.includes('Document Control')&&opts.includes('Environmental')&&opts.includes('Fire and Emergency')&&opts.some(x=>/Other/.test(x)),'more departments and an Other option');
ok(await page.locator('#fDeptTxt').count()===0,'no text box before Other is chosen');
await page.selectOption('#fDept','__other');
ok(await page.locator('#fDeptTxt').count()===1,'text box appears for Other');
await page.fill('#fDeptTxt','Fire Station (Site)');
ok(await page.evaluate(()=>D.dept==='Project - Other: Fire Station (Site)'),'department text is Project - Other: ...');
await page.fill('#fDeptTxt','');
ok(await page.evaluate(()=>D.dept==='__other'),'empty text keeps Other pending');
await page.click('[data-mode="sec:Operations"]');
ok(await page.locator('#fDeptTxt').count()===0,'changing section clears Other');
await br.close();console.log(fails?'FAILURES '+fails:'ALL PASSED');process.exit(fails?1:0);})();
