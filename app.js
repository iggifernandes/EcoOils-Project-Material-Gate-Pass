var VERSION='v1.22';
var PHV=['front','load'];
var HC='HAND CARRY';
function isHC(v){return String(v||'').toUpperCase()===HC;}
function vehTxt(v){return isHC(v)?tr('handShow'):v;}
function phl(v,hc){return tr((hc?'phh_':'ph_')+v);}
function vehVal(){return D.mode==='hand'?HC:D.vehicle.trim();}
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
var CFG={units:['Pcs','Units','Kgs','Ton','Liters','Meters','Sets','Rolls','Drums','Bags','Boxes','Pallets','Lots'],companies:['GSB','WEN','KKS','PBS','EcoOils (Project)','EcoOils (Operations)'],depts:['Project Eng','Discipline Eng','HSSE','Stores'],validHours:48,maxItems:15,siteLead:''};
try{var c0=JSON.parse(ls('gp_cfg')||'null');if(c0&&c0.companies)CFG=c0;}catch(e){}
var MINE=[];try{MINE=JSON.parse(ls('gp_mine')||'[]');if(!Array.isArray(MINE))MINE=[];}catch(e){MINE=[];}
function saveMine(){ls('gp_mine',JSON.stringify(MINE.slice(0,60)));}
var SUM={};var CUR=null;var PASS=null;var LAST=null;
var D=newDraft();
function icDigits(){return String(D.icNo||'').replace(/[\s.\-]/g,'');}
var REASONS={A:['rA1','rA2','rA3','rA4','rA5','rA6'],B:['rB1','rB2','rB3','rB4','rB5','rB6','rB7']};
/* The printed form is in English, so the stored reason is the English text whatever language the screen is in. */
function purposeFull(){var d=String(D.purposeText||'').trim();if(!D.reason||D.reason==='rOther')return d;var r=T.en[D.reason]||'';return d?r+' - '+d:r;}
function icNeed(){return D.icType==='KTP'?16:D.icType==='SIM'?12:0;}
/* the number box takes exactly as many digits as the document: SIM 12, KTP 16 (digits only) */
function icApply(){
  var el=$('fIcNo');if(!el)return;var n=icNeed();
  D.icNo=String(D.icNo||'').replace(/\D/g,'').slice(0,n||16);
  /* no maxlength attribute: it would count the spaces of a pasted '1271 0123 4567'; the digits are cut here instead */el.disabled=!n;el.placeholder=n?n+' digits':'';if(el.value!==D.icNo)el.value=D.icNo;
  var c=$('icCnt');if(c)c.textContent=icCntText();
}
function icCntText(){var n=icNeed(),d=String(D.icNo||'').replace(/\D/g,'').length;return n?(tr('icDigits').replace('{n}',d).replace('{m}',n)):tr('icPickFirst');}
function icPhoneOk(){var t=String(D.icPhone||'').trim(),d=t.replace(/\D/g,'');return /^\+?[0-9][0-9 \-]{6,18}$/.test(t)&&d.length>=8&&d.length<=15;}
function icFull(){var d=icDigits();return (D.icType||'')+' '+d;}
function newDraft(){return {mode:'',purpose:'',company:'',companyOther:'',vehicle:'',carrier:'',icType:'',icNo:'',icPhone:'',purposeText:'',reason:'',dept:'',icRep:'',icPos:'',items:[{item:'',qty:'',unit:''}],photos:{},cid:Date.now().toString(36)+Math.random().toString(36).slice(2,10),step:1};}
function saveDraft(){var o={};Object.keys(D).forEach(function(k){if(k!=='photos')o[k]=D[k];});ls('gp_draft',JSON.stringify(o));}
try{var d0=JSON.parse(ls('gp_draft')||'null');if(d0&&d0.items){D=Object.assign(newDraft(),d0);D.photos={};}}catch(e){}

/* ===== views ===== */
var VIEWS=['vHome','vNew','vDone','vPass','vFind','vVerify','vAdmin','vGuide'];
/* v1.16: the Back button always sits at the top of the screen, so nobody has to scroll down to leave */
function topBack(sec){var b=sec.querySelector('button[id$="Back"],button#adList');if(b&&sec.firstElementChild!==b){b.classList.add('topback');sec.insertBefore(b,sec.firstChild);}}
(function(){VIEWS.forEach(function(v){var s=$(v);if(!s||!window.MutationObserver)return;new MutationObserver(function(){topBack(s);}).observe(s,{childList:true});});})();
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
  else if(!$('vGuide').classList.contains('hidden'))guideDraw();
}
['EN','ID','MS'].forEach(function(l){$('l'+l).addEventListener('click',function(){setLang(l.toLowerCase());});});

/* ===== guide: the process with do and don't, in the chosen language ===== */
function trl(k){return (T[lang]&&T[lang][k])||T.en[k]||[];}
function guideOpen(){show('vGuide');guideDraw();}
function guideDraw(){
  var h=h1(tr('guideTitle'))+'<p class="note">'+esc(tr('guideIntro'))+'</p><h2>'+esc(tr('gdStepsH'))+'</h2><div class="card">';
  trl('gdSteps').forEach(function(s,i){h+='<div class="gstep"><i>'+(i+1)+'</i><div><b>'+esc(s[0])+'</b><span>'+esc(s[1])+'</span></div></div>';});
  h+='</div><div class="card"><h2 style="margin:0">'+esc(tr('gdHandH'))+'</h2><p class="note">'+esc(tr('gdHandIntro'))+'</p><ol class="gl gn">'+trl('gdHand').map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ol></div><div class="card gdo"><h2 style="margin:0">'+esc(tr('gdDoH'))+'</h2><ul class="gl">'+trl('gdDo').map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></div>';
  h+='<div class="card gdn"><h2 style="margin:0">'+esc(tr('gdDontH'))+'</h2><ul class="gl">'+trl('gdDont').map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></div>';
  h+='<div class="banner" style="margin-top:12px">'+esc(tr('gdKey'))+'</div><button class="btn" id="gdBack" type="button">'+esc(tr('back'))+'</button>';
  $('vGuide').innerHTML=h;
}
$('vGuide').addEventListener('click',function(e){var t=e.target.closest('button');if(t&&t.id==='gdBack')homeOpen();});

/* ===== home ===== */
function homeOpen(){show('vHome');homeDraw();homeLoad();}
function homeDraw(){
  var h='<button class="btn" id="hNew" type="button">+ '+esc(tr('newPass'))+'</button>'+h1(tr('title'));
  h+='<div class="card"><b>'+esc(tr('how'))+'</b><ol style="margin:8px 0 0;padding-left:20px"><li>'+esc(tr('how1'))+'</li><li>'+esc(tr('how2'))+'</li><li>'+esc(tr('how3'))+'</li><li>'+esc(tr('how4'))+'</li></ol></div><button class="btn ghost" id="hGuide" type="button">'+esc(tr('guide'))+'</button>';
  h+='<h2>'+esc(tr('mine'))+'</h2>';
  if(!MINE.length)h+='<p class="note">'+esc(tr('noneMine'))+'</p>';
  MINE.slice(0,30).forEach(function(m){var s=SUM[m.ref];h+='<button class="pas" type="button" data-open="'+esc(m.ref)+'"><span><b>'+esc(m.ref)+'</b><small>'+esc((m.company||'')+' · '+vehTxt(m.vehicle||''))+'</small></span>'+(s&&!s.gone?chip(s.status):'')+'</button>';});
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
  else if(t.id==='hGuide'){guideOpen();}
  else if(t.id==='hAdmin'){adminOpen();}
  else if(t.getAttribute('data-open')){passOpen(t.getAttribute('data-open'));}
});

