var VERSION='v1.4';
var PHV=['front','load'];
var APP_URL='https://iggifernandes.github.io/EcoOils-Project-Material-Gate-Pass/';
var API_URL='https://script.google.com/macros/s/AKfycbxULvNJReaniGRTFWKY507I0AZD5YLP3mBBjAyFFA-7z4nI0-LPncZbPZTajS89Jp0Z/exec';
var lang='en';
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch(e){}return null;}
(function(){var l=ls('gp_lang');if(l&&T[l])lang=l;else{var n=(navigator.language||'').toLowerCase();lang=/^id/.test(n)?'id':/^ms/.test(n)?'ms':'en';}})();
function tr(k){return (T[lang]&&T[lang][k])||T.en[k]||k;}
var $=function(id){return document.getElementById(id);};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function pad(n){return (n<10?'0':'')+n;}
var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var SRVOFF=0;function nowMs(){return Date.now()+SRVOFF;}
function fmtDT(ms){var d=new Date(ms+7*3600000);return pad(d.getUTCDate())+' '+MON[d.getUTCMonth()]+' '+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+' WIB';}
function fmtD(iso){var m=/^(\d{4})-(\d\d)-(\d\d)/.exec(String(iso));return m?(+m[3])+' '+MON[+m[2]-1]+' '+m[1]:String(iso||'');}
function stampTime(){var d=new Date(nowMs()+7*3600000);return pad(d.getUTCDate())+' '+MON[d.getUTCMonth()]+' '+d.getUTCFullYear()+'  '+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+':'+pad(d.getUTCSeconds())+' WIB';}
function errText(c){var k='err_'+c;return (T[lang]&&T[lang][k])||T.en[k]||String(c||'');}
var ST={'Awaiting signatures':['stWait','wait','gWait'],'Pending release':['stPend','pend','gPend'],'Released':['stRel','rel','gRel'],'Rejected':['stRej','bad','gRej'],'Cancelled':['stCan','off','gCan'],'Expired':['stExp','off','gExp']};
function chip(st){var x=ST[st]||['stWait','wait','gWait'];return '<span class="chip '+x[1]+'">'+esc(tr(x[0]))+'</span>';}

/* ===== server ===== */
function api(body,ms){
  if(!API_URL)return Promise.reject(new Error('conf'));
  var ctl=window.AbortController?new AbortController():null,t=ctl?setTimeout(function(){ctl.abort();},ms||30000):null;
  return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),redirect:'follow',signal:ctl?ctl.signal:undefined})
    .then(function(r){return r.json();}).then(function(j){if(t)clearTimeout(t);if(j&&j.now)SRVOFF=j.now-Date.now();return j;},function(e){if(t)clearTimeout(t);throw e;});
}

/* ===== state ===== */
var CFG={units:['Pcs','Units','Kgs','Ton','Liters','Meters','Sets','Rolls','Drums','Bags','Boxes','Pallets','Lots'],companies:['GSB','WEN','KKS','PBS'],depts:['Project Eng','Discipline Eng','HSSE','Stores'],validHours:48,maxItems:15,siteLead:''};
try{var c0=JSON.parse(ls('gp_cfg')||'null');if(c0&&c0.companies)CFG=c0;}catch(e){}
var MINE=[];try{MINE=JSON.parse(ls('gp_mine')||'[]');if(!Array.isArray(MINE))MINE=[];}catch(e){MINE=[];}
function saveMine(){ls('gp_mine',JSON.stringify(MINE.slice(0,60)));}
var SUM={};var CUR=null;var PASS=null;var LAST=null;
var D=newDraft();
function icDigits(){return String(D.icNo||'').replace(/[\s.\-]/g,'');}
var REASONS={A:['rA1','rA2','rA3','rA4','rA5','rA6'],B:['rB1','rB2','rB3','rB4','rB5','rB6','rB7']};
/* The printed form is in English, so the stored reason is the English text whatever language the screen is in. */
function purposeFull(){var d=String(D.purposeText||'').trim();if(!D.reason||D.reason==='rOther')return d;var r=T.en[D.reason]||'';return d?r+' - '+d:r;}
function icPhoneOk(){var t=String(D.icPhone||'').trim(),d=t.replace(/\D/g,'');return /^\+?[0-9][0-9 \-]{6,18}$/.test(t)&&d.length>=8&&d.length<=15;}
function icFull(){var d=icDigits();return (D.icType||'')+' '+d;}
function newDraft(){return {purpose:'',company:'',companyOther:'',vehicle:'',carrier:'',icType:'',icNo:'',icPhone:'',purposeText:'',reason:'',dept:'',icRep:'',icPos:'',items:[{item:'',qty:'',unit:''}],photos:{},cid:Date.now().toString(36)+Math.random().toString(36).slice(2,10),step:1};}
function saveDraft(){var o={};Object.keys(D).forEach(function(k){if(k!=='photos')o[k]=D[k];});ls('gp_draft',JSON.stringify(o));}
try{var d0=JSON.parse(ls('gp_draft')||'null');if(d0&&d0.items){D=Object.assign(newDraft(),d0);D.photos={};}}catch(e){}

/* ===== views ===== */
var VIEWS=['vHome','vNew','vDone','vPass','vFind','vVerify','vAdmin'];
function show(id){VIEWS.forEach(function(v){$(v).classList.toggle('hidden',v!==id);});window.scrollTo(0,0);}
function h1(t){return '<h1>'+esc(t)+'</h1>';}
function applyLang(){
  document.documentElement.lang=lang;['EN','ID','MS'].forEach(function(l){$('l'+l).classList.toggle('on',lang===l.toLowerCase());});
  $('ver').textContent=VERSION;$('banner').innerHTML=API_URL?'':'<div class="banner">'+esc(tr('notConf'))+'</div>';
  rerender();
}
function setLang(l){lang=l;ls('gp_lang',l);applyLang();}
function rerender(){
  if(!$('vHome').classList.contains('hidden'))homeDraw();
  else if(!$('vNew').classList.contains('hidden'))newDraw(true);
  else if(!$('vDone').classList.contains('hidden'))doneDraw();
  else if(!$('vPass').classList.contains('hidden'))passDraw();
  else if(!$('vFind').classList.contains('hidden'))findDraw();
  else if(!$('vVerify').classList.contains('hidden'))verifyDraw();
  else if(!$('vAdmin').classList.contains('hidden'))adminDraw();
}
['EN','ID','MS'].forEach(function(l){$('l'+l).addEventListener('click',function(){setLang(l.toLowerCase());});});

/* ===== home ===== */
function homeOpen(){show('vHome');homeDraw();homeLoad();}
function homeDraw(){
  var h=h1(tr('title'))+'<button class="btn" id="hNew" type="button">'+esc(tr('newPass'))+'</button>';
  h+='<div class="card"><b>'+esc(tr('how'))+'</b><ol style="margin:8px 0 0;padding-left:20px"><li>'+esc(tr('how1'))+'</li><li>'+esc(tr('how2'))+'</li><li>'+esc(tr('how3'))+'</li><li>'+esc(tr('how4'))+'</li></ol></div>';
  h+='<h2>'+esc(tr('mine'))+'</h2>';
  if(!MINE.length)h+='<p class="note">'+esc(tr('noneMine'))+'</p>';
  MINE.slice(0,30).forEach(function(m){var s=SUM[m.ref];h+='<button class="pas" type="button" data-open="'+esc(m.ref)+'"><span><b>'+esc(m.ref)+'</b><small>'+esc((m.company||'')+' · '+(m.vehicle||''))+'</small></span>'+(s&&!s.gone?chip(s.status):'')+'</button>';});
  h+='<div class="links"><button id="hRefresh" type="button">'+esc(tr('refresh'))+'</button> · <button id="hFind" type="button">'+esc(tr('find'))+'</button> · <button id="hAdmin" type="button">'+esc(tr('admin'))+'</button></div>';
  $('vHome').innerHTML=h;
}
function homeLoad(){
  if(!API_URL)return;
  api({action:'config'}).then(function(r){if(r&&r.ok){CFG={units:(r.units&&r.units.length?r.units:CFG.units),companies:r.companies,depts:r.depts,validHours:r.validHours,maxItems:r.maxItems||15,siteLead:r.siteLead||''};ls('gp_cfg',JSON.stringify(CFG));}},function(){});
  if(!MINE.length)return;
  api({action:'mine',list:MINE.slice(0,40).map(function(m){return {ref:m.ref,token:m.token};})}).then(function(r){
    if(!r||!r.ok)return;r.list.forEach(function(s){SUM[s.ref]=s;});if(!$('vHome').classList.contains('hidden'))homeDraw();
  },function(){});
}
$('vHome').addEventListener('click',function(e){
  var t=e.target.closest('button');if(!t)return;
  if(t.id==='hNew'){newOpen();}
  else if(t.id==='hRefresh'){homeLoad();}
  else if(t.id==='hFind'){findOpen();}
  else if(t.id==='hAdmin'){adminOpen();}
  else if(t.getAttribute('data-open')){passOpen(t.getAttribute('data-open'));}
});

