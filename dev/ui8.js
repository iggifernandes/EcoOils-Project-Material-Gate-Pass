/* v1.37: Admin login says 'not an admin'; Forgot PIN by email; reset link form */
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const m=require('./mock.js')();
let fails=0;const ok=(c,t)=>{console.log((c?'PASS ':'FAIL ')+t);if(!c)fails++};
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').replace(/var API_URL='[^']*';/,"var API_URL='https://gas.test/exec';");
(async()=>{
const br=await chromium.launch();const ctx=await br.newContext({viewport:{width:390,height:844},locale:'en-US'});const page=await ctx.newPage();
await page.route('https://gp.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:html}));
await page.route('https://gas.test/**',async r=>{const b=JSON.parse(r.request().postData());await r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(m.call(b))});});
await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));await page.route('https://fonts.gstatic.com/**',r=>r.abort());
await page.goto('https://gp.test/');await page.waitForSelector('#hAdmin');
await page.click('#hAdmin');await page.fill('#adPin','000000');await page.click('#adGo');
await page.waitForFunction(()=>/not an admin/i.test(document.getElementById('vAdmin').innerText));
ok(true,'wrong PIN shows: You are not an admin');
await page.click('#adForgot');await page.waitForFunction(()=>/reset link was sent to ig\*\*\*@ecooils\.com\.my/.test(document.getElementById('vAdmin').innerText));
ok(true,'Forgot PIN says the link went to ig***@ecooils.com.my');
const tok=(/resetpin=([0-9a-f]{64})/.exec(m.ctx.mails.pop().body)||[])[1];
await page.goto('https://gp.test/?resetpin='+tok);await page.waitForSelector('#rsP1');
ok(await page.evaluate(()=>location.search===''),'the token is removed from the address bar');
await page.fill('#rsP1','482915');await page.fill('#rsP2','482916');await page.click('#rsGo');
await page.waitForFunction(()=>/not the same/.test(document.getElementById('vAdmin').innerText));ok(true,'two different PINs are refused');
await page.fill('#rsP1','482915');await page.fill('#rsP2','482915');await page.click('#rsGo');
await page.waitForFunction(()=>/New PIN saved/.test(document.getElementById('vAdmin').innerText));ok(true,'new PIN saved');
await page.fill('#adPin','482915');await page.click('#adGo');await page.waitForSelector('#adOut');ok(true,'login with the new PIN works');
await page.click('#adAudit');await page.waitForFunction(()=>/Every evening/.test(document.getElementById('vAdmin').innerText));ok(true,'Admin Audit screen opens');
await br.close();console.log(fails?'FAILURES '+fails:'ALL PASSED');process.exit(fails?1:0);})();