/* ===== new pass wizard ===== */
function newOpen(){if(D.done){D=newDraft();}if(!D.mode&&D.vehicle)D.mode='vehicle';D.step=D.step||1;show('vNew');newDraw();}
function mopt(sel,k,b,txt){return '<button type="button" class="opt'+(sel?' sel':'')+'" data-mode="'+k+'"><b>'+esc(b)+'</b><span>'+esc(txt)+'</span></button>';}
function opt(sel,k,b,txt){return '<button type="button" class="opt'+(sel?' sel':'')+'" data-purpose="'+k+'"><b>'+b+'</b><span>'+esc(txt)+'</span></button>';}
function newDraw(keep){
  var st=D.step,sc=window.pageYOffset,h='';
  h+=h1(tr('newPass'));
  h+='<div class="steps">'+[1,2,3,4].map(function(i){return '<i class="'+(i<=st?'on':'')+'"></i>';}).join('')+'</div><div class="stepl">'+esc(tr('stepOf').replace('{a}',st).replace('{b}',4))+' · '+esc(tr('s'+st))+'</div>';
  if(st===1){
    h+='<p class="note">'+esc(tr('allReq'))+'</p>';
    h+='<label>'+esc(tr('purposeLbl'))+'</label>'+opt(D.purpose==='A','A','A.',tr('purA'))+opt(D.purpose==='B','B','B.',tr('purB'));
    h+='<label>'+esc(tr('transport'))+'</label>'+mopt(D.mode==='vehicle','vehicle',tr('tVeh'),tr('tVehSub'))+mopt(D.mode==='hand','hand',tr('tHand'),tr('tHandSub'));
    h+='<label for="fCompany">'+esc(tr('company'))+'</label><select id="fCompany" data-f="company"><option value="">'+esc(tr('companyPick'))+'</option>'+CFG.companies.map(function(c){return '<option value="'+esc(c)+'"'+(D.company===c?' selected':'')+'>'+esc(c)+'</option>';}).join('')+'<option value="__other"'+(D.company==='__other'?' selected':'')+'>'+esc(tr('other'))+'</option></select>';
    if(D.company==='__other')h+='<label for="fCompanyOther">'+esc(tr('companyOther'))+'</label><input id="fCompanyOther" data-f="companyOther" maxlength="60" value="'+esc(D.companyOther)+'">';
    if(D.mode==='hand')h+='<div class="note">'+esc(tr('handNote'))+'</div>';
    else if(D.mode==='vehicle')h+='<label for="fVehicle">'+esc(tr('vehicle'))+'</label><input id="fVehicle" data-f="vehicle" maxlength="20" autocapitalize="characters" autocomplete="off" value="'+esc(D.vehicle)+'"><div class="note">'+esc(tr('vehicleHelp'))+'</div>';
    h+='<label for="fCarrier">'+esc(tr('carrier'))+'</label><input id="fCarrier" data-f="carrier" maxlength="60" autocomplete="off" value="'+esc(D.carrier)+'">';
    h+='<label for="fIcType">'+esc(tr('icType'))+'</label><select id="fIcType" data-f="icType"><option value="">'+esc(tr('icTypePick'))+'</option><option value="KTP"'+(D.icType==='KTP'?' selected':'')+'>'+esc(tr('icTypeKTP'))+'</option><option value="SIM"'+(D.icType==='SIM'?' selected':'')+'>'+esc(tr('icTypeSIM'))+'</option></select>';
    h+='<label for="fIcNo">'+esc(tr('icNo'))+'</label><input id="fIcNo" data-f="icNo" inputmode="numeric" pattern="[0-9]*" autocomplete="off"'+(icNeed()?'':' disabled')+' placeholder="'+(icNeed()?icNeed()+' digits':'')+'" value="'+esc(D.icNo)+'"><div class="note">'+esc(tr('icHelp'))+'</div><div class="note" id="icCnt">'+esc(icCntText())+'</div>';
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
    h+='<p class="note">'+esc(tr(D.mode==='hand'?'photoHelpH':'photoHelp'))+'</p><div class="tiles">';
    PHV.forEach(function(v){h+=tileHtml(v);});h+='</div>'+tilesZoomBar()+'<div>';
    h+='</div>';
  }else{
    var co=D.company==='__other'?D.companyOther:D.company;
    h+='<p class="note">'+esc(tr('reviewHelp'))+'</p><p class="note"><b>'+esc(tr('icCheck'))+'</b></p><div class="card"><div class="kv"><span>'+esc(tr('purposeShort'))+'</span><span>'+esc(D.purpose+'. '+(D.purpose==='A'?tr('purA'):tr('purB')))+'</span><span>'+esc(tr('compShort'))+'</span><span>'+esc(co)+'</span><span>'+esc(tr('vehShort'))+'</span><span>'+esc(D.vehicle.toUpperCase())+'</span><span>'+esc(tr('driver'))+'</span><span>'+esc(D.carrier)+' ('+esc(icFull())+')</span><span>'+esc(tr('ecoDept'))+'</span><span>'+esc(D.dept)+'</span><span>'+esc(tr('icRepShort'))+'</span><span>'+esc(D.icRep+(D.icPos?', '+D.icPos:'')+(D.icPhone?', '+D.icPhone:''))+'</span><span>'+esc(tr('purposeText'))+'</span><span>'+esc(purposeFull())+'</span></div>';
    h+='<table class="it"><tr><th>#</th><th>'+esc(tr('itemName'))+'</th><th>'+esc(tr('qty'))+'</th><th>'+esc(tr('unit'))+'</th></tr>'+validItems().map(function(it,i){return '<tr><td>'+(i+1)+'</td><td>'+esc(it.item)+'</td><td>'+esc(it.qty)+'</td><td>'+esc(it.unit)+'</td></tr>';}).join('')+'</table>';
    h+='<div class="row2" style="margin-top:10px">'+PHV.map(function(v){return '<div class="pv"><small class="note">'+esc(phl(v,D.mode==='hand'))+'</small><img alt="" data-zoom="data:image/jpeg;base64,'+D.photos[v]+'" src="data:image/jpeg;base64,'+D.photos[v]+'"></div>';}).join('')+'</div></div>';
  }
  h+='<div class="err" id="nErr"></div>';
  if(st<4)h+='<button class="btn" id="nNext" type="button">'+esc(tr('next'))+'</button>';else h+='<button class="btn amber" id="nSubmit" type="button">'+esc(tr('submit'))+'</button>';
  h+='<button class="btn ghost" id="nBack" type="button">'+esc(st>1?tr('back'):tr('close'))+'</button>';
  $('vNew').innerHTML=h;
  if(keep)window.scrollTo(0,sc);
}
function tileHtml(v){var p=D.photos[v];return '<label class="tile'+(p?' on':' ph')+'" style="margin:0" data-tile="'+v+'">'+(p?'<img alt="" src="data:image/jpeg;base64,'+p+'"><span class="ck">&#10003;</span>':'')+'<span>'+esc(phl(v,D.mode==='hand'))+'</span><small>'+esc(p?tr('retake'):tr('take'))+'</small><input type="file" accept="image/*" capture="environment" data-view="'+v+'"></label>';}
function tilesZoomBar(){return '<div class="row2" style="margin-top:6px">'+PHV.map(function(v){return D.photos[v]?'<button class="btn ghost sm" type="button" data-zv="'+v+'">&#128269; '+esc(tr('zoom'))+'</button>':'<span></span>';}).join('')+'</div>';}
function validItems(){return D.items.filter(function(it){return String(it.item).trim().length>=2&&Number(String(it.qty).replace(',','.'))>0&&CFG.units.indexOf(String(it.unit||''))>=0;}).map(function(it){return {item:String(it.item).trim(),qty:Number(String(it.qty).replace(',','.')),unit:String(it.unit||'').trim()};});}
function nerr(k,field){var e=$('nErr');if(e)e.textContent=tr(k);if(field){var f=document.querySelector(field);if(f){f.classList.add('bad');try{f.scrollIntoView({block:'center'});}catch(x){}}}}
function stepOk(){
  var s=D.step,co=D.company==='__other'?D.companyOther:D.company;
  if(s===1){
    if(D.purpose!=='A'&&D.purpose!=='B'){nerr('f_purpose');return false;}
    if(!co||String(co).trim().length<2){nerr('f_company',D.company==='__other'?'#fCompanyOther':'#fCompany');return false;}
    if(D.mode!=='vehicle'&&D.mode!=='hand'){nerr('f_mode');return false;}
    if(D.mode==='vehicle'&&D.vehicle.trim().length<2){nerr('f_vehicle','#fVehicle');return false;}
    if(D.carrier.trim().length<2){nerr('f_carrier','#fCarrier');return false;}
    if(!D.icType){nerr('f_icType','#fIcType');return false;}
    if(!D.icNo.trim()){nerr('f_icNo','#fIcNo');return false;}
    if(!/^\d+$/.test(icDigits())||icDigits().length!==(D.icType==='KTP'?16:12)){nerr(D.icType==='KTP'?'f_icKTP':'f_icSIM','#fIcNo');return false;}
    if(!D.reason){nerr('f_reason','#fReason');return false;}
    if(D.purposeText.trim().length<3){nerr('f_reasonOther','#fPT');return false;}
    if(!D.dept){nerr('f_dept','#fDept');return false;}
    if(D.icRep.trim().length<2){nerr('f_icRep','#fRep');return false;}
    if(D.icPos.trim().length<2){nerr('f_icPos','#fPos');return false;}
    if(!icPhoneOk()){nerr('f_icPhone','#fPhone');return false;}
  }else if(s===2){
    var nu=D.items.some(function(it){return String(it.item).trim().length>=2&&Number(String(it.qty).replace(',','.'))>0&&CFG.units.indexOf(String(it.unit||''))<0;});
    if(nu){nerr('f_unit');return false;}
    if(!validItems().length){nerr('f_items');return false;}}
  else if(s===3){if(!PHV.every(function(v){return D.photos[v];})){nerr('f_photos');return false;}}
  return true;
}
$('vNew').addEventListener('change',function(e){if(e.target.id==='fIcType'){D.icType=e.target.value;icApply();saveDraft();}});
$('vNew').addEventListener('input',function(e){
  var t=e.target,f=t.getAttribute('data-f'),i=t.getAttribute('data-i');
  if(f){D[f]=t.value;t.classList.remove('bad');if(f==='icNo'||f==='icType')icApply();saveDraft();}
  else if(i!==null){D.items[+i][t.getAttribute('data-k')]=t.value;saveDraft();}
});
$('vNew').addEventListener('change',function(e){
  var t=e.target,f=t.getAttribute('data-f');
  if(f==='company'){D.company=t.value;saveDraft();newDraw(true);}
  if(f==='reason'){D.reason=t.value;saveDraft();newDraw(true);}
  if(f==='icType'){D.icType=t.value;saveDraft();newDraw(true);}
  if(t.getAttribute('data-view')){
    var f0=t.files&&t.files[0],v=t.getAttribute('data-view');if(!f0)return;
    var co=D.company==='__other'?D.companyOther:D.company;
    shrink(f0,[stampTime(),phl(v,D.mode==='hand')+' | '+(D.mode==='hand'?HC:(D.vehicle||'').toUpperCase())+' | '+co],1100,0.6,true).then(function(p){var hh=SHH,ov=v==='front'?'load':'front';D.hash=D.hash||{};if(D.photos[ov]&&D.hash[ov]&&hDist(hh,D.hash[ov])<=8){var er1=$('nErr');if(er1)er1.textContent=tr('err_same_photo');return;}D.hash[v]=hh;D.photos[v]=p;var el=document.querySelector('[data-tile="'+v+'"]');if(el)el.outerHTML=tileHtml(v);var zb=document.querySelector('.tiles+.row2');if(zb)zb.outerHTML=tilesZoomBar();var er0=$('nErr');if(er0)er0.textContent='';},function(why){var er=$('nErr');if(er)er.textContent=why==='portrait'?tr('err_portrait'):tr('err_bad_photo');});
  }
});
$('vNew').addEventListener('click',function(e){
  var t=e.target.closest('button');if(!t)return;
  if(t.getAttribute('data-zv')){var pz=D.photos[t.getAttribute('data-zv')];if(pz)zoomOpen('data:image/jpeg;base64,'+pz);return;}
  if(t.getAttribute('data-mode')){var nm=t.getAttribute('data-mode');if(nm!==D.mode){D.mode=nm;D.photos={};D.hash={};}saveDraft();newDraw(true);return;}
  if(t.getAttribute('data-purpose')){var np=t.getAttribute('data-purpose');if(np!==D.purpose&&D.reason!=='rOther')D.reason='';D.purpose=np;saveDraft();newDraw(true);}
  else if(t.getAttribute('data-rm')!==null){D.items.splice(+t.getAttribute('data-rm'),1);saveDraft();newDraw(true);}
  else if(t.id==='addItem'){D.items.push({item:'',qty:'',unit:''});saveDraft();newDraw(true);}
  else if(t.id==='nNext'){if(stepOk()){D.step++;saveDraft();newDraw();window.scrollTo(0,0);}}
  else if(t.id==='nBack'){if(D.step>1){D.step--;saveDraft();newDraw();window.scrollTo(0,0);}else homeOpen();}
  else if(t.id==='nSubmit'){submit();}
});
/* v1.22: a tiny picture fingerprint (64 bits) of the raw photo, taken before the time stamp, so the same picture cannot be used for both photos */
var SHH='';
function dHash(c){var s=document.createElement('canvas');s.width=9;s.height=8;var x=s.getContext('2d');x.drawImage(c,0,0,9,8);var d=x.getImageData(0,0,9,8).data,o='';for(var r=0;r<8;r++)for(var i=0;i<8;i++){var p=(r*9+i)*4,q=p+4;o+=(d[p]*.3+d[p+1]*.59+d[p+2]*.11)>(d[q]*.3+d[q+1]*.59+d[q+2]*.11)?'1':'0';}return o;}
function hDist(a,b){var n=0;for(var i=0;i<64;i++)if(a.charAt(i)!==b.charAt(i))n++;return n;}
function shrink(file,lines,max,q,landscape){
  return new Promise(function(res,rej){
    var u=URL.createObjectURL(file),im=new Image();
    im.onload=function(){
      if(landscape&&im.naturalHeight>im.naturalWidth){URL.revokeObjectURL(u);rej('portrait');return;}
      var k=Math.min(1,(max||1100)/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement('canvas');
      c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);var x=c.getContext('2d');x.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);SHH=dHash(c);
      if(lines&&lines.length){
        var f0=Math.max(18,Math.round(c.width/16)),f1=Math.max(14,Math.round(c.width/26)),pd=Math.round(f0*0.35),lh=[Math.round(f0*1.2),Math.round(f1*1.25)],bh=pd*2+lh[0]+(lines.length>1?lh[1]:0),yy=c.height-bh;
        /* time stamp: solid black bar, big bold white date and time, smaller second line (vehicle, company) */
        x.fillStyle='rgba(0,0,0,0.88)';x.fillRect(0,yy,c.width,bh);x.fillStyle='#fff';x.textBaseline='top';
        lines.forEach(function(t,i){var fz=i===0?f0:f1;x.font=(i===0?'bold ':'')+fz+'px Arial,Helvetica,sans-serif';var s=t;while(s.length>4&&x.measureText(s).width>c.width-pd*2)s=s.slice(0,-2);if(s!==t)s=s.replace(/\s+$/,'')+'...';x.fillText(s,pd,yy+pd+(i?lh[0]:0));});
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
  var body={action:'create',cid:D.cid,hp:'',purpose:D.purpose,company:co.trim(),vehicle:vehVal(),carrier:D.carrier.trim(),icNo:icFull(),purposeText:purposeFull(),dept:D.dept,icRep:D.icRep.trim(),icPhone:D.icPhone.trim(),icPos:D.icPos.trim(),items:its,photos:D.photos};
  $('nSubmit').disabled=true;$('nErr').innerHTML='<span class="sp"></span>'+esc(tr('sending'));
  api(body,120000).then(function(r){return r;},function(){return null;}).then(function(r){
    BUSY=false;
    if(!r){var e1=$('nErr');if(e1)e1.textContent=tr('err_net');var b=$('nSubmit');if(b)b.disabled=false;return;}
    if(!r.ok){var e2=$('nErr');if(e2)e2.textContent=errText(r.err);var b2=$('nSubmit');if(b2)b2.disabled=false;return;}
    LAST={ref:r.ref,qk:r.qk,date:r.date,purpose:D.purpose,carrier:body.carrier,icNo:body.icNo,company:body.company,vehicle:body.vehicle.toUpperCase(),purposeText:body.purposeText,dept:body.dept,icRep:body.icRep,icPos:body.icPos,icPhone:body.icPhone,items:its,siteLead:CFG.siteLead,photos:{front:D.photos.front,load:D.photos.load}};
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
  var h=h1(tr('doneTitle'))+'<div class="note" style="text-align:center">'+esc(tr('refLbl'))+'</div><div class="ref">'+esc(LAST.ref)+'</div>'+'<div class="qr">'+qrSvg(verifyUrl(LAST.ref,LAST.qk))+'</div>';
  h+='<p>'+esc(tr('doneNext'))+'</p><button class="btn amber" id="dPrint" type="button">'+esc(tr('printBoth'))+'</button><button class="btn ghost" id="dPrint1" type="button">'+esc(tr('printOne'))+'</button><button class="btn ghost" id="dPdf" type="button">'+esc(tr('dlPdf'))+'</button><div class="note">'+esc(tr('printHint'))+'</div><button class="btn ghost" id="dOpen" type="button">'+esc(tr('openPass'))+'</button>';
  $('vDone').innerHTML=h;
}
$('vDone').addEventListener('click',function(e){var t=e.target.closest('button');if(!t)return;if(t.id==='dPrint')printPass(LAST);else if(t.id==='dPrint1')printPass(LAST,true);else if(t.id==='dPdf')pdfPass(LAST,t);else if(t.id==='dOpen')passOpen(LAST.ref);});

/* ===== QR and print ===== */
function verifyUrl(ref,qk){return APP_URL+'?v='+encodeURIComponent(ref)+(qk?'&k='+encodeURIComponent(qk):'');}
function qrSvg(text){
  try{var q=qrcode(0,'M');q.addData(text);q.make();var n=q.getModuleCount(),p='';
    for(var r=0;r<n;r++)for(var c=0;c<n;c++)if(q.isDark(r,c))p+='M'+c+' '+r+'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 '+(n+4)+' '+(n+4)+'" shape-rendering="crispEdges"><rect x="-2" y="-2" width="'+(n+4)+'" height="'+(n+4)+'" fill="#fff"/><path d="'+p+'" fill="#000"/></svg>';
  }catch(e){return '';}
}
var LOGO=document.querySelector('.eh-logo').getAttribute('src');
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
function printPass(p,one){
  if(!p)return;
  getPhotos(p).then(function(ph){printPassNow(p,ph,!!one);});
}
function stampNow(){
  var d=new Date(Date.now()+7*3600000),M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],z=function(n){return (n<10?'0':'')+n;};
  return {txt:z(d.getUTCDate())+' '+M[d.getUTCMonth()]+' '+d.getUTCFullYear()+' '+z(d.getUTCHours())+':'+z(d.getUTCMinutes())+' WIB',file:d.getUTCFullYear()+'-'+z(d.getUTCMonth()+1)+'-'+z(d.getUTCDate())+'_'+z(d.getUTCHours())+'-'+z(d.getUTCMinutes())};
}
function fileBase(p,st){return String(p.ref).replace(/[^A-Za-z0-9_-]/g,'')+'_'+st.file;}
function passHtml(p,ph,one,st){
  var rows='',n=Math.max(6,p.items.length);
  for(var i=0;i<n;i++){var it=p.items[i];rows+='<tr><td style="text-align:center;width:9%">'+(it?(i+1):'')+'</td><td>'+(it?esc(it.item):'')+'</td><td style="text-align:center;width:10%">'+(it?esc(it.qty):'')+'</td><td style="text-align:center;width:13%">'+(it?esc(String(it.unit||'').toUpperCase()):'')+'</td></tr>';}
  var h='<div class="pg'+(p.items.length>8?' cmp':'')+'"><table class="hd"><tr><td class="lg" rowspan="3"><img alt="" src="'+LOGO+'"></td><td class="k">Item</td><td class="v">: EOSM-HSSE-FM003</td></tr><tr><td class="k">Revision No</td><td class="v">: Initial Issue</td></tr><tr><td class="k">Date</td><td class="v">: February, 3rd 2026</td></tr></table>';
  h+='<div class="addr">PT EcoOils Jaya Indonesia, Jl Kelapa Sawit II,<br>Kav 6 Kawasan Ekonomi Khusus<br>Sei Mangkei &ndash; Bosar Maligas<br>Simalungun 21183</div>';
  h+='<div class="ttl">MATERIAL GATE PASS</div>';
  h+='<div class="top"><div><div class="ln">SR NO: <span class="u" style="min-width:48mm">'+esc(p.ref)+'</span></div><div class="ln">DATE: <span class="u" style="min-width:48mm">'+esc(fmtD(p.date))+'</span></div>';
  h+='<div class="ln" style="margin-top:3mm">THIS NON-RETURNABLE GATE PASS IS USED FOR</div><div class="ln" style="margin-left:6mm"><span class="chk">'+(p.purpose==='A'?'X':'')+'</span>A.&nbsp; SENDING BACK REJECTED ITEMS TO SUPPLIER</div><div class="ln" style="margin-left:6mm"><span class="chk">'+(p.purpose==='B'?'X':'')+'</span>B.&nbsp; SENDING BACK CONTRACTOR&rsquo;S OWN MATERIAL</div></div><div>'+qrSvg(verifyUrl(p.ref,p.qk))+'</div></div>';
  h+='<div class="ln" style="margin-top:3mm">TO: SECURITY</div><div class="ln">PLEASE ALLOWS MR/MISS: <span class="u" style="min-width:50mm">'+esc(p.carrier)+'</span> &nbsp;ID NO (KTP/SIM): <span class="u" style="min-width:48mm;white-space:nowrap">'+esc(p.icNo)+'</span></div>';
  h+='<div class="ln">COMPANY NAME: <span class="u" style="min-width:140mm">'+esc(p.company)+'</span></div><div class="ln">VEHICLE NO: <span class="u" style="min-width:140mm">'+esc(isHC(p.vehicle)?'HAND CARRY (NO VEHICLE)':p.vehicle)+'</span></div>';
  h+='<div class="ln">PURPOSE OF TAKING THE ITEM OUT: <span class="u" style="display:block;margin-top:1mm;min-width:0;font-weight:600">'+esc(p.purposeText)+'</span></div>';
  h+='<table class="items" style="margin-top:3mm"><tr><th>S/NO</th><th>ITEM</th><th>QTY.</th><th>UNIT</th></tr>'+rows+'</table>';
  if(one)h+='<div class="ph2"><div><div class="pi">'+(ph&&ph.front?'<img alt="" src="'+ph.front+'">':'')+'</div><small>'+(isHC(p.vehicle)?'MATERIAL AND THE PERSON CARRYING IT':'FRONT VIEW OF THE VEHICLE')+'</small></div><div><div class="pi">'+(ph&&ph.load?'<img alt="" src="'+ph.load+'">':'')+'</div><small>'+(isHC(p.vehicle)?'CLOSE-UP OF THE MATERIAL (LABELS / TAGS)':'MATERIAL LOADED IN THE TRUCK')+'</small></div></div>';
  h+='<div class="sig"><div><b>CARRIED BY:</b><div class="l"></div><small>(Person taking the material out)</small><div style="font-size:9pt">'+esc(p.carrier)+'</div></div><div><b>CHECKED BY:</b><div class="l"></div><small>(IC responsible Person- Lead/Store in charge)</small><div style="font-size:9pt">'+esc(p.icRep+(p.icPos?', '+p.icPos:''))+(p.icPhone?'<br>Tel: '+esc(p.icPhone):'')+'</div></div></div>';
  h+='<div class="sig" style="margin-top:3mm"><div><b>EcoOils Rep:</b><div class="l"></div><small>(Proj/Eng, Discipline Eng, HSSE, Stores)</small><div style="font-size:9pt">'+esc(p.dept)+'</div></div><div><b>Approval By:</b><div class="l"></div><small>(EcoOils Site Lead)</small><div style="font-size:9pt">'+esc(p.siteLead||'')+'</div></div></div>';
  h+='<div class="ft"><span>COPY: <i>SECURITY / CARRIER / STORES</i></span><span class="pn">'+esc(tr('printedAt'))+' '+esc(st.txt)+' &middot; Page 1 of '+(one?1:2)+'</span></div></div>';
  if(!one){
    h+='<div class="pg pg2"><table class="hd"><tr><td class="lg" rowspan="3"><img alt="" src="'+LOGO+'"></td><td class="k">Item</td><td class="v">: EOSM-HSSE-FM003</td></tr><tr><td class="k">SR NO</td><td class="v">: '+esc(p.ref)+'</td></tr><tr><td class="k">Date</td><td class="v">: '+esc(fmtD(p.date))+'</td></tr></table>';
    h+='<div class="ttl">MATERIAL GATE PASS &ndash; '+(isHC(p.vehicle)?'MATERIAL PHOTOS':'VEHICLE AND MATERIAL PHOTOS')+'</div>';
    h+='<div class="top"><div><div class="ln">COMPANY: <b>'+esc(p.company)+'</b></div><div class="ln">VEHICLE NO: <b>'+esc(isHC(p.vehicle)?'HAND CARRY (NO VEHICLE)':p.vehicle)+'</b></div><div class="ln">CARRIED BY: <b>'+esc(p.carrier)+'</b></div></div><div>'+qrSvg(verifyUrl(p.ref,p.qk))+'</div></div>';
    h+='<div class="bigph"><div class="pi">'+(ph&&ph.front?'<img alt="" src="'+ph.front+'">':'')+'</div><small>'+(isHC(p.vehicle)?'MATERIAL AND THE PERSON CARRYING IT':'FRONT VIEW OF THE VEHICLE')+'</small></div>';
    h+='<div class="bigph"><div class="pi">'+(ph&&ph.load?'<img alt="" src="'+ph.load+'">':'')+'</div><small>'+(isHC(p.vehicle)?'CLOSE-UP OF THE MATERIAL (LABELS / TAGS)':'MATERIAL LOADED IN THE TRUCK')+'</small></div>';
    h+='<div class="ft"><span>'+esc(p.ref)+'</span><span class="pn">'+esc(tr('printedAt'))+' '+esc(st.txt)+' &middot; Page 2 of 2</span></div></div>';
  }
  return h;
}
function printPassNow(p,ph,one){
  var st=stampNow();
  $('printArea').innerHTML=passHtml(p,ph,one,st);
  /* margin 0 hides the browser header, so the tab title is free to become the file name when the person saves as PDF */
  var old=document.title;document.title=fileBase(p,st);
  var back=function(){document.title=old;window.removeEventListener('afterprint',back);};window.addEventListener('afterprint',back);
  var imgs=$('printArea').querySelectorAll('img'),left=imgs.length,go=function(){if(--left<=0)setTimeout(function(){window.print();},120);};
  if(!left)go();else Array.prototype.forEach.call(imgs,function(im){if(im.complete)go();else{im.onload=go;im.onerror=go;}});
}

/* ===== Download PDF: the same pages as the print, drawn to pictures and packed into a PDF (no library, no paid service) ===== */
function printCss(){
  var o='';
  Array.prototype.forEach.call(document.styleSheets,function(ss){try{Array.prototype.forEach.call(ss.cssRules,function(r){
    if(r.type===4){if(/print/.test(r.media.mediaText))Array.prototype.forEach.call(r.cssRules,function(q){if(q.selectorText&&q.selectorText.indexOf('#printArea')===0)o+=q.cssText;});}
    else if(r.selectorText&&r.selectorText.indexOf('#printArea')===0&&r.cssText.indexOf('display: none')<0)o+=r.cssText;
  });}catch(e){}});
  return o;
}
/* Jost for the PDF pictures (a picture cannot use web fonts by link, so the font file is fetched once and embedded); falls back to Arial when offline */
var JOST=null;
function jostCss(){
  if(JOST!==null)return Promise.resolve(JOST);
  return new Promise(function(res){
    var fin=function(v){if(JOST===null){JOST=v||'';res(JOST);}};setTimeout(function(){fin('');},6000);
    var l=document.querySelector('link[href*="fonts.googleapis.com/css2"]');if(!l||!window.fetch)return fin('');
    fetch(l.href).then(function(r){return r.text();}).then(function(css){
      var parts=css.split(/\/\*\s*/).filter(function(x){return /^latin\s*\*\//.test(x);});
      return Promise.all(parts.map(function(b){
        var m=b.match(/url\((https:[^)]+)\)/);if(!m)return '';
        return fetch(m[1]).then(function(r){return r.arrayBuffer();}).then(function(buf){
          var u=new Uint8Array(buf),bin='';for(var i=0;i<u.length;i+=8192)bin+=String.fromCharCode.apply(null,u.subarray(i,i+8192));
          return b.replace(/^latin\s*\*\//,'').replace(m[0],'url(data:font/woff2;base64,'+btoa(bin)+')');
        });
      }));
    }).then(function(a){fin(a.join('\n'));},function(){fin('');});
  });
}
function pageJpeg(pgHtml,css){
  return new Promise(function(res,rej){
    var W=794,H=1123,box=document.createElement('div');
    box.innerHTML='<style>'+css+'</style><div id="printArea" style="display:block;width:'+W+'px;height:'+H+'px;background:#fff;color:#000;overflow:hidden">'+pgHtml+'</div>';
    var xml=new XMLSerializer().serializeToString(box);
    var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'"><foreignObject x="0" y="0" width="'+W+'" height="'+H+'">'+xml+'</foreignObject></svg>';
    var im=new Image();
    im.onload=function(){try{
      var c=document.createElement('canvas');c.width=W*2;c.height=H*2;var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);
      var b=atob(c.toDataURL('image/jpeg',0.9).split(',')[1]),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);
      res({jpg:u,w:c.width,h:c.height});
    }catch(e){rej(e);}};
    im.onerror=function(){rej(new Error('render'));};
    im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  });
}
function mkPdf(pages,title){
  var parts=[],len=0,offs=[];
  var put=function(x){var u=typeof x==='string'?(function(){var a=new Uint8Array(x.length);for(var i=0;i<x.length;i++)a[i]=x.charCodeAt(i)&255;return a;})():x;parts.push(u);len+=u.length;};
  var N=pages.length*3+4;
  put('%PDF-1.4\n');
  var obj=function(n,body){offs[n]=len;put(n+' 0 obj\n'+body+'\nendobj\n');};
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  obj(2,'<< /Type /Pages /Count '+pages.length+' /Kids ['+pages.map(function(_,i){return (3+i*3)+' 0 R';}).join(' ')+'] >>');
  pages.forEach(function(pg,i){
    var a=3+i*3;
    obj(a,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 '+(a+2)+' 0 R >> >> /Contents '+(a+1)+' 0 R >>');
    var cs='q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';
    obj(a+1,'<< /Length '+cs.length+' >>\nstream\n'+cs+'\nendstream');
    offs[a+2]=len;put((a+2)+' 0 obj\n<< /Type /XObject /Subtype /Image /Width '+pg.w+' /Height '+pg.h+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+pg.jpg.length+' >>\nstream\n');put(pg.jpg);put('\nendstream\nendobj\n');
  });
  obj(N-1,'<< /Title ('+String(title).replace(/[()\\]/g,'')+') /Producer (EcoOils Material Gate Pass) >>');
  var xr=len;put('xref\n0 '+N+'\n0000000000 65535 f \n');
  for(var k=1;k<N;k++)put(('0000000000'+offs[k]).slice(-10)+' 00000 n \n');
  put('trailer\n<< /Size '+N+' /Root 1 0 R /Info '+(N-1)+' 0 R >>\nstartxref\n'+xr+'\n%%EOF\n');
  return new Blob(parts,{type:'application/pdf'});
}
function saveBlob(blob,name){
  var a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=name;document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(u);a.remove();},5000);
}
function pdfPass(p,btn){
  if(!p)return;
  var lbl=btn?btn.textContent:'';if(btn){btn.disabled=true;btn.textContent=tr('pdfWait');}
  var done=function(){if(btn){btn.disabled=false;btn.textContent=lbl;}};
  Promise.all([getPhotos(p),jostCss()]).then(function(a){
    var st=stampNow(),box=document.createElement('div');box.innerHTML=passHtml(p,a[0],false,st);
    var css=printCss()+a[1],pgs=Array.prototype.slice.call(box.querySelectorAll('.pg')),list=[];
    return pgs.reduce(function(pr,pg){return pr.then(function(){return pageJpeg(pg.outerHTML,css).then(function(j){list.push(j);});});},Promise.resolve()).then(function(){
      saveBlob(mkPdf(list,fileBase(p,st)),fileBase(p,st)+'.pdf');
    });
  }).then(done,function(){done();alert(tr('pdfFail'));});
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
    h+='<button class="btn amber" id="pPrint" type="button">'+esc(tr('printBoth'))+'</button><button class="btn ghost" id="pPrint1" type="button">'+esc(tr('printOne'))+'</button><button class="btn ghost" id="pPdf" type="button">'+esc(tr('dlPdf'))+'</button>';
    h+='<h2>'+esc(p.status==='Pending release'?tr('replaceSigned'):tr('upload'))+'</h2><p class="note">'+esc(tr('signedHelp'))+'</p>';
    h+='<div class="tiles">'+SG.map(function(s,i){return '<div class="tile on" style="cursor:default"><img alt="" data-zoom="data:image/jpeg;base64,'+s+'" src="data:image/jpeg;base64,'+s+'"><button class="btn danger sm" type="button" data-sgrm="'+i+'">'+esc(tr('remove'))+'</button></div>';}).join('')+(SG.length<2?'<button type="button" class="tile ph" style="margin:0;font:inherit;color:inherit" data-scan="1"><span style="font-size:28px">&#128247;</span><span>'+esc(SG.length?tr('scanNext'):tr('scanBtn'))+'</span></button>':'')+'</div><input type="file" accept="image/*" id="sgIn" class="hidden">';
    if(SG.length<2)h+='<button class="btn ghost sm" type="button" id="sgFile">'+esc(tr('scanFile'))+'</button>';
    h+='<div class="err" id="pErr"></div>'+(SG.length?'<button class="btn" id="pSend" type="button">'+esc(tr('sendSigned'))+'</button>':'');
  }else h+='<button class="btn ghost" id="pPrint" type="button">'+esc(tr('printAgain'))+'</button><button class="btn ghost" id="pPdf" type="button">'+esc(tr('dlPdf'))+'</button>';
  h+='<h2>'+esc(tr('photosTitle'))+'</h2><div class="row2" id="pPhotos">'+(PHC[p.ref]?PHV.map(function(v){return '<div class="pv"><small class="note">'+esc(phl(v,isHC(p.vehicle)))+'</small><img alt="" data-zoom="'+PHC[p.ref][v]+'" src="'+PHC[p.ref][v]+'"></div>';}).join(''):'<div class="note"><span class="sp"></span></div>')+'</div>';
  h+='<h2>'+esc(tr('items'))+'</h2><div class="card"><div class="kv"><span>'+esc(tr('compShort'))+'</span><span>'+esc(p.company)+'</span><span>'+esc(tr('vehShort'))+'</span><span>'+esc(vehTxt(p.vehicle))+'</span><span>'+esc(tr('driver'))+'</span><span>'+esc(p.carrier)+'</span><span>'+esc(tr('purposeText'))+'</span><span>'+esc(p.purposeText)+'</span></div><table class="it"><tr><th>#</th><th>'+esc(tr('itemName'))+'</th><th>'+esc(tr('qty'))+'</th><th>'+esc(tr('unit'))+'</th></tr>'+p.items.map(function(it,i){return '<tr><td>'+(i+1)+'</td><td>'+esc(it.item)+'</td><td>'+esc(it.qty)+'</td><td>'+esc(it.unit)+'</td></tr>';}).join('')+'</table></div>';
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
  else if(t.id==='pPdf'){if(PASS){PASS.siteLead=PASS.siteLead||CFG.siteLead;pdfPass(PASS,t);}}
  else if(t.id==='pPrint'||t.id==='pPrint1'){if(PASS){PASS.siteLead=PASS.siteLead||CFG.siteLead;printPass(PASS,t.id==='pPrint1');}}
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

/* ===== find a pass: by pass number, by KTP / SIM number, or by scanning the QR on the pass ===== */
var FD={q:'',err:'',res:null,take:''};
var REFRE=/MGP-[A-Z0-9]{1,8}-\d{4}-\d{3,}/i;
function findOpen(){FD.err='';FD.res=null;FD.take='';FD.from='';show('vFind');findDraw();}
function findDraw(){
  var h=h1(tr('find'));
  if(FD.take){
    h+='<div class="ref" style="font-size:24px">'+esc(FD.take)+'</div><p class="note">'+esc(tr('takeHelp'))+'</p><label for="fdVeh">'+esc(tr('vehicle'))+'</label><input id="fdVeh" autocapitalize="characters" autocomplete="off"><div class="err" id="fdErr">'+esc(FD.err)+'</div><button class="btn" id="fdTake" type="button">'+esc(tr('takeOver'))+'</button><button class="btn ghost" id="fdBack2" type="button">'+esc(tr('back'))+'</button>';
    $('vFind').innerHTML=h;return;
  }
  h+='<p class="note">'+esc(tr('findHelp2'))+'</p><label for="fdQ">'+esc(tr('fdQ'))+'</label><input id="fdQ" placeholder="'+esc(tr('refPh'))+'" autocapitalize="characters" autocomplete="off" value="'+esc(FD.q)+'"><div class="err" id="fdErr">'+esc(FD.err)+'</div><button class="btn" id="fdGo" type="button">'+esc(tr('findGo'))+'</button><button class="btn amber" id="fdQr" type="button">'+esc(tr('scanQr'))+'</button>';
  if(FD.res&&FD.res.length){h+='<h2>'+esc(tr('found'))+'</h2>'+FD.res.map(function(s){return '<button class="pas" type="button" data-fdopen="'+esc(s.ref)+'"><span><b>'+esc(s.ref)+'</b><small>'+esc(s.company+' · '+vehTxt(s.vehicle)+' · '+fmtD(s.date))+'</small></span>'+chip(s.status)+'</button>';}).join('');}
  h+='<button class="btn ghost" id="fdBack" type="button">'+esc(tr('back'))+'</button>';
  $('vFind').innerHTML=h;
}
function findGo(){
  var q=($('fdQ').value||'').trim();FD.q=q;FD.err='';FD.res=null;
  api({action:'lookup',q:q}).then(function(r){
    if(!r||!r.ok){FD.err=errText(r&&r.err);findDraw();return;}
    if(!r.list.length){FD.err=tr('noMatch');findDraw();return;}
    if(r.list.length===1){FD.from='find';verifyOpen(r.list[0].ref);return;}
    FD.res=r.list;findDraw();
  },function(){FD.err=tr('err_net');findDraw();});
}
$('vFind').addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.id==='fdQ'){e.preventDefault();findGo();}});
$('vFind').addEventListener('click',function(e){
  var t=e.target.closest('button');if(!t)return;
  if(t.id==='fdBack')homeOpen();
  else if(t.id==='fdBack2'){FD.take='';FD.err='';findDraw();}
  else if(t.id==='fdGo')findGo();
  else if(t.id==='fdQr'){FD.q=$('fdQ').value;qrScanOpen(function(ref){FD.from='find';verifyOpen(ref);});}
  else if(t.getAttribute('data-fdopen')){FD.from='find';verifyOpen(t.getAttribute('data-fdopen'));}
  else if(t.id==='fdTake'){
    var veh=$('fdVeh').value.trim();
    api({action:'find',ref:FD.take,vehicle:veh}).then(function(r){
      if(!r||!r.ok){FD.err=errText(r&&r.err);findDraw();return;}
      MINE=MINE.filter(function(m){return m.ref!==r.ref;});MINE.unshift({ref:r.ref,token:r.token,vehicle:r.pass.vehicle,company:r.pass.company,ts:Date.now()});saveMine();FD.take='';passOpen(r.ref);
    },function(){FD.err=tr('err_net');findDraw();});
  }
});