/* ===== new pass wizard ===== */
function newOpen(){if(D.done){D=newDraft();}D.step=D.step||1;show('vNew');newDraw();}
function opt(sel,k,b,txt){return '<button type="button" class="opt'+(sel?' sel':'')+'" data-purpose="'+k+'"><b>'+b+'</b><span>'+esc(txt)+'</span></button>';}
function newDraw(keep){
  var st=D.step,sc=window.pageYOffset,h='';
  h+=h1(tr('newPass'));
  h+='<div class="steps">'+[1,2,3,4].map(function(i){return '<i class="'+(i<=st?'on':'')+'"></i>';}).join('')+'</div><div class="stepl">'+esc(tr('stepOf').replace('{a}',st).replace('{b}',4))+' · '+esc(tr('s'+st))+'</div>';
  if(st===1){
    h+='<label>'+esc(tr('purposeLbl'))+'</label>'+opt(D.purpose==='A','A','A.',tr('purA'))+opt(D.purpose==='B','B','B.',tr('purB'));
    h+='<label for="fCompany">'+esc(tr('company'))+'</label><select id="fCompany" data-f="company"><option value="">'+esc(tr('companyPick'))+'</option>'+CFG.companies.map(function(c){return '<option value="'+esc(c)+'"'+(D.company===c?' selected':'')+'>'+esc(c)+'</option>';}).join('')+'<option value="__other"'+(D.company==='__other'?' selected':'')+'>'+esc(tr('other'))+'</option></select>';
    if(D.company==='__other')h+='<label for="fCompanyOther">'+esc(tr('companyOther'))+'</label><input id="fCompanyOther" data-f="companyOther" maxlength="60" value="'+esc(D.companyOther)+'">';
    h+='<label for="fVehicle">'+esc(tr('vehicle'))+'</label><input id="fVehicle" data-f="vehicle" maxlength="20" autocapitalize="characters" autocomplete="off" value="'+esc(D.vehicle)+'"><div class="note">'+esc(tr('vehicleHelp'))+'</div>';
    h+='<label for="fCarrier">'+esc(tr('carrier'))+'</label><input id="fCarrier" data-f="carrier" maxlength="60" autocomplete="off" value="'+esc(D.carrier)+'">';
    h+='<label for="fIcType">'+esc(tr('icType'))+'</label><select id="fIcType" data-f="icType"><option value="">'+esc(tr('icTypePick'))+'</option><option value="KTP"'+(D.icType==='KTP'?' selected':'')+'>'+esc(tr('icTypeKTP'))+'</option><option value="SIM"'+(D.icType==='SIM'?' selected':'')+'>'+esc(tr('icTypeSIM'))+'</option></select>';
    h+='<label for="fIcNo">'+esc(tr('icNo'))+'</label><input id="fIcNo" data-f="icNo" inputmode="numeric" maxlength="24" autocomplete="off" value="'+esc(D.icNo)+'"><div class="note">'+esc(tr('icHelp'))+'</div>';
    h+='<label for="fReason">'+esc(tr('reasonLbl'))+'</label>';
    if(!D.purpose)h+='<div class="note">'+esc(tr('purposeFirst'))+'</div>';
    else h+='<select id="fReason" data-f="reason"><option value="">'+esc(tr('reasonPick'))+'</option>'+REASONS[D.purpose].map(function(k){return '<option value="'+k+'"'+(D.reason===k?' selected':'')+'>'+esc(tr(k))+'</option>';}).join('')+'<option value="rOther"'+(D.reason==='rOther'?' selected':'')+'>'+esc(tr('rOther'))+'</option></select>';
    h+='<label for="fPT">'+esc(D.reason==='rOther'?tr('reasonDescribe'):tr('reasonDetails'))+'</label><textarea id="fPT" data-f="purposeText" maxlength="260">'+esc(D.purposeText)+'</textarea>';
    h+='<label for="fDept">'+esc(tr('dept'))+'</label><select id="fDept" data-f="dept"><option value="">'+esc(tr('deptPick'))+'</option>'+CFG.depts.map(function(c){return '<option value="'+esc(c)+'"'+(D.dept===c?' selected':'')+'>'+esc(c)+'</option>';}).join('')+'</select>';
    h+='<label for="fRep">'+esc(tr('icRep'))+'</label><input id="fRep" data-f="icRep" maxlength="60" autocomplete="off" value="'+esc(D.icRep)+'">';
    h+='<label for="fPos">'+esc(tr('icPos'))+'</label><input id="fPos" data-f="icPos" maxlength="40" autocomplete="off" value="'+esc(D.icPos)+'">';
    h+='<label for="fPhone">'+esc(tr('icPhone'))+'</label><input id="fPhone" data-f="icPhone" type="tel" inputmode="tel" maxlength="20" autocomplete="off" placeholder="+62 812 3456 7890" value="'+esc(D.icPhone)+'">';
  }else if(st===2){
    D.items.forEach(function(it,i){
      h+='<div class="irow"><label style="margin-top:0">'+(i+1)+'. '+esc(tr('itemName'))+'</label><input data-i="'+i+'" data-k="item" maxlength="80" value="'+esc(it.item)+'" autocomplete="off"><div class="row3"><div><label style="margin-top:0">'+esc(tr('qty'))+'</label><input data-i="'+i+'" data-k="qty" inputmode="decimal" maxlength="8" value="'+esc(it.qty)+'"></div><div><label style="margin-top:0">'+esc(tr('unit'))+'</label><select data-i="'+i+'" data-k="unit"><option value="">'+esc(tr('unitPick'))+'</option>'+CFG.units.map(function(u){return '<option value="'+esc(u)+'"'+(it.unit===u?' selected':'')+'>'+esc(u)+'</option>';}).join('')+'</select></div></div>'+(D.items.length>1?'<button class="btn danger sm" type="button" data-rm="'+i+'">'+esc(tr('remove'))+'</button>':'')+'</div>';
    });
    h+=D.items.length<CFG.maxItems?'<button class="btn ghost" id="addItem" type="button">+ '+esc(tr('addItem'))+'</button>':'<div class="note">'+esc(tr('itemsMax'))+'</div>';
  }else if(st===3){
    h+='<p class="note">'+esc(tr('photoHelp'))+'</p><div class="tiles">';
    PHV.forEach(function(v){h+=tileHtml(v);});h+='</div>'+tilesZoomBar()+'<div>';
    h+='</div>';
  }else{
    var co=D.company==='__other'?D.companyOther:D.company;
    h+='<p class="note">'+esc(tr('reviewHelp'))+'</p><p class="note"><b>'+esc(tr('icCheck'))+'</b></p><div class="card"><div class="kv"><span>'+esc(tr('purposeShort'))+'</span><span>'+esc(D.purpose+'. '+(D.purpose==='A'?tr('purA'):tr('purB')))+'</span><span>'+esc(tr('compShort'))+'</span><span>'+esc(co)+'</span><span>'+esc(tr('vehShort'))+'</span><span>'+esc(D.vehicle.toUpperCase())+'</span><span>'+esc(tr('driver'))+'</span><span>'+esc(D.carrier)+' ('+esc(icFull())+')</span><span>'+esc(tr('ecoDept'))+'</span><span>'+esc(D.dept)+'</span><span>'+esc(tr('icRepShort'))+'</span><span>'+esc(D.icRep+(D.icPos?', '+D.icPos:'')+(D.icPhone?', '+D.icPhone:''))+'</span><span>'+esc(tr('purposeText'))+'</span><span>'+esc(purposeFull())+'</span></div>';
    h+='<table class="it"><tr><th>#</th><th>'+esc(tr('itemName'))+'</th><th>'+esc(tr('qty'))+'</th><th>'+esc(tr('unit'))+'</th></tr>'+validItems().map(function(it,i){return '<tr><td>'+(i+1)+'</td><td>'+esc(it.item)+'</td><td>'+esc(it.qty)+'</td><td>'+esc(it.unit)+'</td></tr>';}).join('')+'</table>';
    h+='<div class="row2" style="margin-top:10px">'+PHV.map(function(v){return '<div class="pv"><small class="note">'+esc(tr('ph_'+v))+'</small><img alt="" data-zoom="data:image/jpeg;base64,'+D.photos[v]+'" src="data:image/jpeg;base64,'+D.photos[v]+'"></div>';}).join('')+'</div></div>';
  }
  h+='<div class="err" id="nErr"></div>';
  if(st<4)h+='<button class="btn" id="nNext" type="button">'+esc(tr('next'))+'</button>';else h+='<button class="btn amber" id="nSubmit" type="button">'+esc(tr('submit'))+'</button>';
  h+='<button class="btn ghost" id="nBack" type="button">'+esc(st>1?tr('back'):tr('close'))+'</button>';
  $('vNew').innerHTML=h;
  if(keep)window.scrollTo(0,sc);
}
function tileHtml(v){var p=D.photos[v];return '<label class="tile'+(p?' on':' ph')+'" style="margin:0" data-tile="'+v+'">'+(p?'<img alt="" src="data:image/jpeg;base64,'+p+'"><span class="ck">&#10003;</span>':'')+'<span>'+esc(tr('ph_'+v))+'</span><small>'+esc(p?tr('retake'):tr('take'))+'</small><input type="file" accept="image/*" capture="environment" data-view="'+v+'"></label>';}
function tilesZoomBar(){return '<div class="row2" style="margin-top:6px">'+PHV.map(function(v){return D.photos[v]?'<button class="btn ghost sm" type="button" data-zv="'+v+'">&#128269; '+esc(tr('zoom'))+'</button>':'<span></span>';}).join('')+'</div>';}
function validItems(){return D.items.filter(function(it){return String(it.item).trim().length>=2&&Number(String(it.qty).replace(',','.'))>0&&CFG.units.indexOf(String(it.unit||''))>=0;}).map(function(it){return {item:String(it.item).trim(),qty:Number(String(it.qty).replace(',','.')),unit:String(it.unit||'').trim()};});}
function nerr(k,field){var e=$('nErr');if(e)e.textContent=tr(k);if(field){var f=document.querySelector(field);if(f){f.classList.add('bad');try{f.scrollIntoView({block:'center'});}catch(x){}}}}
function stepOk(){
  var s=D.step,co=D.company==='__other'?D.companyOther:D.company;
  if(s===1){
    if(D.purpose!=='A'&&D.purpose!=='B'){nerr('f_purpose');return false;}
    if(!co||String(co).trim().length<2){nerr('f_company',D.company==='__other'?'#fCompanyOther':'#fCompany');return false;}
    if(D.vehicle.trim().length<2){nerr('f_vehicle','#fVehicle');return false;}
    if(D.carrier.trim().length<2){nerr('f_carrier','#fCarrier');return false;}
    if(!D.icType){nerr('f_icType','#fIcType');return false;}
    if(!D.icNo.trim()){nerr('f_icNo','#fIcNo');return false;}
    if(!/^\d+$/.test(icDigits())||icDigits().length!==(D.icType==='KTP'?16:12)){nerr(D.icType==='KTP'?'f_icKTP':'f_icSIM','#fIcNo');return false;}
    if(!D.reason){nerr('f_reason','#fReason');return false;}
    if(D.reason==='rOther'&&D.purposeText.trim().length<3){nerr('f_reasonOther','#fPT');return false;}
    if(!D.dept){nerr('f_dept','#fDept');return false;}
    if(D.icRep.trim().length<2){nerr('f_icRep','#fRep');return false;}
    if(!icPhoneOk()){nerr('f_icPhone','#fPhone');return false;}
  }else if(s===2){
    var nu=D.items.some(function(it){return String(it.item).trim().length>=2&&Number(String(it.qty).replace(',','.'))>0&&CFG.units.indexOf(String(it.unit||''))<0;});
    if(nu){nerr('f_unit');return false;}
    if(!validItems().length){nerr('f_items');return false;}}
  else if(s===3){if(!PHV.every(function(v){return D.photos[v];})){nerr('f_photos');return false;}}
  return true;
}
$('vNew').addEventListener('input',function(e){
  var t=e.target,f=t.getAttribute('data-f'),i=t.getAttribute('data-i');
  if(f){D[f]=t.value;t.classList.remove('bad');saveDraft();}
  else if(i!==null){D.items[+i][t.getAttribute('data-k')]=t.value;saveDraft();}
});
$('vNew').addEventListener('change',function(e){
  var t=e.target,f=t.getAttribute('data-f');
  if(f==='company'){D.company=t.value;saveDraft();newDraw(true);}
  if(f==='reason'){D.reason=t.value;saveDraft();newDraw(true);}
  if(t.getAttribute('data-view')){
    var f0=t.files&&t.files[0],v=t.getAttribute('data-view');if(!f0)return;
    var co=D.company==='__other'?D.companyOther:D.company;
    shrink(f0,[stampTime(),tr('ph_'+v)+' | '+(D.vehicle||'').toUpperCase()+' | '+co],1100,0.6).then(function(p){D.photos[v]=p;var el=document.querySelector('[data-tile="'+v+'"]');if(el)el.outerHTML=tileHtml(v);var er0=$('nErr');if(er0)er0.textContent='';},function(){var er=$('nErr');if(er)er.textContent=tr('err_bad_photo');});
  }
});
$('vNew').addEventListener('click',function(e){
  var t=e.target.closest('button');if(!t)return;
  if(t.getAttribute('data-zv')){var pz=D.photos[t.getAttribute('data-zv')];if(pz)zoomOpen('data:image/jpeg;base64,'+pz);return;}
  if(t.getAttribute('data-purpose')){var np=t.getAttribute('data-purpose');if(np!==D.purpose&&D.reason!=='rOther')D.reason='';D.purpose=np;saveDraft();newDraw(true);}
  else if(t.getAttribute('data-rm')!==null){D.items.splice(+t.getAttribute('data-rm'),1);saveDraft();newDraw(true);}
  else if(t.id==='addItem'){D.items.push({item:'',qty:'',unit:''});saveDraft();newDraw(true);}
  else if(t.id==='nNext'){if(stepOk()){D.step++;saveDraft();newDraw();window.scrollTo(0,0);}}
  else if(t.id==='nBack'){if(D.step>1){D.step--;saveDraft();newDraw();window.scrollTo(0,0);}else homeOpen();}
  else if(t.id==='nSubmit'){submit();}
});
function shrink(file,lines,max,q){
  return new Promise(function(res,rej){
    var u=URL.createObjectURL(file),im=new Image();
    im.onload=function(){
      var k=Math.min(1,(max||1100)/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement('canvas');
      c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);var x=c.getContext('2d');x.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);
      if(lines&&lines.length){
        var fs=Math.max(15,Math.round(c.width/24)),pd=Math.round(fs*0.45),bh=lines.length*Math.round(fs*1.25)+pd*2;
        x.fillStyle='rgba(0,0,0,0.62)';x.fillRect(0,c.height-bh,c.width,bh);x.fillStyle='#fff';x.textBaseline='top';
        lines.forEach(function(t,i){x.font=(i===0?'bold ':'')+fs+'px Arial,Helvetica,sans-serif';var s=t;while(s.length>4&&x.measureText(s).width>c.width-pd*2)s=s.slice(0,-2);if(s!==t)s=s.replace(/\s+$/,'')+'...';x.fillText(s,pd,c.height-bh+pd+i*Math.round(fs*1.25));});
      }
      res(c.toDataURL('image/jpeg',q||0.6).split(',')[1]);
    };
    im.onerror=function(){URL.revokeObjectURL(u);rej();};im.src=u;
  });
}
var BUSY=false;
function submit(){
  if(BUSY)return;if(!stepOk())return;BUSY=true;
  var co=D.company==='__other'?D.companyOther:D.company,its=validItems();
  var body={action:'create',cid:D.cid,hp:'',purpose:D.purpose,company:co.trim(),vehicle:D.vehicle.trim(),carrier:D.carrier.trim(),icNo:icFull(),purposeText:purposeFull(),dept:D.dept,icRep:D.icRep.trim(),icPhone:D.icPhone.trim(),icPos:D.icPos.trim(),items:its,photos:D.photos};
  $('nSubmit').disabled=true;$('nErr').innerHTML='<span class="sp"></span>'+esc(tr('sending'));
  api(body,120000).then(function(r){return r;},function(){return null;}).then(function(r){
    BUSY=false;
    if(!r){var e1=$('nErr');if(e1)e1.textContent=tr('err_net');var b=$('nSubmit');if(b)b.disabled=false;return;}
    if(!r.ok){var e2=$('nErr');if(e2)e2.textContent=errText(r.err);var b2=$('nSubmit');if(b2)b2.disabled=false;return;}
    LAST={ref:r.ref,date:r.date,purpose:D.purpose,carrier:body.carrier,icNo:body.icNo,company:body.company,vehicle:body.vehicle.toUpperCase(),purposeText:body.purposeText,dept:body.dept,icRep:body.icRep,icPos:body.icPos,icPhone:body.icPhone,items:its,siteLead:CFG.siteLead,photos:{front:D.photos.front,load:D.photos.load}};
    MINE.unshift({ref:r.ref,token:r.token,vehicle:LAST.vehicle,company:LAST.company,ts:Date.now()});saveMine();
    SUM[r.ref]={ref:r.ref,status:'Awaiting signatures'};
    D=newDraft();ls('gp_draft',null);
    doneOpen();
  });
}

