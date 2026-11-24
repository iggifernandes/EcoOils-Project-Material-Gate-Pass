/* v1.35: a pass without number / QR key is never printed */
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const m=require('./mock.js')();
let fails=0;const ok=(c,t)=>{console.log((c?'PASS ':'FAIL ')+t);if(!c)fails++};
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').replace(/var API_URL='[^']*';/,"var API_URL='https://gas.test/exec';");
(async()=>{
const br=await chromium.launch();const ctx=await br.newContext({viewport:{width:390,height:844},locale:'en-US'});const page=await ctx.newPage();
await page.route('https://gp.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:html}));
await page.route('https://gas.test/**',async r=>{const b=JSON.parse(r.request().postData());await r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(m.call(b))});});
await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));await page.route('https://fonts.gstatic.com/**',r=>r.abort());
await page.goto('https://gp.test/');await page.waitForSelector('#hNew');
await page.evaluate(()=>{window.__printed=0;window.print=function(){window.__printed++};window.__alerts=[];window.alert=function(t){window.__alerts.push(t)};});
await page.evaluate(()=>printPass({vehicle:'BL 9999 WL',company:'KKS',items:[]}));
await page.waitForTimeout(400);
ok(await page.evaluate(()=>window.__printed===0&&window.__alerts.length===1&&/no pass number/.test(window.__alerts[0])),'pass without number is not printed, user is told');
await page.evaluate(()=>printPass({ref:'MGP-KKS-2611-0001',vehicle:'BL 1 X',company:'KKS',items:[]}));
await page.waitForTimeout(400);
ok(await page.evaluate(()=>window.__printed===0&&window.__alerts.length===2),'pass without QR key is not printed either');
await br.close();console.log(fails?'FAILURES '+fails:'ALL PASSED');process.exit(fails?1:0);})();