/* ===== QR scanner (camera): BarcodeDetector where the phone has it, otherwise jsQR.js loaded from the same site ===== */
var QS={el:null,stream:null,on:false,cb:null,det:null,load:null};
function qrLoadLib(){
  if(window.jsQR)return Promise.resolve();
  if(!QS.load)QS.load=new Promise(function(ok,no){var e=document.createElement('script');e.src='jsQR.js';e.onload=ok;e.onerror=function(){QS.load=null;no();};document.head.appendChild(e);});
  return QS.load;
}
function qrScanClose(){
  QS.on=false;if(QS.stream){QS.stream.getTracks().forEach(function(t){t.stop();});QS.stream=null;}
  if(QS.el)QS.el.classList.add('hidden');
}
function qrScanOpen(cb){
  if(!QS.el){
    var d=document.createElement('div');d.id='qrs';d.className='ovl hidden';
    d.innerHTML='<div class="ovbar"><span id="qrT" style="margin-right:auto;font-weight:300;letter-spacing:.14em;text-transform:uppercase;padding-left:6px"></span><button class="btn ghost sm" id="qrX" type="button" style="width:auto;margin:0">&times;</button></div><video id="qrV" playsinline muted></video><div id="qrBox"></div><div id="qrMsg"></div><canvas id="qrC" class="hidden"></canvas>';
    document.body.appendChild(d);QS.el=d;d.querySelector('#qrX').onclick=qrScanClose;
  }
  QS.cb=cb;var d2=QS.el;d2.classList.remove('hidden');d2.querySelector('#qrT').textContent=tr('scanQr');d2.querySelector('#qrMsg').textContent=tr('qrHelp');
  try{if(!QS.det&&window.BarcodeDetector)QS.det=new BarcodeDetector({formats:['qr_code']});}catch(e){QS.det=null;}
  (QS.det?Promise.resolve():qrLoadLib()).then(function(){return navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});}).then(function(st){
    QS.stream=st;var v=d2.querySelector('#qrV');v.srcObject=st;return v.play();
  }).then(function(){QS.on=true;qrLoop();},function(){d2.querySelector('#qrMsg').textContent=tr('camErr');});
}
function qrGot(raw){
  var m=String(raw||'').match(REFRE);
  if(!m){QS.el.querySelector('#qrMsg').textContent=tr('qrNone');setTimeout(function(){if(QS.stream){QS.on=true;QS.el.querySelector('#qrMsg').textContent=tr('qrHelp');qrLoop();}},1500);return;}
  var f=QS.cb;qrScanClose();if(f)f(m[0].toUpperCase());
}
function qrLoop(){
  if(!QS.on)return;
  var v=QS.el.querySelector('#qrV'),c=QS.el.querySelector('#qrC');
  if(v.readyState>=2&&v.videoWidth){
    if(QS.det){QS.det.detect(v).then(function(r){if(!QS.on)return;if(r&&r.length&&r[0].rawValue){QS.on=false;qrGot(r[0].rawValue);}else setTimeout(qrLoop,150);},function(){QS.det=null;setTimeout(qrLoop,150);});return;}
    if(window.jsQR){
      var w=Math.min(640,v.videoWidth),h=Math.round(w*v.videoHeight/v.videoWidth);if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;
      var x=c.getContext('2d',{willReadFrequently:true});x.drawImage(v,0,0,w,h);
      var im=x.getImageData(0,0,w,h),r=jsQR(im.data,w,h,{inversionAttempts:'dontInvert'});
      if(r&&r.data){QS.on=false;qrGot(r.data);return;}
    }
  }
  setTimeout(qrLoop,180);
}