/* ===== done ===== */
function doneOpen(){show('vDone');doneDraw();}
function doneDraw(){
  if(!LAST){homeOpen();return;}
  var h=h1(tr('doneTitle'))+'<div class="note" style="text-align:center">'+esc(tr('refLbl'))+'</div><div class="ref">'+esc(LAST.ref)+'</div>'+'<div class="qr">'+qrSvg(verifyUrl(LAST.ref))+'</div>';
  h+='<p>'+esc(tr('doneNext'))+'</p><button class="btn amber" id="dPrint" type="button">'+esc(tr('printNow'))+'</button><button class="btn ghost" id="dOpen" type="button">'+esc(tr('openPass'))+'</button>';
  $('vDone').innerHTML=h;
}
$('vDone').addEventListener('click',function(e){var t=e.target.closest('button');if(!t)return;if(t.id==='dPrint')printPass(LAST);else if(t.id==='dOpen')passOpen(LAST.ref);});

/* ===== QR and print ===== */
function verifyUrl(ref){return APP_URL+'?v='+encodeURIComponent(ref);}
function qrSvg(text){
  try{var q=qrcode(0,'M');q.addData(text);q.make();var n=q.getModuleCount(),p='';
    for(var r=0;r<n;r++)for(var c=0;c<n;c++)if(q.isDark(r,c))p+='M'+c+' '+r+'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 '+(n+4)+' '+(n+4)+'" shape-rendering="crispEdges"><rect x="-2" y="-2" width="'+(n+4)+'" height="'+(n+4)+'" fill="#fff"/><path d="'+p+'" fill="#000"/></svg>';
  }catch(e){return '';}
}
var LOGO=document.querySelector('.brand img').getAttribute('src');
function dataUri(b){b=String(b||'');return !b?'':(b.indexOf('data:')===0?b:'data:image/jpeg;base64,'+b);}
var PHC={};
/* Pictures for the printout and the viewer: just-submitted passes keep them in memory; otherwise they come from the server (pass token, or the Admin PIN in the Admin view). */
function getPhotos(p){
  return new Promise(function(res){
    var c=(LAST&&LAST.ref===p.ref&&LAST.photos)||PHC[p.ref]||p.photos;
    if(c&&c.front&&c.load){var o0={front:dataUri(c.front),load:dataUri(c.load)};PHC[p.ref]=o0;res(o0);return;}
    api({action:'photos',ref:p.ref,token:tokenOf(p.ref),pin:AD&&AD.pin||''},60000).then(function(r){
      if(r&&r.ok&&r.images){var o={};PHV.forEach(function(v){o[v]=dataUri(r.images[v]||(v==='load'?r.images.top:''));});PHC[p.ref]=o;res(o);}else res(null);
    },function(){res(null);});
  });
}
function printPass(p){
  if(!p)return;
  var busy=document.querySelector('#dPrint,#pPrint,#adPrint');
  getPhotos(p).then(function(ph){printPassNow(p,ph);});
}
function printPassNow(p,ph){
  var rows='',n=Math.max(6,p.items.length);
  for(var i=0;i<n;i++){var it=p.items[i];rows+='<tr><td style="text-align:center;width:9%">'+(it?(i+1):'')+'</td><td>'+(it?esc(it.item):'')+'</td><td style="text-align:center;width:10%">'+(it?esc(it.qty):'')+'</td><td style="text-align:center;width:13%">'+(it?esc(String(it.unit||'').toUpperCase()):'')+'</td></tr>';}
  var h='<div class="pg'+(p.items.length>8?' cmp':'')+'"><table class="hd"><tr><td class="lg" rowspan="3"><img alt="" src="'+LOGO+'"></td><td class="k">Item</td><td class="v">: EOSM-HSSE-FM003</td></tr><tr><td class="k">Revision No</td><td class="v">: Initial Issue</td></tr><tr><td class="k">Date</td><td class="v">: February, 3rd 2026</td></tr></table>';
  h+='<div class="addr">PT EcoOils Jaya Indonesia, Jl Kelapa Sawit II,<br>Kav 6 Kawasan Ekonomi Khusus<br>Sei Mangkei &ndash; Bosar Maligas<br>Simalungun 21183</div>';
  h+='<div class="ttl">MATERIAL GATE PASS</div>';
  h+='<div class="top"><div><div class="ln">SR NO: <span class="u" style="min-width:48mm">'+esc(p.ref)+'</span></div><div class="ln">DATE: <span class="u" style="min-width:48mm">'+esc(fmtD(p.date))+'</span></div>';
  h+='<div class="ln" style="margin-top:3mm">THIS NON-RETURNABLE GATE PASS IS USED FOR</div><div class="ln" style="margin-left:6mm"><span class="chk">'+(p.purpose==='A'?'X':'')+'</span>A.&nbsp; SENDING BACK REJECTED ITEMS TO SUPPLIER</div><div class="ln" style="margin-left:6mm"><span class="chk">'+(p.purpose==='B'?'X':'')+'</span>B.&nbsp; SENDING BACK CONTRACTOR&rsquo;S OWN MATERIAL</div></div><div>'+qrSvg(verifyUrl(p.ref))+'</div></div>';
  h+='<div class="ln" style="margin-top:3mm">TO: SECURITY</div><div class="ln">PLEASE ALLOWS MR/MISS: <span class="u" style="min-width:50mm">'+esc(p.carrier)+'</span> &nbsp;ID NO (KTP/SIM): <span class="u" style="min-width:48mm;white-space:nowrap">'+esc(p.icNo)+'</span></div>';
  h+='<div class="ln">COMPANY NAME: <span class="u" style="min-width:140mm">'+esc(p.company)+'</span></div><div class="ln">VEHICLE NO: <span class="u" style="min-width:140mm">'+esc(p.vehicle)+'</span></div>';
  h+='<div class="ln">PURPOSE OF TAKING THE ITEM OUT: <span class="u" style="display:block;margin-top:1mm;min-width:0;font-weight:600">'+esc(p.purposeText)+'</span></div>';
  h+='<table class="items" style="margin-top:3mm"><tr><th>S/NO</th><th>ITEM</th><th>QTY.</th><th>UNIT</th></tr>'+rows+'</table>';
  h+='<div class="ph2"><div><div class="pi">'+(ph&&ph.front?'<img alt="" src="'+ph.front+'">':'')+'</div><small>FRONT VIEW OF THE VEHICLE</small></div><div><div class="pi">'+(ph&&ph.load?'<img alt="" src="'+ph.load+'">':'')+'</div><small>MATERIAL LOADED IN THE TRUCK</small></div></div>';
  h+='<div class="sig"><div><b>CARRIED BY:</b><div class="l"></div><small>(Person taking the material out)</small><div style="font-size:9pt">'+esc(p.carrier)+'</div></div><div><b>CHECKED BY:</b><div class="l"></div><small>(IC responsible Person- Lead/Store in charge)</small><div style="font-size:9pt">'+esc(p.icRep+(p.icPos?', '+p.icPos:''))+(p.icPhone?'<br>Tel: '+esc(p.icPhone):'')+'</div></div></div>';
  h+='<div class="sig" style="margin-top:3mm"><div><b>EcoOils Rep:</b><div class="l"></div><small>(Proj/Eng, Discipline Eng, HSSE, Stores)</small><div style="font-size:9pt">'+esc(p.dept)+'</div></div><div><b>Approval By:</b><div class="l"></div><small>(EcoOils Site Lead)</small><div style="font-size:9pt">'+esc(p.siteLead||'')+'</div></div></div>';
  h+='<div class="ft"><span>COPY: <i>SECURITY / CARRIER / STORES</i></span><span class="pn">Page 1 of 1</span></div></div>';
  $('printArea').innerHTML=h;
  var old=document.title;document.title=' ';
  var back=function(){document.title=old;window.removeEventListener('afterprint',back);};window.addEventListener('afterprint',back);
  var imgs=$('printArea').querySelectorAll('img'),left=imgs.length,go=function(){if(--left<=0)setTimeout(function(){window.print();},120);};
  if(!left)go();else Array.prototype.forEach.call(imgs,function(im){if(im.complete)go();else{im.onload=go;im.onerror=go;}});
}

