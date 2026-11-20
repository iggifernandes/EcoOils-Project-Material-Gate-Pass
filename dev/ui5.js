/* v1.28.1: the app must still work when Apps Script has NOT been updated (config has no deptGroups) */
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const m=require('./mock.js')();
let fails=0;const ok=(c,t)=>{console.log((c?'PASS ':'FAIL ')+t);if(!c)fails++};
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').replace(/var API_URL='[^']*';/,"var API_URL='https://gas.test/exec';");
(async()=>{
const br=await chromium.launch();const ctx=await br.newContext({viewport:{width:390,height:844},locale:'en-US'});const page=await ctx.newPage();
await page.route('https://gp.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:html}));
await page.route('https://gas.test/**',async r=>{const b=JSON.parse(r.request().postData());const res=m.call(b);if(b.action==='config'){}await r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(res)});});
await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));await page.route('https://fonts.gstatic.com/**',r=>r.abort());
await page.goto('https://gp.test/');await page.waitForSelector('#hNew');await page.waitForTimeout(500);await page.click('#hNew');
await page.click('[data-purpose=B]');await page.click('[data-mode="who:courier"]');
ok(await page.locator('#fIcType').count()===0&&await page.locator('#fCCo').count()===1,'courier: no KTP/SIM boxes, courier company box shown');
await page.fill('#fCarrier','Slamet Riyadi');await page.selectOption('#fCompany','KKS');await page.click('[data-mode=hand]');
await page.selectOption('#fReason',{index:1});await page.fill('#fPT','Return to vendor');
await page.fill('[data-i="0"][data-k=item]','Torque wrench');await page.fill('[data-i="0"][data-k=qty]','2');await page.selectOption('[data-i="0"][data-k=unit]','Pcs');
await page.fill('#fRep','Josep Siregar');await page.fill('#fPos','Store');await page.fill('#fPhone','82299049786');await page.click('[data-mode="sec:Project"]');await page.selectOption('#fDept','Project - HSSE');
await page.click('#nNext');ok((await page.textContent('#nErr')).length>3&&(await page.textContent('.stepl')).includes('1'),'courier: company is required');
await page.selectOption('#fCCo','JNE');await page.click('#nNext');ok((await page.textContent('#nErr')).length>3&&(await page.textContent('.stepl')).includes('1'),'courier: vendor is required');
await page.click('#nNext');ok((await page.textContent('#nErr')).length>3&&(await page.textContent('.stepl')).includes('1'),'courier: EcoOils rep name is required');await page.fill('#fEcoName','Budi Santoso');await page.click('#nNext');ok((await page.textContent('#nErr')).length>3,'courier: EcoOils staff ID is required');await page.fill('#fEcoId','E-1234');await page.fill('#fVendor','PT Maju Jaya');await page.fill('#fAwb','JNE0012345678');await page.fill('#fVref','PO-77');
await page.click('#nNext');ok((await page.textContent('.stepl')).includes('2'),'courier: form passes to photos');
ok(await page.evaluate(()=>icFull()==='COURIER JNE AWB JNE0012345678 | REP Budi Santoso (ID E-1234)'&&/ \| Vendor: PT Maju Jaya \| Ref: PO-77$/.test(purposeFull())),'courier: ID text and vendor/reference are built');
ok(await page.evaluate(()=>{LAST=null;return passHtml({ref:'MGP-X',date:'2026-11-20',purpose:'B',carrier:'Slamet',icNo:'COURIER JNE AWB 123456 | REP Budi Santoso (ID E-1234)',company:'KKS',vehicle:'HAND CARRY',purposeText:'x',dept:'Project - HSSE',icRep:'a',icPos:'b',icPhone:'+62 1',items:[{item:'a',qty:1,unit:'Pcs'}],qk:'k',token:'t'},{}, false,'').indexOf('COURIER (NO ID NO. TAKEN)')>0&&passHtml({ref:'MGP-X',date:'2026-11-20',purpose:'B',carrier:'Slamet',icNo:'COURIER JNE AWB 123456 | REP Budi Santoso (ID E-1234)',company:'KKS',vehicle:'HAND CARRY',purposeText:'x',dept:'Project - HSSE',icRep:'a',icPos:'b',icPhone:'+62 1',items:[{item:'a',qty:1,unit:'Pcs'}],qk:'k',token:'t'},{},false,'').indexOf('Budi Santoso, ID E-1234')>0;}),'courier: printed pass says no ID number taken and shows the EcoOils rep name and ID');
console.log(fails?'FAILED':'ALL PASSED');await br.close();process.exit(fails?1:0);})();