/* ===== public verify (QR from a phone camera) ===== */
var VREF='',VRES=null;
var VK='',VSG=[],VAUTO=false,VMSG='';
function verifyOpen(ref,k){
  if(ref!==VREF){VSG=[];VAUTO=false;VMSG='';}
  VREF=ref;VK=k||'';VRES=null;$('vPass').innerHTML='';show('vVerify');verifyDraw();api({action:'verify',ref:ref,k:VK}).then(function(r){VRES=r||{ok:false};verifyDraw();
    /* scanned from the paper and not yet signed-and-uploaded: go straight to the scanner */
    if(VRES.ok&&VRES.upload&&!VAUTO&&!VSG.length){VAUTO=true;scanOpen(function(p){VSG.push(p);verifyDraw();});}
  },function(){VRES={ok:false,err:'net'};verifyDraw();});}
function verifyDraw(){
  var h=h1(tr('title'))+'<div class="ref" style="font-size:24px">'+esc(VREF)+'</div>';
  if(!VRES)h+='<p style="text-align:center"><span class="sp"></span>'+esc(tr('loading'))+'</p>';
  else if(!VRES.ok)h+='<div class="vbox bad"><div class="big">'+esc(errText(VRES.err||'server'))+'</div></div>';
  else if(!VRES.found)h+='<div class="vbox bad"><div class="big">'+esc(tr('v_nf'))+'</div><div>'+esc(tr('v_nf2'))+'</div></div>';
  else{
    var s=VRES.status,cls=s==='Pending release'?'ok':s==='Released'?'ok':s==='Awaiting signatures'?'wait':'bad';
    var k=s==='Pending release'?['v_ready','v_ready2']:s==='Released'?['v_rel','']:s==='Awaiting signatures'?['v_wait','v_wait2']:s==='Rejected'?['v_rej','']:s==='Cancelled'?['v_can','']:['v_exp',''];
    h+='<div class="vbox '+cls+'"><div class="big">'+esc(tr(k[0]))+'</div>'+(k[1]?'<div>'+esc(tr(k[1]))+'</div>':'')+(s==='Released'&&VRES.decidedAt?'<div>'+esc(VRES.decidedAt)+' WIB</div>':'')+'</div>';
    h+='<div class="card"><div class="kv"><span>'+esc(tr('date'))+'</span><span>'+esc(fmtD(VRES.date))+'</span><span>'+esc(tr('compShort'))+'</span><span>'+esc(VRES.company)+'</span><span>'+esc(tr('vehShort'))+'</span><span>'+esc(vehTxt(VRES.vehicle))+'</span><span>'+esc(tr('items'))+'</span><span>'+esc(VRES.items)+'</span></div></div>';
  }
  if(VRES&&VRES.ok&&VRES.found&&VRES.upload){
    h+='<div class="card"><h2 style="margin-top:0">'+esc(tr('upload'))+'</h2><p class="note">'+esc(tr('vUpHelp'))+'</p>';
    h+='<div class="tiles">'+VSG.map(function(x,i){return '<div class="tile on" style="cursor:default"><img alt="" data-zoom="data:image/jpeg;base64,'+x+'" src="data:image/jpeg;base64,'+x+'"><button class="btn danger sm" type="button" data-vsgrm="'+i+'">'+esc(tr('remove'))+'</button></div>';}).join('')+(VSG.length<2?'<button type="button" class="tile ph" style="margin:0;font:inherit;color:inherit" data-vscan="1"><span style="font-size:28px">&#128247;</span><span>'+esc(VSG.length?tr('scanNext'):tr('scanBtn'))+'</span></button>':'')+'</div><input type="file" accept="image/*" id="sgIn" class="hidden">';
    if(VSG.length<2)h+='<button class="btn ghost sm" type="button" id="vFile">'+esc(tr('scanFile'))+'</button>';
    h+='<div class="err" id="vErr">'+esc(VMSG)+'</div>'+(VSG.length?'<button class="btn amber" id="vSend" type="button">'+esc(tr('sendSigned'))+'</button>':'')+'</div>';
  }
  if(VRES&&VRES.ok&&VRES.found){
    if(tokenOf(VREF))h+='<button class="btn" id="vOpen" type="button">'+esc(tr('openPass'))+'</button>';
    else h+='<button class="btn" id="vTake" type="button">'+esc(tr('takeOver'))+'</button>';
  }
  if(FD.from==='find')h+='<button class="btn ghost" id="vBack" type="button">'+esc(tr('back'))+'</button>';
  h+='<a class="btn ghost" href="'+esc(APP_URL)+'">'+esc(tr('openApp'))+'</a>';
  $('vVerify').innerHTML=h;
}