/* ===== pass detail ===== */
var SG=[];
function tokenOf(ref){for(var i=0;i<MINE.length;i++)if(MINE[i].ref===ref)return MINE[i].token;return '';}
function passOpen(ref){CUR=ref;PASS=null;SG=[];show('vPass');$('vPass').innerHTML=h1(ref)+'<p><span class="sp"></span>'+esc(tr('loading'))+'</p>';passLoad();}
function passLoad(){
  api({action:'get',ref:CUR,token:tokenOf(CUR)}).then(function(r){
    if(!r||!r.ok){$('vPass').innerHTML=h1(CUR)+'<p class="err">'+esc(r?errText(r.err):tr('err_net'))+'</p><button class="btn ghost" id="pBack" type="button">'+esc(tr('back'))+'</button>';return;}
    PASS=r.pass;SUM[PASS.ref]=PASS;passDraw();
  },function(){$('vPass').innerHTML=h1(CUR)+'<p class="err">'+esc(tr('err_net'))+'</p><button class="btn ghost" id="pBack" type="button">'+esc(tr('back'))+'</button>';});
}
function passDraw(){
  var p=PASS;if(!p)return;var x=ST[p.status]||ST['Awaiting signatures'],h=h1(p.ref);
  h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">'+chip(p.status)+'<span class="note">'+esc(fmtD(p.date))+'</span></div><p>'+esc(tr(x[2]))+'</p>';
  if(p.status==='Released')h+='<div class="card"><b>'+esc(tr('releasedBy'))+'</b>: '+esc(p.decidedBy)+'<br><span class="note">'+esc(p.decidedAt)+' WIB</span></div>';
  if(p.status==='Rejected')h+='<div class="card"><b>'+esc(tr('rejReason'))+'</b>: '+esc(p.note)+'<br><span class="note">'+esc(p.decidedBy)+' · '+esc(p.decidedAt)+' WIB</span></div>';
  if(p.status==='Cancelled'&&p.cancelReason)h+='<div class="card">'+esc(p.cancelReason)+'</div>';
  if(p.status==='Awaiting signatures'||p.status==='Pending release'){
    h+='<button class="btn amber" id="pPrint" type="button">'+esc(tr('printAgain'))+'</button>';
    h+='<h2>'+esc(p.status==='Pending release'?tr('replaceSigned'):tr('upload'))+'</h2><p class="note">'+esc(tr('signedHelp'))+'</p>';
    h+='<div class="tiles">'+SG.map(function(s,i){return '<div class="tile on" style="cursor:default"><img alt="" data-zoom="data:image/jpeg;base64,'+s+'" src="data:image/jpeg;base64,'+s+'"><button class="btn danger sm" type="button" data-sgrm="'+i+'">'+esc(tr('remove'))+'</button></div>';}).join('')+(SG.length<2?'<button type="button" class="tile ph" style="margin:0;font:inherit;color:inherit" data-scan="1"><span style="font-size:28px">&#128247;</span><span>'+esc(SG.length?tr('scanNext'):tr('scanBtn'))+'</span></button>':'')+'</div><input type="file" accept="image/*" id="sgIn" class="hidden">';
    if(SG.length<2)h+='<button class="btn ghost sm" type="button" id="sgFile">'+esc(tr('scanFile'))+'</button>';
    h+='<div class="err" id="pErr"></div>'+(SG.length?'<button class="btn" id="pSend" type="button">'+esc(tr('sendSigned'))+'</button>':'');
  }else h+='<button class="btn ghost" id="pPrint" type="button">'+esc(tr('printAgain'))+'</button>';
  h+='<h2>'+esc(tr('photosTitle'))+'</h2><div class="row2" id="pPhotos">'+(PHC[p.ref]?PHV.map(function(v){return '<div class="pv"><small class="note">'+esc(tr('ph_'+v))+'</small><img alt="" data-zoom="'+PHC[p.ref][v]+'" src="'+PHC[p.ref][v]+'"></div>';}).join(''):'<div class="note"><span class="sp"></span></div>')+'</div>';
  h+='<h2>'+esc(tr('items'))+'</h2><div class="card"><div class="kv"><span>'+esc(tr('compShort'))+'</span><span>'+esc(p.company)+'</span><span>'+esc(tr('vehShort'))+'</span><span>'+esc(p.vehicle)+'</span><span>'+esc(tr('driver'))+'</span><span>'+esc(p.carrier)+'</span><span>'+esc(tr('purposeText'))+'</span><span>'+esc(p.purposeText)+'</span></div><table class="it"><tr><th>#</th><th>'+esc(tr('itemName'))+'</th><th>'+esc(tr('qty'))+'</th><th>'+esc(tr('unit'))+'</th></tr>'+p.items.map(function(it,i){return '<tr><td>'+(i+1)+'</td><td>'+esc(it.item)+'</td><td>'+esc(it.qty)+'</td><td>'+esc(it.unit)+'</td></tr>';}).join('')+'</table></div>';
  if(p.status==='Awaiting signatures'||p.status==='Pending release')h+='<button class="btn danger" id="pCancel" type="button">'+esc(tr('cancelPass'))+'</button>';
  if(p.status==='Rejected'||p.status==='Expired'||p.status==='Cancelled')h+='<button class="btn" id="pNew" type="button">'+esc(tr('newPass'))+'</button>';
  h+='<button class="btn ghost" id="pBack" type="button">'+esc(tr('back'))+'</button>';
  $('vPass').innerHTML=h;
  if(!PHC[p.ref]&&!PHBUSY[p.ref]){PHBUSY[p.ref]=1;getPhotos(p).then(function(ph){delete PHBUSY[p.ref];if(ph&&PASS&&PASS.ref===p.ref&&CUR===p.ref&&!$('vPass').classList.contains('hidden'))passDraw();else if(!ph){var b=$('pPhotos');if(b)b.innerHTML='';}});}
}
var PHBUSY={};
$('vPass').addEventListener('change',function(e){
  if(e.target.id==='sgIn'){var f=e.target.files&&e.target.files[0];if(!f)return;shrink(f,null,1600,0.7).then(function(p){SG.push(p);passDraw();},function(){var er=$('pErr');if(er)er.textContent=tr('err_bad_photo');});}
});
$('vPass').addEventListener('click',function(e){
  var t=e.target.closest('button');if(!t)return;
  if(t.getAttribute('data-scan')){scanOpen(function(p){SG.push(p);passDraw();});return;}
  if(t.id==='sgFile'){var fi=$('sgIn');if(fi)fi.click();return;}
  if(t.id==='pBack'){homeOpen();}
  else if(t.getAttribute('data-sgrm')!==null){SG.splice(+t.getAttribute('data-sgrm'),1);passDraw();}
  else if(t.id==='pPrint'){if(PASS){PASS.siteLead=PASS.siteLead||CFG.siteLead;printPass(PASS);}}
  else if(t.id==='pNew'){D=newDraft();newOpen();}
  else if(t.id==='pSend'){
    if(!SG.length){var e0=$('pErr');if(e0)e0.textContent=tr('f_signed');return;}
    if(BUSY)return;BUSY=true;t.disabled=true;$('pErr').innerHTML='<span class="sp"></span>'+esc(tr('sending'));
    api({action:'signed',ref:CUR,token:tokenOf(CUR),photos:SG},120000).then(function(r){return r;},function(){return null;}).then(function(r){
      BUSY=false;
      if(!r){$('pErr').textContent=tr('err_net');t.disabled=false;return;}
      if(!r.ok){$('pErr').textContent=errText(r.err);t.disabled=false;return;}
      SG=[];passLoad();
    });
  }
  else if(t.id==='pCancel'){
    var why=window.prompt(tr('cancelWhy'),'');if(why===null)return;if(!window.confirm(tr('cancelConfirm')))return;
    api({action:'cancel',ref:CUR,token:tokenOf(CUR),reason:why}).then(function(r){if(r&&r.ok)passLoad();else{var er=$('pErr');alert(errText(r&&r.err));}},function(){alert(tr('err_net'));});
  }
});

