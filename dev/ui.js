const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const m=require('./mock.js')();
let fails=0;const ok=(c,t)=>{console.log((c?'PASS ':'FAIL ')+t);if(!c)fails++};
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').replace(/var API_URL='[^']*';/,"var API_URL='https://gas.test/exec';");
(async()=>{
const br=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
const ctx=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,locale:'en-US',permissions:['camera']});
const page=await ctx.newPage();
const errs=[];page.on('pageerror',e=>errs.push(String(e)));page.on('console',x=>{if(x.type()==='error')errs.push(x.text())});
await page.route('https://gp.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:html}));
await page.route('https://gas.test/**',async r=>{const b=JSON.parse(r.request().postData());const res=m.call(b);await r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(res)});});
await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
await page.route('https://fonts.gstatic.com/**',r=>r.abort());
// a real JPEG made by the browser itself
const jp=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=800;c.height=600;const x=c.getContext('2d');x.fillStyle='#8a8';x.fillRect(0,0,800,600);x.fillStyle='#222';x.fillRect(100,200,600,250);return c.toDataURL('image/jpeg',0.8).split(',')[1];}).catch(()=>null);
const jpgPath='/tmp/gp_test.jpg';
const pg2=await ctx.newPage();await pg2.goto('about:blank');
const jb=await pg2.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=600;const x=c.getContext('2d');x.fillStyle='#88aa88';x.fillRect(0,0,800,600);x.fillStyle='#222';x.fillRect(100,200,600,250);return c.toDataURL('image/jpeg',0.8).split(',')[1];});
fs.writeFileSync(jpgPath,Buffer.from(jb,'base64'));await pg2.close();
await page.goto('https://gp.test/');
await page.waitForSelector('#hNew');
// version above the language toggle, top right
const vb=await page.locator('#ver').boundingBox(),lb=await page.locator('.lang').boundingBox();
ok(vb.y+vb.height<=lb.y+1&&Math.abs((vb.x+vb.width)-(lb.x+lb.width))<4&&vb.x>200,'version number sits top right, directly above the EN/ID/MS toggle');
ok((await page.locator('.lang button').allTextContents()).join()==='EN,ID,MS','toggle has EN, ID, MS');
ok((await page.evaluate(()=>getComputedStyle(document.querySelector('h1')).fontFamily)).includes('Jost')&&(await page.evaluate(()=>getComputedStyle(document.querySelector('h1')).textTransform))==='uppercase','title style: Jost, uppercase');
// ----- wizard
await page.click('#hNew');
await page.click('#nNext');ok((await page.textContent('#nErr')).length>3,'step 1 blocks until A/B is chosen: '+await page.textContent('#nErr'));
await page.click('[data-purpose=A]');
await page.selectOption('#fCompany','GSB');
await page.fill('#fVehicle','bk 1234 xy');await page.fill('#fCarrier','Budi Santoso');await page.selectOption('#fIcType','KTP');await page.fill('#fIcNo','1271 0123 4567 8901');
await page.selectOption('#fReason','rOther');await page.fill('#fPT','');await page.click('#nNext');ok((await page.textContent('#nErr')).includes('Describe'),'Other reason needs a description: '+await page.textContent('#nErr'));
ok((await page.locator('#fReason option').allTextContents()).join().includes('Rejected on receipt'),'quick reasons offered for purpose A');
await page.selectOption('#fReason','rA1');await page.fill('#fPT','6in pipes');await page.selectOption('#fDept','Stores');await page.fill('#fRep','Andi Wijaya');await page.fill('#fPos','Store lead');
await page.fill('#fPhone','123');await page.click('#nNext');ok((await page.textContent('#nErr')).length>3&&(await page.textContent('.stepl')).includes('1'),'IC phone number is required and checked: '+await page.textContent('#nErr'));
await page.fill('#fPhone','+62 812 3456 7890');await page.click('#nNext');
ok((await page.textContent('.stepl')).includes('2'),'moved to step 2');
await page.click('#nNext');ok((await page.textContent('#nErr')).length>3,'step 2 needs an item');
await page.fill('[data-i="0"][data-k=item]','Carbon steel pipe 6in');await page.fill('[data-i="0"][data-k=qty]','12');await page.click('#nNext');ok((await page.textContent('#nErr')).includes('unit'),'a unit must be chosen for every item: '+await page.textContent('#nErr'));
ok((await page.locator('[data-i="0"][data-k=unit] option').allTextContents()).join().includes('Kgs')&&(await page.locator('[data-i="0"][data-k=unit] option').allTextContents()).join().includes('Liters'),'unit list has Kgs, Ton, Liters ...');
await page.selectOption('[data-i="0"][data-k=unit]','Pcs');
await page.click('#addItem');await page.fill('[data-i="1"][data-k=item]','Gasket');await page.fill('[data-i="1"][data-k=qty]','40');await page.selectOption('[data-i="1"][data-k=unit]','Kgs');
// reload keeps the draft text
await page.reload();await page.waitForSelector('#hNew');await page.click('#hNew');
ok((await page.textContent('.stepl')).includes('2')&&(await page.inputValue('[data-i="1"][data-k=item]'))==='Gasket','draft survives a reload');
await page.click('#nNext');
await page.click('#nNext');ok((await page.textContent('#nErr')).length>3,'step 3 needs both photos');
await page.setInputFiles('input[data-view=front]',jpgPath);
await page.click('#nNext');ok((await page.textContent('#nErr')).length>3,'1 photo is not enough');
await page.setInputFiles('input[data-view=load]',jpgPath);
await page.waitForTimeout(2500);console.log('DBG imgs',await page.locator('.tile img').count(),'step',await page.textContent('.stepl'),'err',await page.textContent('#nErr'));await page.waitForFunction(()=>document.querySelectorAll('.tile img').length===2,null,{timeout:5000});
await page.screenshot({path:'/tmp/gp_photos.png'});
await page.click('#nNext');
await page.locator('#vNew img[data-zoom]').first().click();await page.waitForSelector('#zm:not(.hidden)');const sc0=await page.evaluate(()=>document.querySelector('#zmImg').style.transform);await page.click('#zmIn');await page.click('#zmIn');const sc1=await page.evaluate(()=>document.querySelector('#zmImg').style.transform);ok(sc0!==sc1&&/scale\(2\.25\)/.test(sc1),'photo zoom in works ('+sc1+')');await page.click('#zmOut');await page.click('#zmRs');ok(/scale\(1\)/.test(await page.evaluate(()=>document.querySelector('#zmImg').style.transform)),'zoom out and reset work');await page.click('#zmX');ok(await page.locator('#zm').isHidden(),'viewer closes');
ok((await page.textContent('#vNew')).includes('BK 1234 XY')&&(await page.textContent('#vNew')).includes('Carbon steel pipe 6in'),'review shows the details');
await page.click('#nSubmit');
await page.waitForSelector('#dPrint');
const ref=(await page.textContent('.ref')).trim();
ok(/^MGP-[A-Z0-9]+-\d{4}-0001$/.test(ref),'serial number is generated at submit: '+ref);
ok((await page.locator('.qr svg').count())===1,'QR shown');
ok(String(m.sheets.Passes.rows[1][8])==='Rejected on receipt: damaged or defective - 6in pipes','reason + details stored as one English text: '+m.sheets.Passes.rows[1][8]);
ok(m.sheets.Passes.rows[1][13]==='Awaiting signatures'&&m.sheets.Items.rows.length===3,'saved to the Sheet');
await page.screenshot({path:'/tmp/gp_done.png'});
// stored photo is stamped & small
const f0=Object.values(m.files)[0];ok(f0.getBytes().length<400000&&f0.getBytes().length>2000,'vehicle photo is compressed ('+f0.getBytes().length+' bytes)');
// ----- print
await page.evaluate(()=>{window.__printed=0;window.print=function(){window.__printed++}});
await page.click('#dPrint');await page.waitForFunction(()=>window.__printed===1);
const pt=await page.textContent('#printArea');
ok(pt.includes('UNIT')&&pt.includes('KGS')&&pt.includes('PCS')&&pt.includes('FRONT VIEW OF THE VEHICLE')&&pt.includes('MATERIAL LOADED IN THE TRUCK')&&pt.includes('Tel: +62 812 3456 7890')&&pt.includes('Page 1 of 1'),'print has separate QTY and UNIT columns, both photos, IC phone and a page number');
ok(!/http|github|script\.google/i.test(pt)&&(await page.locator('#printArea img').count())===3,'print shows no URL anywhere (3 images: logo + 2 photos)');
ok(pt.includes('MATERIAL GATE PASS')&&pt.includes('EOSM-HSSE-FM003')&&pt.includes(ref)&&pt.includes('Budi Santoso')&&pt.includes('SENDING BACK REJECTED ITEMS TO SUPPLIER')&&pt.includes('COPY: SECURITY / CARRIER / STORES')&&pt.includes('Approval By'),'print layout follows FM003');
ok(await page.evaluate(()=>document.querySelector('#printArea .chk').textContent==='X'),'purpose A is ticked');
await page.emulateMedia({media:'print'});
await page.pdf({path:'/tmp/gp_print.pdf',format:'A4',printBackground:true,preferCSSPageSize:true,margin:{top:'0',bottom:'0',left:'0',right:'0'}});ok((fs.readFileSync('/tmp/gp_print.pdf','latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length===1,'printout with photos is exactly one page');
await page.emulateMedia({media:'screen'});
// ----- pass detail + signed upload
await page.click('#dOpen');await page.waitForTimeout(1500);console.log('ERRS',JSON.stringify(errs),(await page.textContent('#vPass')).slice(0,200));await page.waitForSelector('[data-scan]');
ok((await page.textContent('#vPass')).includes('Awaiting signatures')&&!/valid until/i.test(await page.textContent('#vPass')),'detail shows Awaiting signatures, no validity date');
await page.waitForFunction(()=>document.querySelectorAll('#pPhotos img').length===2,null,{timeout:8000});ok(true,'pass page shows both photos (tap to zoom)');
await page.click('[data-scan]');await page.waitForSelector('#scn:not(.hidden)');await page.waitForFunction(()=>document.querySelector('#scV').videoWidth>0,null,{timeout:8000});
ok(await page.locator('#scF').isVisible(),'scanner opens with a page frame (not the photo picker)');
await page.click('#scShot');await page.waitForSelector('#scUse:not(.hidden)');await page.screenshot({path:'/tmp/gp_scan.png'});await page.click('#scUse');await page.waitForSelector('#pSend');
ok((await page.locator('.tile.on img').count())===1,'scanned page added');
await page.click('#pSend');await page.waitForFunction(()=>document.querySelector('#vPass').textContent.includes('Pending release'));
ok(true,'signed copy sent, status Pending release');
ok(m.call({action:'b_list',secret:m.props.BRIDGE_SECRET}).n===1,'pass now appears in the security pending list');
await page.screenshot({path:'/tmp/gp_pass.png'});
// ----- public verify
const vp=await ctx.newPage();await vp.route('https://gp.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:html}));
await vp.route('https://gas.test/**',async r=>{await r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(m.call(JSON.parse(r.request().postData())))});});
await vp.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));await vp.route('https://fonts.gstatic.com/**',r=>r.abort());
await vp.goto('https://gp.test/?v='+ref);await vp.waitForSelector('.vbox');
ok((await vp.textContent('.vbox')).includes('READY FOR SECURITY CHECK')&&!(await vp.textContent('#vVerify')).includes('Budi'),'verify page: ready, and no names shown');
await vp.screenshot({path:'/tmp/gp_verify.png'});
await vp.goto('https://gp.test/?v=MGP-0000-0000');await vp.waitForSelector('.vbox');
ok((await vp.textContent('.vbox')).includes('NOT A VALID PASS'),'verify page: unknown reference is clearly invalid');
await vp.close();
// release by guard through bridge, then IC sees Released
m.call({action:'b_release',secret:m.props.BRIDGE_SECRET,ref,by:'Dedi',role:'Security Guard',decision:'release'});
await page.click('#pBack');await page.waitForSelector('.pas');await page.waitForTimeout(400);
ok((await page.textContent('.pas')).includes('Released'),'IC home list now shows Released');
// ----- languages
await page.click('#lID');ok((await page.textContent('#hNew')).includes('Surat jalan baru'),'ID language');
await page.click('#lMS');ok((await page.textContent('#hNew')).includes('Pas pintu baharu'),'MS language');
await page.screenshot({path:'/tmp/gp_home_ms.png'});
await page.click('#lEN');
// ----- find on a new phone
const c2=await br.newContext({viewport:{width:390,height:844}});const p2=await c2.newPage();
await p2.route('https://gp.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:html}));
await p2.route('https://gas.test/**',async r=>{await r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(m.call(JSON.parse(r.request().postData())))});});
await p2.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));await p2.route('https://fonts.gstatic.com/**',r=>r.abort());
await p2.goto('https://gp.test/');await p2.waitForSelector('#hFind');await p2.click('#hFind');
await p2.fill('#fdRef',ref);await p2.fill('#fdVeh','BK1234XY');await p2.click('#fdGo');await p2.waitForSelector('.chip');
ok((await p2.textContent('#vPass')).includes('Released')&&(await p2.textContent('#vPass')).includes('Dedi'),'new phone: find by reference + vehicle shows the pass and who released it');
// ----- admin
await p2.click('#pBack');await p2.click('#hAdmin');await p2.fill('#adPin',m.props.ADMIN_PIN);await p2.click('#adGo');await p2.waitForSelector('[data-adopen]');
ok((await p2.textContent('#vAdmin')).includes(ref),'admin list');
await p2.click('[data-adopen]');await p2.waitForSelector('#adList');
ok((await p2.textContent('#vAdmin')).includes('RELEASED')&&(await p2.textContent('#vAdmin')).includes('Dedi'),'admin detail shows the audit trail');
await c2.close();
ok(errs.length===0,'no console or page errors '+errs.join(' | '));
await br.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