$('vVerify').addEventListener('change',function(e){
  if(e.target.id==='sgIn'){var f=e.target.files&&e.target.files[0];if(!f)return;shrink(f,null,1600,0.7).then(function(p){VSG.push(p);verifyDraw();},function(){VMSG=tr('err_bad_photo');verifyDraw();});}
});
$('vVerify').addEventListener('click',function(e){
  var t=e.target.closest('button');if(!t)return;
  if(t.getAttribute('data-vscan')){scanOpen(function(p){VSG.push(p);VMSG='';verifyDraw();});return;}
  if(t.getAttribute('data-vsgrm')!==null){VSG.splice(+t.getAttribute('data-vsgrm'),1);verifyDraw();return;}
  if(t.id==='vFile'){var fi=$('sgIn');if(fi)fi.click();return;}
  if(t.id==='vSend'){
    if(BUSY||!VSG.length)return;BUSY=true;t.disabled=true;$('vErr').innerHTML='<span class="sp"></span>'+esc(tr('sending'));
    api({action:'signed',ref:VREF,k:VK,photos:VSG},120000).then(function(r){return r;},function(){return null;}).then(function(r){
      BUSY=false;
      if(!r){VMSG=tr('err_net');verifyDraw();return;}
      if(!r.ok){VMSG=errText(r.err);verifyDraw();return;}
      VSG=[];VMSG='';var ref=VREF;verifyOpen(ref,'');
    });
    return;
  }
  if(t.id==='vOpen')passOpen(VREF);
  else if(t.id==='vTake'){FD.take=VREF;FD.err='';show('vFind');findDraw();}
  else if(t.id==='vBack'){FD.take='';findDraw();show('vFind');}
});