/* ===== find a pass ===== */
function findOpen(){show('vFind');findDraw();}
function findDraw(){
  $('vFind').innerHTML=h1(tr('find'))+'<p class="note">'+esc(tr('findHelp'))+'</p><label for="fdRef">'+esc(tr('refLbl'))+'</label><input id="fdRef" placeholder="'+esc(tr('refPh'))+'" autocapitalize="characters" autocomplete="off"><label for="fdVeh">'+esc(tr('vehicle'))+'</label><input id="fdVeh" autocapitalize="characters" autocomplete="off"><div class="err" id="fdErr"></div><button class="btn" id="fdGo" type="button">'+esc(tr('findGo'))+'</button><button class="btn ghost" id="fdBack" type="button">'+esc(tr('back'))+'</button>';
}
$('vFind').addEventListener('click',function(e){
  var t=e.target.closest('button');if(!t)return;
  if(t.id==='fdBack')homeOpen();
  if(t.id==='fdGo'){
    var ref=$('fdRef').value.trim().toUpperCase(),veh=$('fdVeh').value.trim();
    api({action:'find',ref:ref,vehicle:veh}).then(function(r){
      if(!r||!r.ok){$('fdErr').textContent=errText(r&&r.err);return;}
      MINE=MINE.filter(function(m){return m.ref!==r.ref;});MINE.unshift({ref:r.ref,token:r.token,vehicle:r.pass.vehicle,company:r.pass.company,ts:Date.now()});saveMine();passOpen(r.ref);
    },function(){$('fdErr').textContent=tr('err_net');});
  }
});

