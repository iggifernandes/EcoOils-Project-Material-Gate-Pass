const m=require('./mock.js')();
let fails=0;const ok=(c,t)=>{console.log((c?'PASS ':'FAIL ')+t);if(!c)fails++};
const jpg=Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(3000,7)]).toString('base64');
const photos={front:jpg,top:jpg,left:jpg,right:jpg};
const base={action:'create',purpose:'A',carrier:'Budi Santoso',icNo:'KTP 1271012345678901',company:'GSB',vehicle:'bk 1234 xy',purposeText:'Return rejected pipes to supplier',dept:'Stores',icRep:'Andi Wijaya',icPos:'Store lead',items:[{item:'Carbon steel pipe 6in',qty:12,unit:'pcs'},{item:'Gasket',qty:40,unit:''}],photos,hp:''};
const cfg=m.call({action:'config'});
ok(cfg.ok&&cfg.companies.join()==='GSB,WEN,KKS,PBS'&&cfg.depts.length===4&&cfg.maxItems===15,'config lists companies and departments');
ok(m.props.ADMIN_PIN&&/^\d{6}$/.test(m.props.ADMIN_PIN)&&m.props.BRIDGE_SECRET.length>=32,'setup made ADMIN_PIN and BRIDGE_SECRET');
const r1=m.call(base);
ok(r1.ok&&/^MGP-[A-Z0-9]+-\d{4}-0001$/.test(r1.ref)&&r1.token.length===32,'create returns server serial '+r1.ref);
const r2=m.call(base);
ok(r2.ok&&r2.ref.endsWith('-0002'),'second pass gets the next serial '+r2.ref);
ok(m.sheets.Passes.rows[1][7]==='BK 1234 XY'&&m.sheets.Passes.rows[1][13]==='Awaiting signatures'&&m.sheets.Passes.rows[1][14]!==r1.token,'vehicle upper-cased, status Awaiting signatures, token stored hashed only');
ok(m.sheets.Items.rows.length===1+4&&m.sheets.Items.rows[1][2]==='Carbon steel pipe 6in','items stored');
ok(Object.keys(m.files).length===8,'4 photos per pass saved to Drive');
// validation
ok(m.call({...base,hp:'x'}).err==='bad','honeypot refused');
ok(m.call({...base,vehicle:''}).err==='bad_vehicle','vehicle required');
ok(m.call({...base,items:[]}).err==='bad_items','items required');
ok(m.call({...base,items:Array(16).fill({item:'x1',qty:1})}).err==='bad_items','max 15 items');
ok(m.call({...base,items:[{item:'ab',qty:-1}]}).err==='bad_items','qty must be positive');
ok(m.call({...base,photos:{...photos,top:'AAAA'}}).err==='bad_photo','4 real jpeg photos required');
ok(m.call({...base,dept:'Kitchen'}).err==='bad_dept','department must be on the list');
ok(m.call({...base,purpose:'C'}).err==='bad_purpose','purpose A or B');
// token protection
ok(m.call({action:'get',ref:r1.ref,token:'wrong'}).err==='notfound','wrong token cannot read');
const g=m.call({action:'get',ref:r1.ref,token:r1.token});
ok(g.ok&&g.pass.items.length===2&&g.pass.status==='Awaiting signatures'&&g.pass.icNo==='KTP 1271012345678901','right token reads the pass');
// verify page is public and minimal
const v=m.call({action:'verify',ref:r1.ref});
ok(v.ok&&v.found&&v.status==='Awaiting signatures'&&v.ready===false&&!('carrier' in v)&&!('icNo' in v)&&!JSON.stringify(v).includes('Budi'),'public verify shows status only, no names or ID numbers');
ok(m.call({action:'verify',ref:'MGP-0000-9999'}).found===false,'unknown reference not found');
// guard cannot release before the signed copy is uploaded
const sec=m.props.BRIDGE_SECRET;
ok(m.call({action:'b_list',secret:'bad'}).err==='auth','bridge refuses a wrong secret');
ok(m.call({action:'b_list',secret:sec}).n===0,'nothing pending before signed copy');
let rel=m.call({action:'b_release',secret:sec,ref:r1.ref,by:'Dedi',decision:'release'});
ok(rel.err==='not_ready','cannot release without signed copy');
// upload signed copy
ok(m.call({action:'signed',ref:r1.ref,token:'bad',photos:[jpg]}).err==='notfound','signed upload needs the token');
ok(m.call({action:'signed',ref:r1.ref,token:r1.token,photos:['AAAA']}).err==='bad_photo','signed copy must be an image');
const s=m.call({action:'signed',ref:r1.ref,token:r1.token,photos:[jpg,jpg]});
ok(s.ok&&s.status==='Pending release'&&s.validUntil>Date.now(),'signed copy uploaded, pending release');
const pl=m.call({action:'b_list',secret:sec});
ok(pl.n===1&&pl.list[0].ref===r1.ref,'pending list shows the pass');
const bg=m.call({action:'b_get',secret:sec,ref:r1.ref});
ok(bg.ok&&bg.ready&&bg.images.front.startsWith('data:image/jpeg;base64,')&&bg.images.signed.length===2&&bg.pass.carrier==='Budi Santoso','guard get returns pass, 4 views and signed copy images');
// reject needs reason, release logs guard
ok(m.call({action:'b_release',secret:sec,ref:r1.ref,by:'Dedi',decision:'reject'}).err==='need_reason','reject needs a reason');
rel=m.call({action:'b_release',secret:sec,ref:r1.ref,by:'Dedi',role:'Security Guard',decision:'release',lat:3.13,lng:99.35,acc:9,checks:{plate:true}});
ok(rel.ok&&rel.status==='Released','released');
const row=m.sheets.Passes.rows[1];
ok(row[23]==='Dedi'&&row[13]==='Released'&&row[26]===3.13,'release records guard name, time and location');
ok(m.call({action:'b_release',secret:sec,ref:r1.ref,by:'Other',decision:'release'}).err==='already_released','second release refused with who and when');
ok(m.call({action:'verify',ref:r1.ref}).status==='Released','verify shows Released');
ok(m.call({action:'signed',ref:r1.ref,token:r1.token,photos:[jpg]}).err==='not_open','cannot upload after release');
ok(m.call({action:'cancel',ref:r1.ref,token:r1.token}).err==='not_open','cannot cancel after release');
// cancel before release
const c=m.call({action:'cancel',ref:r2.ref,token:r2.token,reason:'wrong items'});
ok(c.ok&&m.call({action:'verify',ref:r2.ref}).status==='Cancelled','IC can cancel an open pass');
// reject path
const r3=m.call(base);m.call({action:'signed',ref:r3.ref,token:r3.token,photos:[jpg]});
const rj=m.call({action:'b_release',secret:sec,ref:r3.ref,by:'Rian',decision:'reject',reason:'quantity does not match'});
ok(rj.ok&&rj.status==='Rejected'&&m.call({action:'verify',ref:r3.ref}).status==='Rejected','guard can reject with a reason');
// expiry
const r4=m.call(base);m.call({action:'signed',ref:r4.ref,token:r4.token,photos:[jpg]});
const real=Date.now.bind(Date);Date.now=()=>real()+49*3600000;
ok(m.call({action:'verify',ref:r4.ref}).status==='Expired'&&m.call({action:'b_list',secret:sec}).n===0,'pass expires 48 h after the signed copy and leaves the pending list');
ok(m.call({action:'b_release',secret:sec,ref:r4.ref,by:'Dedi',decision:'release'}).err==='expired','expired pass cannot be released');
Date.now=real;
// mine + find
const mi=m.call({action:'mine',list:[{ref:r1.ref,token:r1.token},{ref:r2.ref,token:'bad'}]});
ok(mi.list[0].status==='Released'&&mi.list[1].gone===true,'my passes: right token shows status, wrong token hidden');
ok(m.call({action:'find',ref:r1.ref,vehicle:'x'}).err==='notfound','find needs the right vehicle');
const f=m.call({action:'find',ref:r1.ref,vehicle:'BK1234XY'});
ok(f.ok&&f.token!==r1.token&&m.call({action:'get',ref:r1.ref,token:f.token}).ok&&!m.call({action:'get',ref:r1.ref,token:r1.token}).ok,'find by reference + vehicle gives this phone a fresh token and retires the old one');
// admin
ok(m.call({action:'a_list',pin:'000000'}).err==='pin','admin needs the PIN');
const al=m.call({action:'a_list',pin:m.props.ADMIN_PIN});
ok(al.ok&&al.list.length===4&&al.counts.Released===1,'admin list and counts');
const ag=m.call({action:'a_get',pin:m.props.ADMIN_PIN,ref:r1.ref});
ok(ag.ok&&ag.links.front.startsWith('https://drive')&&ag.log.some(x=>x.ev==='RELEASED'),'admin get has Drive links and audit trail');
// daily cap
m.sheets.Config.rows.forEach(r=>{if(r[0]==='COMPANY_DAILY_CAP')r[1]='2'});
ok(m.call({...base,company:'WEN'}).ok&&m.call({...base,company:'WEN'}).ok&&m.call({...base,company:'WEN'}).err==='daily_cap','daily cap per company');
// retry with the same client id does not create a second pass
const before=m.sheets.Passes.rows.length;
const c1=m.call({...base,company:'KKS',cid:'abc123'}),c2=m.call({...base,company:'KKS',cid:'abc123'});
ok(c1.ok&&c2.ok&&c2.dup&&c1.ref===c2.ref&&m.sheets.Passes.rows.length===before+1&&m.call({action:'get',ref:c2.ref,token:c2.token}).ok,'same client id = same pass (lost reply retry), fresh token');
