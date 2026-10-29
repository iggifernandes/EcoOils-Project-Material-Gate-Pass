const {chromium}=require('playwright');const fs=require('fs'),path=require('path');const m=require('./mock.js')();
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').replace(/var API_URL='[^']*';/,"var API_URL='https://gas.test/exec';");
(async()=>{const br=await chromium.launch();
for(const [n,w,hh] of [['phone',390,844],['tablet',820,1180],['laptop',1440,900]]){
const ctx=await br.newContext({viewport:{width:w,height:hh}});const page=await ctx.newPage();
await page.route('https://gp.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:html}));
await page.route('https://gas.test/**',async r=>{const b=JSON.parse(r.request().postData());const res=m.call(b);await r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(res)})});
await page.route('https://fonts.g*/**',r=>r.abort());
await page.goto('https://gp.test/');await page.waitForSelector('#hNew');
const ph=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=600;const x=c.getContext('2d');for(let i=0;i<400;i++){x.fillStyle='hsl('+(i*7%360)+',50%,50%)';x.fillRect(Math.random()*800,Math.random()*600,80,60);}return c.toDataURL('image/jpeg',.9).split(',')[1];});
for(const [co,veh] of [['GSB','BK 1234 XY'],['WEN','HAND CARRY'],['KKS','BK 9 AB']]){
 await page.evaluate(async([co,veh,ph])=>{const r=await api({action:'create',cid:Math.random()+'',hp:'',purpose:'A',company:co,vehicle:veh,carrier:'Budi Santoso',icNo:'KTP 1271012345678901',purposeText:'Rejected on receipt',dept:'Stores',icRep:'Andi',icPos:'Lead',icPhone:'+62 812 3456 7890',items:[{item:'Pipe',qty:2,unit:'Pcs'}],photos:{front:ph,load:ph}});MINE.unshift({ref:r.ref,token:r.token,vehicle:veh,company:co,ts:Date.now()});saveMine();},[co,veh,ph]);}
await page.evaluate(()=>homeOpen());await page.waitForTimeout(600);
await page.screenshot({path:'/tmp/s_'+n+'_home.png'});
await page.click('#hNew');await page.waitForTimeout(300);await page.screenshot({path:'/tmp/s_'+n+'_new.png'});
console.log(n,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await ctx.close();}
await br.close()})();