/* ===== public verify (QR from a phone camera) ===== */
var VREF='',VRES=null;
function verifyOpen(ref){VREF=ref;VRES=null;show('vVerify');verifyDraw();api({action:'verify',ref:ref}).then(function(r){VRES=r||{ok:false};verifyDraw();},function(){VRES={ok:false,err:'net'};verifyDraw();});}
function verifyDraw(){
  var h=h1(tr('title'))+'<div class="ref" style="font-size:24px">'+esc(VREF)+'</div>';
  if(!VRES)h+='<p style="text-align:center"><span class="sp"></span>'+esc(tr('loading'))+'</p>';
  else if(!VRES.ok)h+='<div class="vbox bad"><div class="big">'+esc(errText(VRES.err||'server'))+'</div></div>';
  else if(!VRES.found)h+='<div class="vbox bad"><div class="big">'+esc(tr('v_nf'))+'</div><div>'+esc(tr('v_nf2'))+'</div></div>';
  else{
    var s=VRES.status,cls=s==='Pending release'?'ok':s==='Released'?'ok':s==='Awaiting signatures'?'wait':'bad';
    var k=s==='Pending release'?['v_ready','v_ready2']:s==='Released'?['v_rel','']:s==='Awaiting signatures'?['v_wait','v_wait2']:s==='Rejected'?['v_rej','']:s==='Cancelled'?['v_can','']:['v_exp',''];
    h+='<div class="vbox '+cls+'"><div class="big">'+esc(tr(k[0]))+'</div>'+(k[1]?'<div>'+esc(tr(k[1]))+'</div>':'')+(s==='Released'&&VRES.decidedAt?'<div>'+esc(VRES.decidedAt)+' WIB</div>':'')+'</div>';
    h+='<div class="card"><div class="kv"><span>'+esc(tr('date'))+'</span><span>'+esc(fmtD(VRES.date))+'</span><span>'+esc(tr('compShort'))+'</span><span>'+esc(VRES.company)+'</span><span>'+esc(tr('vehShort'))+'</span><span>'+esc(VRES.vehicle)+'</span><span>'+esc(tr('items'))+'</span><span>'+esc(VRES.items)+'</span></div></div>';
  }
  h+='<a class="btn ghost" href="'+esc(APP_URL)+'">'+esc(tr('openApp'))+'</a>';
  $('vVerify').innerHTML=h;
}

