// End to end: the REAL Gate Pass Code.gs and the REAL Patroli Code.gs (v1.41), wired together through UrlFetchApp.
const fs=require('fs'),path=require('path');
const PAT=process.env.PATROLI_DIR||'/home/claude/iggifernandes/ecooils-project-security-patrol';
if(!fs.existsSync(path.join(PAT,'dev','mock.js'))){console.log('SKIP: set PATROLI_DIR to the Patroli repo');process.exit(0);}
const gp=require('./mock.js')();
const pm=require(path.join(PAT,'dev','mock.js'));
let fails=0;const ok=(c,t)=>{console.log((c?'PASS ':'FAIL ')+t);if(!c)fails++};
pm.ctx.makeDanruPins();const dp={};pm.ctx.logs.filter(l=>l.startsWith('DANRU PIN')).forEach(l=>{const x=l.match(/DANRU PIN\s+(.*?)\s+=\s+(\d{6})/);dp[x[1]]=x[2]});
const G=pm.call({action:'d_add',gp:dp['Rendi Irawan'],name:'Dedi Gate'});
// the two scripts are connected exactly as the deploy steps say: URL and secret in Patroli's script properties
pm.props.GATEPASS_URL='https://script.google.com/macros/s/GATEPASS/exec';pm.props.GATEPASS_SECRET=gp.props.BRIDGE_SECRET;
pm.ctx.UrlFetchApp={fetch:(url,opt)=>{const out=gp.ctx.doPost({postData:{contents:opt.payload}}).s;return {getContentText:()=>out};}};
// 1. the IC raises a pass
const jpg=Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(3000,7)]).toString('base64');
const c=gp.call({action:'create',purpose:'A',carrier:'Budi Santoso',icNo:'KTP 1271012345678901',company:'GSB',vehicle:'BK 1234 XY',purposeText:'Return rejected pipes',dept:'Stores',icRep:'Andi Wijaya',icPos:'Lead',icPhone:'+62 812 3456 7890',items:[{item:'Pipe',qty:3,unit:'pcs'}],photos:{front:jpg,load:jpg}});
ok(c.ok,'IC creates pass '+c.ref);
ok(pm.call({action:'gate_list',gp:G.pin}).n===0,'guard sees nothing pending before the signed copy is uploaded');
let g=pm.call({action:'gate_get',gp:G.pin,ref:c.ref});
ok(g.ok&&g.ready===false&&g.why==='no_signed_copy','guard scans it early: not ready, no signed copy');
ok(!pm.call({action:'gate_release',gp:G.pin,ref:c.ref,decision:'release',checks:{signed:true,plate:true,items:true,vehicle:true,idc:true}}).ok,'guard cannot release an unsigned pass');
// 2. signed copy uploaded
gp.call({action:'signed',ref:c.ref,token:c.token,photos:[jpg]});
pm.ctx.CacheService.getScriptCache().remove('gate_pend');
const l=pm.call({action:'gate_list',gp:G.pin});
ok(l.ok&&l.n===1&&l.list[0].ref===c.ref,'pass is now in the guards\' pending list');
g=pm.call({action:'gate_get',gp:G.pin,ref:c.ref});
ok(g.ok&&g.ready&&g.images.signed.length===1&&g.images.front.startsWith('data:image/jpeg'),'guard gets the signed copy and the 2 photos');
// 3. release
const r=pm.call({action:'gate_release',gp:G.pin,ref:c.ref,decision:'release',checks:{signed:true,plate:true,items:true,vehicle:true,idc:true},lat:3.13,lng:99.35,acc:7});
ok(r.ok&&r.status==='Released','guard releases the vehicle');
ok(gp.sheets.Passes.rows[1][23]==='Dedi Gate'&&gp.sheets.Passes.rows[1][13]==='Released','Gate Pass sheet: released by the guard from the PIN');
ok(pm.sheets.GatePass.rows[1][1]===c.ref&&pm.sheets.GatePass.rows[1][3]==='Dedi Gate','Patroli sheet GatePass has the release');
ok(gp.call({action:'verify',ref:c.ref}).status==='Released','the public QR check now shows Released');
ok(gp.call({action:'get',ref:c.ref,token:c.token}).pass.decidedBy==='Dedi Gate','the IC sees who released it');
ok(pm.call({action:'gate_release',gp:dp['Rendi Irawan'],ref:c.ref,decision:'release',checks:{signed:true,plate:true,items:true,vehicle:true,idc:true}}).err==='already_released','a second guard cannot release it again');
// 4. wrong secret
pm.props.GATEPASS_SECRET='nope';
ok(!pm.call({action:'gate_list',gp:G.pin}).ok||pm.call({action:'gate_get',gp:G.pin,ref:c.ref}).ok===false,'wrong secret is refused by the Gate Pass script');
console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