/* ===== admin ===== */
var AD={pin:ls('gp_apin')||'',list:null,counts:{},q:'',st:'',sel:null,chk:{}};
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
  h+='<div class="err">'+esc(AD.err||'')+'</div>'+(AD.note?'<div class="note">'+esc(AD.note)+'</div>':'');
  (AD.list||[]).forEach(function(s){h+='<div class="adrow"><input type="checkbox" data-adsel="'+esc(s.ref)+'"'+(AD.chk[s.ref]?' checked':'')+' aria-label="'+esc(s.ref)+'"><button class="pas" type="button" data-adopen="'+esc(s.ref)+'"><span><b>'+esc(s.ref)+'</b><small>'+esc(s.company+' · '+s.vehicle+' · '+s.carrier)+'<br>'+esc(s.createdAt)+'</small></span>'+chip(s.status)+'</button></div>';});
  var nsel=Object.keys(AD.chk).filter(function(k){return AD.chk[k];}).length;
  if(nsel)h+='<button class="btn danger" id="adDelSel" type="button">'+esc(tr('adDeleteSel').replace('{n}',nsel))+'</button>';
  h+='<button class="btn ghost" id="adCsv" type="button">'+esc(tr('csv'))+'</button><button class="btn ghost" id="adOut" type="button">'+esc(tr('logout'))+'</button><button class="btn ghost" id="adBack" type="button">'+esc(tr('back'))+'</button>';
  $('vAdmin').innerHTML=h;
}
/* v1.18: the Admin sees the signed copy pages (and the photos) right inside the pass, tap to zoom */
function adPicsLoad(ref){
  var bt=$('adPicsBtn');if(bt)bt.style.display='none';var e0=$('adPics');if(e0)e0.innerHTML='<span class="sp"></span>';
  api({action:'photos',ref:ref,pin:AD.pin,signed:true},60000).then(function(r){
    var el=$('adPics');if(!el||!AD.sel||AD.sel.pass.ref!==ref)return;
    if(!r||!r.ok||!r.images){el.innerHTML='<p class="note">'+esc(tr('picsFail'))+'</p>';return;}
    var sg=(r.images.signed||[]).filter(function(x){return x;}),h='';
    if(!sg.length&&r.images.signed===undefined)h='<p class="note" style="grid-column:1/-1">'+esc(tr('picsOld'))+'</p>';
    else if(!sg.length)h='<p class="note" style="grid-column:1/-1">'+esc(tr('noSigned'))+'</p>';
    sg.forEach(function(u,i){h+='<div class="pv"><small class="note">'+esc(tr('upload'))+' '+(i+1)+'</small><img alt="" data-zoom="'+u+'" src="'+u+'"></div>';});
    PHV.forEach(function(v){if(r.images[v])h+='<div class="pv"><small class="note">'+esc(phl(v,isHC(AD.sel.pass.vehicle)))+'</small><img alt="" data-zoom="'+r.images[v]+'" src="'+r.images[v]+'"></div>';});
    el.innerHTML=h;
  },function(){var el=$('adPics');if(el)el.innerHTML='<p class="note">'+esc(tr('picsFail'))+'</p>';});
}
function adminDetailDraw(h){
  var d=AD.sel,p=d.pass;
  h+='<div class="ref" style="font-size:24px">'+esc(p.ref)+'</div><div>'+chip(p.status)+'</div><div class="card"><div class="kv"><span>'+esc(tr('compShort'))+'</span><span>'+esc(p.company)+'</span><span>'+esc(tr('vehShort'))+'</span><span>'+esc(vehTxt(p.vehicle))+'</span><span>'+esc(tr('driver'))+'</span><span>'+esc(p.carrier+' ('+p.icNo+')')+'</span><span>'+esc(tr('ecoDept'))+'</span><span>'+esc(p.dept)+'</span><span>'+esc(tr('icRepShort'))+'</span><span>'+esc(p.icRep+' '+p.icPos)+'</span><span>'+esc(tr('purposeText'))+'</span><span>'+esc(p.purposeText)+'</span>'+(p.decidedBy?'<span>'+esc(tr('releasedBy'))+'</span><span>'+esc(p.decidedBy+' · '+p.decidedAt)+(p.note?' · '+esc(p.note):'')+'</span>':'')+(d.lat!==''&&d.lat!=null?'<span>GPS</span><span>'+esc(d.lat+', '+d.lng)+'</span>':'')+'</div>';
  h+='<table class="it"><tr><th>#</th><th>'+esc(tr('itemName'))+'</th><th>'+esc(tr('qty'))+'</th><th>'+esc(tr('unit'))+'</th></tr>'+p.items.map(function(it,i){return '<tr><td>'+(i+1)+'</td><td>'+esc(it.item)+'</td><td>'+esc(it.qty)+'</td><td>'+esc(it.unit)+'</td></tr>';}).join('')+'</table></div>';
  h+='<h2>'+esc(tr('links'))+'</h2><div>'+[['front',d.links.front],['load',d.links.load],['top',(d.links.old||[])[0]],['left',(d.links.old||[])[1]],['right',(d.links.old||[])[2]]].filter(function(x){return x[1]&&/^http/.test(x[1])&&!(x[0]==='top'&&x[1]===d.links.load);}).map(function(x){return '<a class="btn ghost sm" target="_blank" rel="noopener" href="'+esc(x[1])+'">'+esc(tr('ph_'+x[0]))+'</a>';}).join('')+d.links.signed.map(function(u,i){return '<a class="btn sm" target="_blank" rel="noopener" href="'+esc(u)+'">'+esc(tr('upload'))+' '+(i+1)+'</a>';}).join('')+'</div>';
  h+='<h2>'+esc(tr('signedCopy'))+'</h2><button class="btn ghost" id="adPicsBtn" type="button">'+esc(tr('showPics'))+'</button><div id="adPics" class="row2"></div>';
  h+='<h2>'+esc(tr('auditLog'))+'</h2><table class="it adm"><tr><th>Time</th><th>Event</th><th>By</th><th>Detail</th></tr>'+d.log.map(function(l){return '<tr><td>'+esc(l.t)+'</td><td>'+esc(l.ev)+'</td><td>'+esc(l.by)+'</td><td>'+esc(l.d)+'</td></tr>';}).join('')+'</table>';
  if(p.status==='Awaiting signatures'||p.status==='Pending release')h+='<button class="btn danger" id="adCancel" type="button">'+esc(tr('adminCancel'))+'</button>';
  h+='<button class="btn" id="adPrint" type="button">'+esc(tr('printAgain'))+'</button><button class="btn ghost" id="adPdf" type="button">'+esc(tr('dlPdf'))+'</button><button class="btn danger" id="adDel" type="button">'+esc(tr('adDelete'))+'</button><button class="btn ghost" id="adList" type="button">'+esc(tr('back'))+'</button>';
  $('vAdmin').innerHTML=h;
}
$('vAdmin').addEventListener('input',function(e){if(e.target.id==='adQ'){AD.note='';AD.q=e.target.value;clearTimeout(AD.tm);AD.tm=setTimeout(adminLoad,400);}});
$('vAdmin').addEventListener('change',function(e){
  if(e.target.id==='adSt'){AD.st=e.target.value;adminLoad();}
  else if(e.target.getAttribute('data-adsel')){AD.chk[e.target.getAttribute('data-adsel')]=e.target.checked;adminDraw();}
});
function adminDelete(refs){
  if(!refs.length)return;
  if(!window.confirm(tr('delAsk').replace('{n}',refs.length)+'\n\n'+refs.join('\n')))return;
  api({action:'a_delete',pin:AD.pin,refs:refs},60000).then(function(r){
    if(!r||!r.ok){AD.err=errText(r&&r.err);adminDraw();return;}
    refs.forEach(function(x){delete AD.chk[x];delete PHC[x];});MINE=MINE.filter(function(m){return refs.indexOf(m.ref)<0;});saveMine();
    AD.sel=null;AD.note=tr('delDone').replace('{n}',r.deleted.length);adminLoad();
  },function(){AD.err=tr('err_net');adminDraw();});
}
$('vAdmin').addEventListener('click',function(e){
  var t=e.target.closest('button');if(!t)return;
  if(t.id==='adBack')homeOpen();
  else if(t.id==='adGo'){AD.pin=$('adPin').value.trim();ls('gp_apin',AD.pin);adminLoad();}
  else if(t.id==='adOut'){AD.pin='';AD.list=null;ls('gp_apin',null);adminDraw();}
  else if(t.id==='adList'){AD.sel=null;adminDraw();}
  else if(t.id==='adPicsBtn'){adPicsLoad(AD.sel.pass.ref);}
  else if(t.getAttribute('data-adopen')){api({action:'a_get',pin:AD.pin,ref:t.getAttribute('data-adopen')}).then(function(r){if(r&&r.ok){AD.sel=r;adminDraw();}else{AD.err=errText(r&&r.err);adminDraw();}});}
  else if(t.id==='adCancel'){var why=window.prompt(tr('cancelWhy'),'');if(why===null)return;api({action:'a_cancel',pin:AD.pin,ref:AD.sel.pass.ref,reason:why}).then(function(r){AD.sel=null;adminLoad();});}
  else if(t.id==='adPrint'){var p=AD.sel.pass;p.siteLead=p.siteLead||CFG.siteLead;printPass(p);}
  else if(t.id==='adPdf'){var p2=AD.sel.pass;p2.siteLead=p2.siteLead||CFG.siteLead;pdfPass(p2,t);}
  else if(t.id==='adDel'){adminDelete([AD.sel.pass.ref]);}
  else if(t.id==='adDelSel'){adminDelete(Object.keys(AD.chk).filter(function(k){return AD.chk[k];}));}
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
  var mk=/[?&]k=([A-Za-z0-9]+)/.exec(location.search);
  if(m){verifyOpen(decodeURIComponent(m[1]).toUpperCase(),mk?mk[1]:'');return;}
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
document.addEventListener('keydown',function(e){if(e.key==='Escape'){zoomClose();scanClose();qrScanClose();}});

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
  SC.shot=c.toDataURL('image/jpeg',0.8).split(',')[1];   /* colour copy: no grey, no black-and-white */
  d.querySelector('#scP').src='data:image/jpeg;base64,'+SC.shot;scanMode('prev');
}