/* ===== admin ===== */
var AD={pin:ls('gp_apin')||'',list:null,counts:{},q:'',st:'',sel:null};
function adminOpen(){show('vAdmin');if(AD.pin)adminLoad();else adminDraw();}
function adminLoad(){
  api({action:'a_list',pin:AD.pin,q:AD.q,status:AD.st}).then(function(r){
    if(!r||!r.ok){if(r&&r.err==='pin'){AD.pin='';ls('gp_apin',null);}AD.err=r?errText(r.err):tr('err_net');adminDraw();return;}
    AD.list=r.list;AD.counts=r.counts;AD.err='';adminDraw();
  },function(){AD.err=tr('err_net');adminDraw();});
}
function adminDraw(){
  var h=h1(tr('admin'));
  if(!AD.pin){h+='<label for="adPin">'+esc(tr('pin'))+'</label><input id="adPin" type="password" inputmode="numeric" autocomplete="off" maxlength="12"><div class="err">'+esc(AD.err||'')+'</div><button class="btn" id="adGo" type="button">'+esc(tr('login'))+'</button><button class="btn ghost" id="adBack" type="button">'+esc(tr('back'))+'</button>';$('vAdmin').innerHTML=h;return;}
  if(AD.sel){adminDetailDraw(h);return;}
  h+='<div class="row2"><input id="adQ" placeholder="'+esc(tr('search'))+'" value="'+esc(AD.q)+'"><select id="adSt"><option value="">'+esc(tr('all'))+'</option>'+Object.keys(ST).map(function(s){return '<option value="'+esc(s)+'"'+(AD.st===s?' selected':'')+'>'+esc(tr(ST[s][0]))+' ('+(AD.counts[s]||0)+')</option>';}).join('')+'</select></div>';
  h+='<div class="err">'+esc(AD.err||'')+'</div>';
  (AD.list||[]).forEach(function(s){h+='<button class="pas" type="button" data-adopen="'+esc(s.ref)+'"><span><b>'+esc(s.ref)+'</b><small>'+esc(s.company+' · '+s.vehicle+' · '+s.carrier)+'<br>'+esc(s.createdAt)+'</small></span>'+chip(s.status)+'</button>';});
  h+='<button class="btn ghost" id="adCsv" type="button">'+esc(tr('csv'))+'</button><button class="btn ghost" id="adOut" type="button">'+esc(tr('logout'))+'</button><button class="btn ghost" id="adBack" type="button">'+esc(tr('back'))+'</button>';
  $('vAdmin').innerHTML=h;
}
function adminDetailDraw(h){
  var d=AD.sel,p=d.pass;
  h+='<div class="ref" style="font-size:24px">'+esc(p.ref)+'</div><div>'+chip(p.status)+'</div><div class="card"><div class="kv"><span>'+esc(tr('compShort'))+'</span><span>'+esc(p.company)+'</span><span>'+esc(tr('vehShort'))+'</span><span>'+esc(p.vehicle)+'</span><span>'+esc(tr('driver'))+'</span><span>'+esc(p.carrier+' ('+p.icNo+')')+'</span><span>'+esc(tr('ecoDept'))+'</span><span>'+esc(p.dept)+'</span><span>'+esc(tr('icRepShort'))+'</span><span>'+esc(p.icRep+' '+p.icPos)+'</span><span>'+esc(tr('purposeText'))+'</span><span>'+esc(p.purposeText)+'</span>'+(p.decidedBy?'<span>'+esc(tr('releasedBy'))+'</span><span>'+esc(p.decidedBy+' · '+p.decidedAt)+(p.note?' · '+esc(p.note):'')+'</span>':'')+(d.lat!==''&&d.lat!=null?'<span>GPS</span><span>'+esc(d.lat+', '+d.lng)+'</span>':'')+'</div>';
  h+='<table class="it"><tr><th>#</th><th>'+esc(tr('itemName'))+'</th><th>'+esc(tr('qty'))+'</th><th>'+esc(tr('unit'))+'</th></tr>'+p.items.map(function(it,i){return '<tr><td>'+(i+1)+'</td><td>'+esc(it.item)+'</td><td>'+esc(it.qty)+'</td><td>'+esc(it.unit)+'</td></tr>';}).join('')+'</table></div>';
  h+='<h2>'+esc(tr('links'))+'</h2><div>'+[['front',d.links.front],['load',d.links.load],['top',(d.links.old||[])[0]],['left',(d.links.old||[])[1]],['right',(d.links.old||[])[2]]].filter(function(x){return x[1]&&/^http/.test(x[1])&&!(x[0]==='top'&&x[1]===d.links.load);}).map(function(x){return '<a class="btn ghost sm" target="_blank" rel="noopener" href="'+esc(x[1])+'">'+esc(tr('ph_'+x[0]))+'</a>';}).join('')+d.links.signed.map(function(u,i){return '<a class="btn sm" target="_blank" rel="noopener" href="'+esc(u)+'">'+esc(tr('upload'))+' '+(i+1)+'</a>';}).join('')+'</div>';
  h+='<h2>'+esc(tr('auditLog'))+'</h2><table class="it adm"><tr><th>Time</th><th>Event</th><th>By</th><th>Detail</th></tr>'+d.log.map(function(l){return '<tr><td>'+esc(l.t)+'</td><td>'+esc(l.ev)+'</td><td>'+esc(l.by)+'</td><td>'+esc(l.d)+'</td></tr>';}).join('')+'</table>';
  if(p.status==='Awaiting signatures'||p.status==='Pending release')h+='<button class="btn danger" id="adCancel" type="button">'+esc(tr('adminCancel'))+'</button>';
  h+='<button class="btn" id="adPrint" type="button">'+esc(tr('printAgain'))+'</button><button class="btn ghost" id="adList" type="button">'+esc(tr('back'))+'</button>';
  $('vAdmin').innerHTML=h;
}
$('vAdmin').addEventListener('input',function(e){if(e.target.id==='adQ'){AD.q=e.target.value;clearTimeout(AD.tm);AD.tm=setTimeout(adminLoad,400);}});
$('vAdmin').addEventListener('change',function(e){if(e.target.id==='adSt'){AD.st=e.target.value;adminLoad();}});
$('vAdmin').addEventListener('click',function(e){
  var t=e.target.closest('button');if(!t)return;
  if(t.id==='adBack')homeOpen();
  else if(t.id==='adGo'){AD.pin=$('adPin').value.trim();ls('gp_apin',AD.pin);adminLoad();}
  else if(t.id==='adOut'){AD.pin='';AD.list=null;ls('gp_apin',null);adminDraw();}
  else if(t.id==='adList'){AD.sel=null;adminDraw();}
  else if(t.getAttribute('data-adopen')){api({action:'a_get',pin:AD.pin,ref:t.getAttribute('data-adopen')}).then(function(r){if(r&&r.ok){AD.sel=r;adminDraw();}else{AD.err=errText(r&&r.err);adminDraw();}});}
  else if(t.id==='adCancel'){var why=window.prompt(tr('cancelWhy'),'');if(why===null)return;api({action:'a_cancel',pin:AD.pin,ref:AD.sel.pass.ref,reason:why}).then(function(r){AD.sel=null;adminLoad();});}
  else if(t.id==='adPrint'){var p=AD.sel.pass;p.siteLead=p.siteLead||CFG.siteLead;printPass(p);}
  else if(t.id==='adCsv'){csv();}
});
function csv(){
  var rows=[['Ref','Date','Company','Vehicle','Carrier','Items','Status','Created','Signed','Decided by','Decided at','Note']].concat((AD.list||[]).map(function(s){return [s.ref,s.date,s.company,s.vehicle,s.carrier,s.items,s.status,s.createdAt,s.signedAt,s.decidedBy,s.decidedAt,s.note];}));
  var txt=rows.map(function(r){return r.map(function(c){return '"'+String(c==null?'':c).replace(/"/g,'""')+'"';}).join(',');}).join('\r\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+txt],{type:'text/csv'}));a.download='material-gate-passes.csv';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
}

/* ===== start ===== */
(function(){
  applyLang();
  var m=/[?&]v=([^&#]+)/.exec(location.search);
  if(m){verifyOpen(decodeURIComponent(m[1]).toUpperCase());return;}
  homeOpen();
})();
setInterval(function(){if(!document.hidden&&!$('vHome').classList.contains('hidden'))homeLoad();},60000);

/* ===== photo viewer: zoom in / out, pinch, drag, double-tap ===== */
var ZM={el:null,img:null,s:1,x:0,y:0,pt:{},d0:0,s0:1};
function zmApply(){if(ZM.s<=1){ZM.s=1;ZM.x=0;ZM.y=0;}ZM.img.style.transform='translate('+ZM.x+'px,'+ZM.y+'px) scale('+ZM.s+')';}
function zmSet(s){ZM.s=Math.max(1,Math.min(6,s));zmApply();}
function zmBuild(){
  if(ZM.el)return;
  var d=document.createElement('div');d.id='zm';d.className='ovl hidden';
  d.innerHTML='<div class="ovbar"><button type="button" id="zmOut" aria-label="Zoom out">&minus;</button><button type="button" id="zmIn" aria-label="Zoom in">+</button><button type="button" id="zmRs">1:1</button><button type="button" id="zmX" aria-label="Close">&times;</button></div><div class="zmst"><img alt="" id="zmImg"></div>';
  document.body.appendChild(d);ZM.el=d;ZM.img=d.querySelector('#zmImg');
  var st=d.querySelector('.zmst');
  d.querySelector('#zmIn').onclick=function(){zmSet(ZM.s*1.5);};
  d.querySelector('#zmOut').onclick=function(){zmSet(ZM.s/1.5);};
  d.querySelector('#zmRs').onclick=function(){zmSet(1);};
  d.querySelector('#zmX').onclick=zoomClose;
  st.addEventListener('wheel',function(e){e.preventDefault();zmSet(ZM.s*(e.deltaY<0?1.2:1/1.2));},{passive:false});
  st.addEventListener('dblclick',function(){zmSet(ZM.s>1?1:2.5);});
  st.addEventListener('pointerdown',function(e){try{st.setPointerCapture(e.pointerId);}catch(x){}ZM.pt[e.pointerId]={x:e.clientX,y:e.clientY};var k=Object.keys(ZM.pt);if(k.length===2){var a=ZM.pt[k[0]],b=ZM.pt[k[1]];ZM.d0=Math.hypot(a.x-b.x,a.y-b.y);ZM.s0=ZM.s;}});
  st.addEventListener('pointermove',function(e){
    var p=ZM.pt[e.pointerId];if(!p)return;var k=Object.keys(ZM.pt);
    if(k.length===2){ZM.pt[e.pointerId]={x:e.clientX,y:e.clientY};var a=ZM.pt[k[0]],b=ZM.pt[k[1]],dd=Math.hypot(a.x-b.x,a.y-b.y);if(ZM.d0>0)zmSet(ZM.s0*dd/ZM.d0);}
    else if(ZM.s>1){ZM.x+=e.clientX-p.x;ZM.y+=e.clientY-p.y;ZM.pt[e.pointerId]={x:e.clientX,y:e.clientY};zmApply();}
  });
  var up=function(e){delete ZM.pt[e.pointerId];};st.addEventListener('pointerup',up);st.addEventListener('pointercancel',up);
}
function zoomOpen(src){if(!src)return;zmBuild();ZM.img.src=src;ZM.s=1;ZM.x=0;ZM.y=0;zmApply();ZM.pt={};ZM.el.classList.remove('hidden');}
function zoomClose(){if(ZM.el)ZM.el.classList.add('hidden');}
document.addEventListener('click',function(e){var im=e.target&&e.target.closest&&e.target.closest('img[data-zoom]');if(im){e.preventDefault();zoomOpen(im.getAttribute('data-zoom'));}});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){zoomClose();scanClose();}});

/* ===== document scanner for the signed copy: camera with a page frame, cropped to the frame, cleaned up like a scan ===== */
var SC={el:null,stream:null,cb:null,shot:null};
function scanClose(){if(SC.stream){SC.stream.getTracks().forEach(function(t){t.stop();});SC.stream=null;}if(SC.el)SC.el.classList.add('hidden');SC.shot=null;}
function scanBuild(){
  if(SC.el)return;
  var d=document.createElement('div');d.id='scn';d.className='ovl hidden';
  d.innerHTML='<video id="scV" playsinline muted autoplay></video><div id="scF"></div><div class="ovbar"><span id="scT"></span><button type="button" id="scX" aria-label="Close">&times;</button></div><div id="scMsg"></div><img id="scP" alt="" class="hidden"><div class="scbt"><button type="button" class="btn ghost" id="scFile"></button><button type="button" id="scShot" aria-label="Capture"></button><button type="button" class="btn ghost hidden" id="scRe"></button><button type="button" class="btn hidden" id="scUse"></button></div>';
  document.body.appendChild(d);SC.el=d;
  d.querySelector('#scX').onclick=scanClose;
  d.querySelector('#scFile').onclick=function(){scanClose();var fi=$('sgIn');if(fi)fi.click();};
  d.querySelector('#scShot').onclick=scanShot;
  d.querySelector('#scRe').onclick=function(){scanMode('live');};
  d.querySelector('#scUse').onclick=function(){var s=SC.shot,cb=SC.cb;scanClose();if(s&&cb)cb(s);};
}
function scanMode(m){
  var d=SC.el;d.querySelector('#scV').classList.toggle('hidden',m!=='live');d.querySelector('#scF').classList.toggle('hidden',m!=='live');
  d.querySelector('#scP').classList.toggle('hidden',m!=='prev');d.querySelector('#scShot').classList.toggle('hidden',m!=='live');d.querySelector('#scFile').classList.toggle('hidden',m!=='live');
  d.querySelector('#scRe').classList.toggle('hidden',m!=='prev');d.querySelector('#scUse').classList.toggle('hidden',m!=='prev');
  d.querySelector('#scMsg').textContent=m==='live'?tr('scanHelp'):tr('scanCheck');
}
function scanOpen(cb){
  scanBuild();SC.cb=cb;SC.shot=null;var d=SC.el;
  d.querySelector('#scT').textContent=tr('scanTitle');d.querySelector('#scFile').textContent=tr('scanFile');d.querySelector('#scRe').textContent=tr('scanRetake');d.querySelector('#scUse').textContent=tr('scanUse');
  d.classList.remove('hidden');
  if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)){scanClose();var fi=$('sgIn');if(fi)fi.click();return;}
  scanMode('live');d.querySelector('#scMsg').textContent=tr('scanStart');
  navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:2560},height:{ideal:1920}},audio:false}).then(function(st){
    SC.stream=st;var v=d.querySelector('#scV');v.srcObject=st;v.play&&v.play().catch(function(){});scanMode('live');scanFrame();
  },function(){scanClose();var fi=$('sgIn');if(fi){alert(tr('scanNoCam'));fi.click();}});
}
function scanFrame(){
  var d=SC.el,cw=d.clientWidth,ch=d.clientHeight,fh=Math.min(ch-210,(cw*0.92)*1.414),fw=fh/1.414,f=d.querySelector('#scF');
  f.style.width=Math.round(fw)+'px';f.style.height=Math.round(fh)+'px';f.style.left=Math.round((cw-fw)/2)+'px';f.style.top=Math.round(Math.max(56,(ch-fh)/2-30))+'px';
}
window.addEventListener('resize',function(){if(SC.el&&!SC.el.classList.contains('hidden'))scanFrame();});
function scanShot(){
  var d=SC.el,v=d.querySelector('#scV'),f=d.querySelector('#scF');if(!v.videoWidth){return;}
  var cr=d.getBoundingClientRect(),fr=f.getBoundingClientRect(),vw=v.videoWidth,vh=v.videoHeight,cw=cr.width,ch=cr.height,sc=Math.max(cw/vw,ch/vh),ox=(vw*sc-cw)/2,oy=(vh*sc-ch)/2;
  var sx=Math.max(0,(fr.left-cr.left+ox)/sc),sy=Math.max(0,(fr.top-cr.top+oy)/sc),sw=Math.min(vw-sx,fr.width/sc),sh=Math.min(vh-sy,fr.height/sc);
  var k=Math.min(1,1700/Math.max(sw,sh)),c=document.createElement('canvas');c.width=Math.round(sw*k);c.height=Math.round(sh*k);
  var x=c.getContext('2d');x.drawImage(v,sx,sy,sw,sh,0,0,c.width,c.height);
  scanClean(c);SC.shot=c.toDataURL('image/jpeg',0.72).split(',')[1];
  d.querySelector('#scP').src='data:image/jpeg;base64,'+SC.shot;scanMode('prev');
}
/* grey, then stretch the levels so the paper turns white and the ink stays dark (like a scanner app) */
function scanClean(c){
  var x=c.getContext('2d'),im=x.getImageData(0,0,c.width,c.height),p=im.data,h=new Uint32Array(256),n=p.length/4,i,g;
  for(i=0;i<p.length;i+=4){g=(p[i]*299+p[i+1]*587+p[i+2]*114)/1000|0;p[i]=g;h[g]++;}
  var lo=0,hi=255,acc=0;for(i=0;i<256;i++){acc+=h[i];if(acc>n*0.02){lo=i;break;}}
  acc=0;for(i=255;i>=0;i--){acc+=h[i];if(acc>n*0.35){hi=i;break;}}   /* paper is the brightest large area */
  if(hi-lo<30){lo=Math.max(0,hi-60);}
  for(i=0;i<p.length;i+=4){g=(p[i]-lo)*255/(hi-lo);g=g<0?0:g>255?255:g;g=255*Math.pow(g/255,1.25);p[i]=p[i+1]=p[i+2]=g;}
  x.putImageData(im,0,0);
}
