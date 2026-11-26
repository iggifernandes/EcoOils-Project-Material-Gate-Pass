/* EcoOils Mentari - Material Gate Pass backend (Google Apps Script)  v1.22
   Form EOSM-HSSE-FM003. Paste into Extensions > Apps Script of the "EcoOils Gate Pass Log" Google Sheet (personal Gmail account).
   Do NOT upload this file to GitHub (keep the repo to index.html and the static files only).
   Who calls this web app:
   - ICs (anyone with the link): create a pass, upload the signed copy, cancel, check status. Protected by a per-pass token kept on the IC's phone.
   - Public QR check: action 'verify' returns status only (no names, no ID numbers, no photos).
   - Patroli (guards): actions b_list / b_get / b_release, protected by the shared secret BRIDGE_SECRET (script property). The guard's name comes from Patroli's PIN login.
   - Admin (you): actions a_*, protected by the script property ADMIN_PIN. */
var VERSION = 'v1.22';
var OFF = 7 * 3600000;      // Jakarta (WIB), no daylight saving
var TZ = 'Asia/Jakarta';
var P_HEAD = ['Ref', 'Created (WIB)', 'Date', 'Purpose', 'Carrier name', 'Carrier I/C no', 'Company', 'Vehicle no', 'Purpose of taking out', 'EcoOils dept', 'IC rep name', 'IC rep position', 'Items', 'Status', 'Token hash',
  'Photo front', 'Photo load', 'Photo left (old)', 'Photo right (old)', 'Photo IDs', 'Signed copy links', 'Signed IDs', 'Signed at (WIB)', 'Decided by', 'Decided at (WIB)', 'Decision note', 'Dec lat', 'Dec lng', 'Dec acc', 'Checklist', 'Created ms', 'Signed ms', 'Decided ms', 'Cancelled reason', 'Decider role', 'Client id', 'IC rep phone', 'Extra photo IDs'];
var PC = {}; P_HEAD.forEach(function (h, i) { PC[h] = i; });
var HEAD = {
  Passes: P_HEAD,
  Items: ['Ref', 'S/No', 'Item', 'Qty', 'Unit'],
  Log: ['Time (WIB)', 'Ref', 'Event', 'By', 'Detail'],
  Config: ['Key', 'Value']
};
var UNITS_DEF = 'Pcs,Units,Kgs,Ton,Liters,Meters,Sets,Rolls,Drums,Bags,Boxes,Pallets,Lots';
var VIEWS = ['front', 'load'];          /* v1.3: 2 photos. Passes made before v1.3 hold 4 (front, top, left, right) and are read by photo count. */
var OLD_VIEWS = ['front', 'top', 'left', 'right'];
/* v1.10: up to 4 optional extra photos (x1..x4) next to the 2 required ones; their Drive ids live in 'Extra photo IDs' as x1:id,x2:id */
var XVIEWS = ['x1', 'x2', 'x3', 'x4'];
function extraIds_(v) { var o = {}; String(v[PC['Extra photo IDs']] || '').split(',').forEach(function (p) { var k = p.split(':'); if (k.length === 2 && XVIEWS.indexOf(k[0]) >= 0 && k[1]) o[k[0]] = k[1]; }); return o; }
function viewsOf_(ids) { return ids.length >= 4 ? OLD_VIEWS : VIEWS; }
var ST_WAIT = 'Awaiting signatures', ST_PEND = 'Pending release', ST_REL = 'Released', ST_REJ = 'Rejected', ST_CAN = 'Cancelled', ST_EXP = 'Expired';

/* ---------- one-time setup (run from the editor) ---------- */
function setup() {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEAD).forEach(function (n) {
    var sh = s.getSheetByName(n) || s.insertSheet(n);
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEAD[n]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, HEAD[n].length).setFontWeight('bold');
    } else if (n === 'Passes') {
      sh.getRange(1, 1, 1, HEAD[n].length).setValues([HEAD[n]]).setFontWeight('bold');   /* adds new columns at the end, never moves old ones */
    }
  });
  var d = s.getSheetByName('Sheet1');
  if (d && s.getSheets().length > 1 && d.getLastRow() === 0) s.deleteSheet(d);
  var c = s.getSheetByName('Config');
  if (c.getLastRow() < 2) c.getRange(2, 1, 6, 2).setValues([['COMPANIES', 'GSB,WEN,KKS,PBS'], ['DEPTS', 'Project Eng,Discipline Eng,HSSE,Stores'], ['VALID_HOURS', '48'], ['SIGN_WINDOW_HOURS', '72'], ['COMPANY_DAILY_CAP', '40'], ['SITE_LEAD_NAME', '']]);
  var p = props_();
  if (!p.getProperty('ADMIN_PIN') && !p.getProperty('ADMIN_PIN_HASH')) p.setProperty('ADMIN_PIN', rand6_());
  if (!p.getProperty('BRIDGE_SECRET')) p.setProperty('BRIDGE_SECRET', secret_());
  if (!p.getProperty('TOKEN_SALT')) p.setProperty('TOKEN_SALT', secret_());
  folder_();
  Logger.log('Setup done. Now run showCodes and read ADMIN_PIN and BRIDGE_SECRET in the Execution log.');
}
/* Prints the Admin PIN and the Patroli bridge secret in the Execution log. Copy the secret into Patroli (Project Settings > Script properties > GATEPASS_SECRET). Never paste it in chat or WhatsApp. */
function showCodes() {
  var p = props_();
  Logger.log(p.getProperty('ADMIN_PIN_HASH') ? 'ADMIN_PIN was reset by email and is stored only as a hash. Use Forgot PIN in the app.' : 'ADMIN_PIN = ' + p.getProperty('ADMIN_PIN'));
  Logger.log('BRIDGE_SECRET = ' + p.getProperty('BRIDGE_SECRET'));
}
function rand6_() { return ('00000' + Math.floor(Math.random() * 1000000)).slice(-6); }
function secret_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }

/* ---------- helpers ---------- */
function props_() { return PropertiesService.getScriptProperties(); }
function sh_(n) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n); }
function p2_(n) { return (n < 10 ? '0' : '') + n; }
function ymdhms_(ms) { return new Date(ms + OFF).toISOString().replace('T', ' ').slice(0, 19); }
function ymd_(ms) { return new Date(ms + OFF).toISOString().slice(0, 10); }
function num_(v) { if (v === '' || v == null) return null; var n = Number(v); return isFinite(n) ? n : null; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
/* v1.9: text that starts with = + - @ would be read by Google Sheets as a formula (a phone number like +62 812... showed as #ERROR!). A leading apostrophe stores it as plain text. */
function safe_(v) { return (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v; }
function clean_(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
var CFGM_ = null;
function cfg_(k, def) {
  if (!CFGM_) {
    CFGM_ = {};
    var sh = sh_('Config'), n = sh.getLastRow();
    if (n > 1) sh.getRange(2, 1, n - 1, 2).getValues().forEach(function (r) { var key = String(r[0]); if (!Object.prototype.hasOwnProperty.call(CFGM_, key)) CFGM_[key] = String(r[1]); });
  }
  return Object.prototype.hasOwnProperty.call(CFGM_, k) ? CFGM_[k] : def;
}
function cfgNum_(k, def) { var v = Number(cfg_(k, def)); return isFinite(v) && v > 0 ? v : def; }
var DEPT_P_DEF = 'Project Management,Project Engineering,Discipline Engineering,Construction,Commissioning and Start-up,HSSE,Quality (QA/QC),Planning and Cost Control,Document Control,Procurement and Contracts,Stores and Warehouse,Environmental,Fire and Emergency,Medical / Clinic,IT and Communications,Finance and Accounting,Admin and General Affairs,Government and Community Relations,HR,Security';
var DEPT_O_DEF = 'Plant Operations,Process Engineering,Maintenance (Mechanical),Maintenance (Electrical and Instrument),Reliability and Inspection,Laboratory,Quality Control (Operations),Utilities,HSSE (Operations),Environmental,Fire and Emergency,Medical / Clinic,Stores and Warehouse (Operations),Logistics and Dispatch,IT and Communications,Finance and Accounting,Admin and General Affairs,Government and Community Relations,HR,Security';
/* v1.12: EcoOils section (Project or Operations) then department; stored as 'Project - HSSE'. Config keys DEPTS_PROJECT and DEPTS_OPERATIONS. Old plain DEPTS values are still accepted. */
function courierOk_(s) {
  /* 'COURIER JNE AWB JNE123 | REP Budi Santoso (KTP 1234567890123456)': courier company, optional waybill, and the EcoOils rep (name + KTP 16 digits or SIM 12 digits) who owns the hand-over (required) */
  if (s.indexOf('COURIER ') !== 0) return false;
  var q = s.slice(8).split(' | REP ');
  if (q.length !== 2 || !/^[A-Za-z][A-Za-z .'\-]{1,59} \((KTP \d{16}|SIM \d{12})\)$/.test(q[1])) return false;
  var p = q[0].split(' AWB ');
  if (p.length > 2 || !/^[A-Za-z0-9 .&\-\/()]{2,40}$/.test(p[0])) return false;
  return p.length === 1 || /^[A-Za-z0-9\-]{4,30}$/.test(p[1]);
}
function deptGroups_() { return {Project: cfgList_('DEPTS_PROJECT', DEPT_P_DEF), Operations: cfgList_('DEPTS_OPERATIONS', DEPT_O_DEF)}; }
function deptOk_(d) {
  var g = deptGroups_();
  /* v1.19: 'Project - Other: <free text>' / 'Operations - Other: <free text>' */
  if (/^(Project|Operations) - Other: [A-Za-z0-9 .,&()\/\-]{2,60}$/.test(d)) return true;
  return ['Project', 'Operations'].some(function (s) { return g[s].some(function (x) { return d === s + ' - ' + x; }); }) || cfgList_('DEPTS', 'Project Eng,Discipline Eng,HSSE,Stores').indexOf(d) >= 0;
}
function cfgList_(k, def) { return String(cfg_(k, def)).split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x; }); }
function failed_(k) { var c = CacheService.getScriptCache(); c.put(k, String(Number(c.get(k) || 0) + 1), 600); }
function locked_(k, max) { return Number(CacheService.getScriptCache().get(k) || 0) >= max; }
function hits_(k, max, secs) { var c = CacheService.getScriptCache(), n = Number(c.get(k) || 0) + 1; c.put(k, String(n), secs); return n <= max; }
function adminOk_(pin) {
  if (locked_('fp', 10)) return false;
  var pr = props_(), hh = pr.getProperty('ADMIN_PIN_HASH'), pn = String(pin || '').trim();
  var ok = !!pn && (hh ? hash_('AP|' + pn) === hh : pn === String(pr.getProperty('ADMIN_PIN') || '').trim());
  if (!ok) failed_('fp');
  return ok;
}
function bridgeOk_(sec) {
  if (locked_('fb', 20)) return false;
  var s = String(props_().getProperty('BRIDGE_SECRET') || '');
  var ok = !!s && String(sec || '') === s;
  if (!ok) failed_('fb');
  return ok;
}
function hash_(t) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(props_().getProperty('TOKEN_SALT') || '') + '|' + String(t)).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function folder_() {
  var p = props_(), id = p.getProperty('PASS_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { Logger.log('PASS_FOLDER cannot be opened: ' + e); } }
  var f = DriveApp.createFolder('EcoOils Material Gate Pass');
  p.setProperty('PASS_FOLDER', f.getId());
  return f;
}
function log_(ref, ev, by, detail) { sh_('Log').appendRow([ymdhms_(Date.now()), ref || '', ev, safe_(by || ''), safe_(detail || '')]); }

/* ---------- rows ---------- */
function dateStr_(x) {
  if (Object.prototype.toString.call(x) === '[object Date]') {
    var tz = '';
    try { tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(); } catch (e) {}
    return Utilities.formatDate(x, tz || 'Asia/Jakarta', 'yyyy-MM-dd');
  }
  return String(x == null ? '' : x);
}
var ROWS_ = null;
function rows_() {
  if (ROWS_) return ROWS_;
  var sh = sh_('Passes'), n = sh.getLastRow();
  ROWS_ = n > 1 ? sh.getRange(2, 1, n - 1, P_HEAD.length).getValues() : [];
  /* v1.13: Google Sheets turns the text '2026-11-14' into a real date; read it back as 'YYYY-MM-DD' again (it printed as 'Sat Nov 14 2026 00:00:00 GMT+0700' and broke the daily cap and expiry) */
  ROWS_.forEach(function (r) { r[PC['Date']] = dateStr_(r[PC['Date']]); });
  return ROWS_;
}
function rowOf_(ref) {
  var rs = rows_(), r = String(ref || '').trim().toUpperCase();
  for (var i = 0; i < rs.length; i++) if (String(rs[i][0]).toUpperCase() === r) return {row: i + 2, v: rs[i]};
  return null;
}
function setCell_(row, name, val) { sh_('Passes').getRange(row, PC[name] + 1).setValue(safe_(val)); }
/* One-time repair (run it once from the Apps Script editor): phone numbers that already show #ERROR! are turned back into text when the original number can still be read from the cell. */
function repairPhones() {
  var sh = sh_('Passes'), n = sh.getLastRow(), col = PC['IC rep phone'] + 1, fixed = 0, lost = 0;
  if (n < 2) return 'nothing to repair';
  var rg = sh.getRange(2, col, n - 1, 1), vals = rg.getValues(), fs = rg.getFormulas();
  for (var i = 0; i < vals.length; i++) {
    var f = String(fs[i][0] || ''), v = String(vals[i][0] || '');
    if (f) { var t = f.replace(/^=/, '').trim(); var cell = sh.getRange(i + 2, col); cell.setNumberFormat('@'); cell.setValue(t); fixed++; }
    else if (/^#(ERROR|NAME|VALUE|REF|N\/A)/.test(v)) lost++;
  }
  Logger.log('repairPhones: fixed ' + fixed + ', could not recover ' + lost);
  return 'fixed ' + fixed + ', could not recover ' + lost;
}
function itemsOf_(ref) {
  var sh = sh_('Items'), n = sh.getLastRow(), out = [];
  if (n < 2) return out;
  sh.getRange(2, 1, n - 1, 5).getValues().forEach(function (r) { if (String(r[0]) === ref) out.push({no: Number(r[1]), item: String(r[2]), qty: Number(r[3]), unit: String(r[4] || '')}); });
  out.sort(function (a, b) { return a.no - b.no; });
  return out;
}
/* Status now (v1.3): a pass is valid only on the day it was issued (Jakarta date). After that, anything not yet Released/Rejected/Cancelled reads Expired. */
function statusNow_(v, now) {
  var st = String(v[PC['Status']]);
  if ((st === ST_WAIT || st === ST_PEND) && ymd_(now) > String(v[PC['Date']])) return ST_EXP;
  return st;
}
function validUntil_(v) { return 0; }   /* validity is not shown anywhere any more */
function summary_(v, now) {
  var st = statusNow_(v, now);
  return {ref: String(v[0]), date: String(v[PC['Date']]), company: String(v[PC['Company']]), vehicle: String(v[PC['Vehicle no']]), carrier: String(v[PC['Carrier name']]), items: Number(v[PC['Items']]) || 0, status: st,
    createdAt: String(v[PC['Created (WIB)']]), signedAt: String(v[PC['Signed at (WIB)']] || ''), validUntil: validUntil_(v), decidedBy: String(v[PC['Decided by']] || ''), decidedAt: String(v[PC['Decided at (WIB)']] || ''), note: String(v[PC['Decision note']] || ''), purpose: String(v[PC['Purpose']])};
}
function full_(v, now) {
  var o = summary_(v, now);
  o.icNo = String(v[PC['Carrier I/C no']]); o.purposeText = String(v[PC['Purpose of taking out']]); o.dept = String(v[PC['EcoOils dept']]);
  o.icRep = String(v[PC['IC rep name']]); o.icPos = String(v[PC['IC rep position']]); o.icPhone = String(v[PC['IC rep phone']] || ''); o.items = itemsOf_(o.ref); o.itemCount = o.items.length; o.decidedRole = String(v[PC['Decider role']] || '');
  o.cancelReason = String(v[PC['Cancelled reason']] || ''); o.siteLead = cfg_('SITE_LEAD_NAME', ''); o.hofName = cfg_('HOF_NAME', ''); o.qk = key_(o.ref);
  return o;
}
function tokenOk_(hit, tok) {
  if (!hit || !tok) return false;
  return String(hit.v[PC['Token hash']]) === hash_(tok);
}

/* ---------- web app ---------- */
function doGet() { return out_({ok: true, version: VERSION}); }
function doPost(e) {
  var res;
  try { res = route_(JSON.parse(e.postData.contents)); } catch (err) { res = {ok: false, err: 'server', msg: String(err)}; }
  return out_(res);
}
function route_(b) {
  CFGM_ = null; ROWS_ = null;
  var a = String(b.action || '');
  if (a === 'ping') return {ok: true, version: VERSION};
  if (a === 'config') return config_();
  if (a === 'create') return create_(b);
  if (a === 'mine') return mine_(b);
  if (a === 'get') return get_(b);
  if (a === 'photos') return photos_(b);
  if (a === 'find') return find_(b);
  if (a === 'lookup') return lookup_(b);
  if (a === 'signed') return signed_(b);
  if (a === 'cancel') return cancel_(b);
  if (a === 'verify') return verify_(b);
  if (a === 'a_forgot') return adminForgot_();
  if (a === 'a_reset') return adminReset_(b);
  if (a.indexOf('a_') === 0) { if (!adminOk_(b.pin)) return {ok: false, err: 'pin'}; return admin_(a, b); }
  if (a.indexOf('b_') === 0) { if (!bridgeOk_(b.secret)) return {ok: false, err: 'auth'}; return bridge_(a, b); }
  return {ok: false, err: 'action'};
}
function config_() {
  return {ok: true, version: VERSION, units: cfgList_('UNITS', UNITS_DEF), companies: companies_(), depts: cfgList_('DEPTS', 'Project Eng,Discipline Eng,HSSE,Stores'), deptGroups: deptGroups_(), deptOther: true, courier: true, validHours: cfgNum_('VALID_HOURS', 48), signHours: cfgNum_('SIGN_WINDOW_HOURS', 72), maxItems: 15, siteLead: cfg_('SITE_LEAD_NAME', ''), hofName: cfg_('HOF_NAME', ''), now: Date.now()};
}
/* Short key printed inside the pass QR. Whoever scans the paper QR may upload the signed copy of a pass that is still Awaiting signatures; nothing else. */
function key_(ref) { return hash_('QK|' + String(ref).toUpperCase()).slice(0, 12); }
/* The four contractors come from Config COMPANIES; the two EcoOils entries are always offered after them. */
var CO_EXTRA = ['EcoOils (Project)', 'EcoOils (Operations)'];
function companies_() {
  var l = cfgList_('COMPANIES', 'GSB,WEN,KKS,PBS').filter(function (c) { return !/^ecooils\b/i.test(c); });
  return l.concat(CO_EXTRA);
}
function coCode_(company) {
  var u = String(company || '').toUpperCase();
  if (/^ECOOILS\s*\(?\s*PROJECT/.test(u)) return 'EOP';        /* EcoOils (Project)    -> MGP-EOP-... */
  if (/^ECOOILS\s*\(?\s*OPERATION/.test(u)) return 'EOO';      /* EcoOils (Operations) -> MGP-EOO-... */
  return coCode0_(company);
}
function coCode0_(company) { var c = String(company || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); return c || 'XXX'; }
function nextRef_(now, company) {
  var cc = coCode_(company), iso = new Date(now + OFF).toISOString(), ym = iso.slice(2, 4) + iso.slice(5, 7), pre = 'MGP-' + cc + '-' + ym + '-', max = 0;
  rows_().forEach(function (r) { var s = String(r[0]); if (s.indexOf(pre) === 0) { var n = parseInt(s.slice(pre.length), 10); if (n > max) max = n; } });
  var pk = 'SEQ_' + cc + '_' + ym, pv = parseInt(props_().getProperty(pk) || '0', 10);
  var n2 = Math.max(max, pv || 0) + 1;
  props_().setProperty(pk, String(n2));
  return pre + ('000' + n2).slice(-4);
}
function b64ok_(s, min, max) {
  s = String(s || '');
  if (s.length < min || s.length > max || !/^[A-Za-z0-9+\/=]+$/.test(s.slice(0, 200))) return false;
  try { var by = Utilities.base64Decode(s.slice(0, 16)); return by[0] === -1 && by[1] === -40; } catch (e) { return false; }
}
function passFolder_(ref) {
  var root = folder_(), it = root.getFoldersByName(ref);
  return it.hasNext() ? it.next() : root.createFolder(ref);
}
function saveImg_(b64, name, ref) {
  var f = passFolder_(ref).createFile(Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', name));
  return {id: f.getId(), url: f.getUrl()};
}
function create_(b) {
  if (String(b.hp || '') !== '') return {ok: false, err: 'bad'};
  var cl = cfgList_('COMPANIES', 'GSB,WEN,KKS,PBS'), purpose = String(b.purpose || '').toUpperCase();
  if (purpose !== 'A' && purpose !== 'B') return {ok: false, err: 'bad_purpose'};
  var carrier = clean_(b.carrier, 60), icNo = clean_(b.icNo, 160), company = clean_(b.company, 60), vehicle = clean_(b.vehicle, 20).toUpperCase(), ptxt = clean_(b.purposeText, 300), dept = clean_(b.dept, 120);
  var icRep = clean_(b.icRep, 60), icPos = clean_(b.icPos, 40), icPhone = clean_(b.icPhone, 20);
  if (carrier.length < 2) return {ok: false, err: 'bad_carrier'};
  /* v1.16: a courier (JNE etc.) is identified by company + waybill; no KTP/SIM number is taken */
  if (!/^(KTP \d{16}|SIM \d{12})$/.test(icNo) && !courierOk_(icNo)) return {ok: false, err: 'bad_icno'};
  if (company.length < 2) return {ok: false, err: 'bad_company'};
  if (vehicle.length < 2) return {ok: false, err: 'bad_vehicle'};
  if (ptxt.length < 3) return {ok: false, err: 'bad_purposetext'};
  if (icRep.length < 2) return {ok: false, err: 'bad_icrep'};
  if (icPos.length < 2) return {ok: false, err: 'bad_icpos'};
  if (!/^\+?[0-9][0-9 \-]{6,18}$/.test(icPhone) || icPhone.replace(/\D/g, '').length < 8 || icPhone.replace(/\D/g, '').length > 15) return {ok: false, err: 'bad_icphone'};
  if (!deptOk_(dept)) return {ok: false, err: 'bad_dept'};
  var its = b.items;
  if (!Array.isArray(its) || its.length < 1 || its.length > 15) return {ok: false, err: 'bad_items'};
  var items = [];
  for (var i = 0; i < its.length; i++) {
    var it = clean_(its[i] && its[i].item, 80), q = Number(its[i] && its[i].qty), un = clean_(its[i] && its[i].unit, 12);
    var uok = cfgList_('UNITS', UNITS_DEF).some(function (u) { return u.toLowerCase() === un.toLowerCase(); });
    if (it.length < 2 || !isFinite(q) || q <= 0 || q > 99999 || !uok) return {ok: false, err: 'bad_items'};
    items.push([i + 1, it, q, un]);
  }
  var ph = b.photos || {};
  for (var k = 0; k < VIEWS.length; k++) if (!b64ok_(ph[VIEWS[k]], 2000, 1500000)) return {ok: false, err: 'bad_photo', view: VIEWS[k]};
  var xs = XVIEWS.filter(function (x) { return ph[x] !== undefined && ph[x] !== null && ph[x] !== ''; });
  for (var xk = 0; xk < xs.length; xk++) if (!b64ok_(ph[xs[xk]], 2000, 1500000)) return {ok: false, err: 'bad_photo', view: xs[xk]};
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  var ref, token, now = Date.now(), saved = {};
  try {
    ROWS_ = null;
    var cid = clean_(b.cid, 40);
    if (cid) {
      var dup = null;
      rows_().forEach(function (r) { if (String(r[PC['Client id']]) === cid && now - Number(r[PC['Created ms']]) < 86400000) dup = r; });
      if (dup) {
        /* the phone re-sent a request whose answer was lost: do not create a second pass; hand this phone a fresh token for the one that exists */
        var dt = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 32), dh = rowOf_(String(dup[0]));
        setCell_(dh.row, 'Token hash', hash_(dt)); ROWS_ = null;
        return {ok: true, ref: String(dup[0]), token: dt, qk: key_(String(dup[0])), createdAt: String(dup[PC['Created (WIB)']]), date: String(dup[PC['Date']]), now: now, dup: true};
      }
    }
    var today = ymd_(now), cnt = 0;
    rows_().forEach(function (r) { if (String(r[PC['Date']]) === today && String(r[PC['Company']]).toUpperCase() === company.toUpperCase() && String(r[PC['Status']]) !== ST_CAN) cnt++; });
    if (cnt >= cfgNum_('COMPANY_DAILY_CAP', 40)) return {ok: false, err: 'daily_cap'};
    ref = nextRef_(now, company);
    token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 32);
    VIEWS.forEach(function (v) { saved[v] = saveImg_(ph[v], ref + '_' + v + '.jpg', ref); });
    var xsaved = xs.map(function (x) { return x + ':' + saveImg_(ph[x], ref + '_' + x + '.jpg', ref).id; });
    var row = new Array(P_HEAD.length).fill('');
    row[0] = ref; row[PC['Created (WIB)']] = ymdhms_(now); row[PC['Date']] = today; row[PC['Purpose']] = purpose; row[PC['Carrier name']] = carrier; row[PC['Carrier I/C no']] = icNo;
    row[PC['Company']] = company; row[PC['Vehicle no']] = vehicle; row[PC['Purpose of taking out']] = ptxt; row[PC['EcoOils dept']] = dept; row[PC['IC rep name']] = icRep; row[PC['IC rep position']] = icPos;
    row[PC['Items']] = items.length; row[PC['Status']] = ST_WAIT; row[PC['Token hash']] = hash_(token);
    row[PC['Photo front']] = saved.front.url; row[PC['Photo load']] = saved.load.url; row[PC['IC rep phone']] = icPhone;
    row[PC['Photo IDs']] = VIEWS.map(function (v) { return saved[v].id; }).join(','); row[PC['Extra photo IDs']] = xsaved.join(','); row[PC['Created ms']] = now; row[PC['Client id']] = cid;
    sh_('Passes').appendRow(row.map(safe_));
    var ish = sh_('Items');
    ish.getRange(ish.getLastRow() + 1, 1, items.length, 5).setValues(items.map(function (x) { return [ref, x[0], safe_(x[1]), x[2], x[3]]; }));
    log_(ref, 'CREATED', carrier, company + ' / ' + vehicle + ' / ' + items.length + ' items');
    ROWS_ = null;
  } finally { lock.releaseLock(); }
  return {ok: true, ref: ref, token: token, qk: key_(ref), createdAt: ymdhms_(now), date: ymd_(now), now: now};
}
function mine_(b) {
  var list = Array.isArray(b.list) ? b.list.slice(0, 40) : [], now = Date.now(), out = [];
  list.forEach(function (x) {
    var hit = rowOf_(x && x.ref);
    if (!hit || !tokenOk_(hit, x.token)) { out.push({ref: String(x && x.ref || ''), gone: true}); return; }
    out.push(summary_(hit.v, now));
  });
  return {ok: true, list: out, now: now};
}
/* The pass owner's own photos (needs the pass token), used to print the pass with its pictures and to zoom them. */
function photos_(b) {
  var hit = rowOf_(b.ref);
  if (!hit || !(tokenOk_(hit, b.token) || (b.pin && adminOk_(b.pin)))) return {ok: false, err: 'notfound'};
  var ids = String(hit.v[PC['Photo IDs']] || '').split(','), vs = viewsOf_(ids), imgs = {};
  vs.forEach(function (v, i) { imgs[v] = img_(ids[i]); });
  var xi = extraIds_(hit.v); Object.keys(xi).forEach(function (k) { imgs[k] = img_(xi[k]); });
  /* v1.8: the Admin can also open the signed copy pages (asked for with signed:true) */
  if (b.signed && b.pin && adminOk_(b.pin)) imgs.signed = String(hit.v[PC['Signed IDs']] || '').split(',').filter(function (x) { return x; }).map(img_);
  return {ok: true, ref: String(hit.v[0]), images: imgs};
}
function get_(b) {
  var hit = rowOf_(b.ref);
  if (!hit || !tokenOk_(hit, b.token)) return {ok: false, err: 'notfound'};
  var now = Date.now();
  return {ok: true, pass: full_(hit.v, now), now: now, validHours: cfgNum_('VALID_HOURS', 48)};
}
/* Lost phone or new phone: reference + vehicle number (both printed on the pass) hand out a fresh token for this device. */
function find_(b) {
  if (locked_('fd', 15)) return {ok: false, err: 'locked'};
  var hit = rowOf_(b.ref), veh = clean_(b.vehicle, 20).toUpperCase().replace(/\s+/g, '');
  if (!hit || String(hit.v[PC['Vehicle no']]).toUpperCase().replace(/\s+/g, '') !== veh) { failed_('fd'); return {ok: false, err: 'notfound'}; }
  var tok = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 32);
  setCell_(hit.row, 'Token hash', hash_(tok));
  log_(String(hit.v[0]), 'TOKEN_RESET', '', 'found by reference + vehicle');
  ROWS_ = null;
  return {ok: true, ref: String(hit.v[0]), token: tok, pass: summary_(hit.v, Date.now())};
}
/* Find by pass number or by the KTP/SIM number (or the QR text). Returns status-level facts only, same as the public QR page: no names, no ID numbers, no photos. Taking a pass over on a phone still needs the vehicle number (find_). */
function lookup_(b) {
  if (!hits_('lookup', 60, 600)) return {ok: false, err: 'busy'};
  var q = String(b.q || '').trim(), now = Date.now(), out = [];
  var m = q.toUpperCase().match(/MGP-[A-Z0-9]{1,8}-\d{4}-\d{3,}/);
  if (m) {
    var hit = rowOf_(m[0]);
    if (hit) out.push(pub_(summary_(hit.v, now)));
  } else {
    var d = q.replace(/\D/g, '');
    if (d.length === 12 || d.length === 16) {
      rows_().slice().reverse().forEach(function (v) {
        if (out.length < 10 && String(v[PC['Carrier I/C no']]).replace(/\D/g, '') === d) out.push(pub_(summary_(v, now)));
      });
    } else return {ok: false, err: 'bad_query'};
  }
  return {ok: true, list: out};
}
function pub_(s) { return {ref: s.ref, status: s.status, date: s.date, company: s.company, vehicle: s.vehicle, items: s.items}; }
function signed_(b) {
  var imgs = Array.isArray(b.photos) ? b.photos.slice(0, 2) : [];
  if (!imgs.length) return {ok: false, err: 'bad_photo'};
  for (var i = 0; i < imgs.length; i++) if (!b64ok_(imgs[i], 2000, 3000000)) return {ok: false, err: 'bad_photo'};
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    ROWS_ = null;
    var hit = rowOf_(b.ref);
    var viaKey = !!hit && !!b.k && String(b.k) === key_(String(hit.v[0])), viaTok = !!hit && tokenOk_(hit, b.token);
    if (!viaKey && !viaTok) return {ok: false, err: 'notfound'};
    var now = Date.now(), st = statusNow_(hit.v, now);
    if (st !== ST_WAIT && st !== ST_PEND) return {ok: false, err: 'not_open', status: st};
    if (!viaTok && st !== ST_WAIT) return {ok: false, err: 'not_open', status: st};   /* the QR key can only add the first signed copy, never replace one */
    var ref = String(hit.v[0]), saved = imgs.map(function (x, k) { return saveImg_(x, ref + '_signed_' + now + '_' + (k + 1) + '.jpg', ref); });
    setCell_(hit.row, 'Signed copy links', saved.map(function (s) { return s.url; }).join(' '));
    setCell_(hit.row, 'Signed IDs', saved.map(function (s) { return s.id; }).join(','));
    setCell_(hit.row, 'Signed at (WIB)', ymdhms_(now));
    setCell_(hit.row, 'Signed ms', now);
    setCell_(hit.row, 'Status', ST_PEND);
    log_(ref, st === ST_PEND ? 'SIGNED_REPLACED' : 'SIGNED_UPLOADED', String(hit.v[PC['Carrier name']]), imgs.length + ' page(s)' + (viaTok ? '' : ' via QR scan'));
    ROWS_ = null;
    return {ok: true, ref: ref, status: ST_PEND, signedAt: ymdhms_(now), validUntil: 0};
  } finally { lock.releaseLock(); }
}
function cancel_(b) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    ROWS_ = null;
    var hit = rowOf_(b.ref);
    if (!hit || !tokenOk_(hit, b.token)) return {ok: false, err: 'notfound'};
    var st = String(hit.v[PC['Status']]);
    if (st !== ST_WAIT && st !== ST_PEND) return {ok: false, err: 'not_open', status: statusNow_(hit.v, Date.now())};
    var why = clean_(b.reason, 200);
    setCell_(hit.row, 'Status', ST_CAN); setCell_(hit.row, 'Cancelled reason', why); setCell_(hit.row, 'Decided at (WIB)', ymdhms_(Date.now())); setCell_(hit.row, 'Decided ms', Date.now());
    log_(String(hit.v[0]), 'CANCELLED', String(hit.v[PC['Carrier name']]), why);
    ROWS_ = null;
    return {ok: true, status: ST_CAN};
  } finally { lock.releaseLock(); }
}
/* Public check from a phone camera: status only. No names, ID numbers or photos. */
function verify_(b) {
  var hit = rowOf_(b.ref);
  if (!hit) return {ok: true, found: false};
  var s = summary_(hit.v, Date.now());
  return {ok: true, found: true, ref: s.ref, status: s.status, date: s.date, company: s.company, vehicle: s.vehicle, items: s.items, validUntil: s.validUntil, decidedAt: s.status === ST_REL ? s.decidedAt : '', ready: s.status === ST_PEND, purpose: s.purpose, upload: !!b.k && String(b.k) === key_(s.ref) && s.status === ST_WAIT};
}

/* ---------- admin (Admin PIN) ---------- */
function admin_(a, b) {
  if (a === 'a_audit') return auditAdmin_(b);
  var now = Date.now();
  if (a === 'a_list') {
    var q = clean_(b.q, 40).toUpperCase(), stf = clean_(b.status, 30), out = [], counts = {};
    rows_().slice().reverse().forEach(function (v) {
      var s = summary_(v, now);
      counts[s.status] = (counts[s.status] || 0) + 1;
      if (stf && s.status !== stf) return;
      if (q && (s.ref + ' ' + s.company + ' ' + s.vehicle + ' ' + s.carrier).toUpperCase().indexOf(q) < 0) return;
      if (out.length < 300) out.push(s);
    });
    return {ok: true, list: out, counts: counts, total: rows_().length, now: now};
  }
  if (a === 'a_dash') {   /* v1.11: slim rows of every pass for the Admin dashboard */
    var rs = rows_(), dr = [];
    rs.forEach(function (v) {
      var s = summary_(v, now);
      dr.push([s.ref, s.date, s.company, s.vehicle, s.status, s.items, s.createdAt, s.signedAt, s.decidedAt, s.purpose]);
    });
    return {ok: true, rows: dr.slice(-5000), total: dr.length, now: now, today: ymd_(now)};
  }
  if (a === 'a_get') {
    var hit = rowOf_(b.ref);
    if (!hit) return {ok: false, err: 'notfound'};
    var p = full_(hit.v, now), lg = [], ls = sh_('Log'), n = ls.getLastRow();
    if (n > 1) ls.getRange(2, 1, n - 1, 5).getValues().forEach(function (r) { if (String(r[1]) === p.ref) lg.push({t: String(r[0]), ev: String(r[2]), by: String(r[3]), d: String(r[4])}); });
    return {ok: true, pass: p, log: lg, links: {front: String(hit.v[PC['Photo front']]), load: String(hit.v[PC['Photo load']]), old: [hit.v[PC['Photo load']], hit.v[PC['Photo left (old)']], hit.v[PC['Photo right (old)']]].map(String), signed: String(hit.v[PC['Signed copy links']] || '').split(' ').filter(function (x) { return x; })}, checklist: String(hit.v[PC['Checklist']] || ''), lat: hit.v[PC['Dec lat']], lng: hit.v[PC['Dec lng']]};
  }
  if (a === 'a_cancel') {
    var h2 = rowOf_(b.ref);
    if (!h2) return {ok: false, err: 'notfound'};
    var st = String(h2.v[PC['Status']]);
    if (st !== ST_WAIT && st !== ST_PEND) return {ok: false, err: 'not_open', status: st};
    setCell_(h2.row, 'Status', ST_CAN); setCell_(h2.row, 'Cancelled reason', clean_(b.reason, 200) || 'Cancelled by admin'); setCell_(h2.row, 'Decided at (WIB)', ymdhms_(now)); setCell_(h2.row, 'Decided ms', now);
    log_(String(h2.v[0]), 'CANCELLED_ADMIN', 'Admin', clean_(b.reason, 200));
    return {ok: true};
  }
  if (a === 'a_delete') {
    var refs = (Array.isArray(b.refs) ? b.refs : [b.ref]).map(function (x) { return String(x || '').trim().toUpperCase(); }).filter(function (x) { return x; }).slice(0, 50);
    var lock = LockService.getScriptLock(), gone = [];
    lock.waitLock(25000);
    try {
      ROWS_ = null;
      refs.forEach(function (ref) {
        var hit = rowOf_(ref);
        if (!hit) return;
        var ps = sh_('Passes'), its = sh_('Items'), n = its.getLastRow();
        if (n > 1) { var iv = its.getRange(2, 1, n - 1, 1).getValues(); for (var i = iv.length - 1; i >= 0; i--) if (String(iv[i][0]) === String(hit.v[0])) its.deleteRow(i + 2); }
        ps.deleteRow(hit.row);
        try { var fi = folder_().getFoldersByName(String(hit.v[0])); while (fi.hasNext()) fi.next().setTrashed(true); } catch (e) { Logger.log('folder: ' + e); }
        log_(String(hit.v[0]), 'DELETED_ADMIN', 'Admin', 'status was ' + String(hit.v[PC['Status']]) + '; Drive folder moved to Trash');
        gone.push(String(hit.v[0]));
        ROWS_ = null;
      });
    } finally { lock.releaseLock(); }
    return {ok: true, deleted: gone};
  }
  if (a === 'a_log') {
    var l = sh_('Log'), m = l.getLastRow(), o = [];
    if (m > 1) { var st2 = Math.max(2, m - 199); l.getRange(st2, 1, m - st2 + 1, 5).getValues().reverse().forEach(function (r) { o.push({t: String(r[0]), ref: String(r[1]), ev: String(r[2]), by: String(r[3]), d: String(r[4])}); }); }
    return {ok: true, log: o};
  }
  return {ok: false, err: 'action'};
}

/* ---------- bridge for Patroli (shared secret) ---------- */
function bridge_(a, b) {
  var now = Date.now();
  if (a === 'b_list') {
    var out = [];
    rows_().forEach(function (v) { var s = summary_(v, now); if (s.status === ST_PEND) out.push({ref: s.ref, company: s.company, vehicle: s.vehicle, carrier: s.carrier, items: s.items, signedAt: s.signedAt, validUntil: s.validUntil, signedMs: Number(v[PC['Signed ms']])}); });
    out.sort(function (x, y) { return x.signedMs - y.signedMs; });
    return {ok: true, list: out, n: out.length, now: now};
  }
  if (a === 'b_get') {
    var hit = rowOf_(b.ref);
    if (!hit) return {ok: false, err: 'notfound'};
    var p = full_(hit.v, now), imgs = {}, ids = String(hit.v[PC['Photo IDs']] || '').split(',');
    viewsOf_(ids).forEach(function (v, i) { imgs[v] = img_(ids[i]); });
    var xi2 = extraIds_(hit.v); Object.keys(xi2).forEach(function (k) { imgs[k] = img_(xi2[k]); });
    imgs.signed = String(hit.v[PC['Signed IDs']] || '').split(',').filter(function (x) { return x; }).map(img_);
    var why = '';
    if (p.status !== ST_PEND) why = p.status === ST_WAIT ? 'no_signed_copy' : p.status === ST_REL ? 'already_released' : p.status === ST_EXP ? 'expired' : p.status === ST_REJ ? 'rejected' : 'cancelled';
    return {ok: true, pass: p, images: imgs, ready: p.status === ST_PEND, why: why};
  }
  if (a === 'b_release') {
    var lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      ROWS_ = null;
      var h = rowOf_(b.ref);
      if (!h) return {ok: false, err: 'notfound'};
      var st = statusNow_(h.v, now);
      if (st === ST_REL) return {ok: false, err: 'already_released', by: String(h.v[PC['Decided by']]), at: String(h.v[PC['Decided at (WIB)']])};
      if (st === ST_EXP) return {ok: false, err: 'expired'};
      if (st !== ST_PEND) return {ok: false, err: 'not_ready', status: st};
      var dec = String(b.decision || ''), by = clean_(b.by, 60), note = clean_(b.reason, 300);
      if (dec !== 'release' && dec !== 'reject') return {ok: false, err: 'bad_decision'};
      if (!by) return {ok: false, err: 'bad_by'};
      if (dec === 'reject' && note.length < 3) return {ok: false, err: 'need_reason'};
      setCell_(h.row, 'Status', dec === 'release' ? ST_REL : ST_REJ);
      setCell_(h.row, 'Decided by', by); setCell_(h.row, 'Decider role', clean_(b.role, 30)); setCell_(h.row, 'Decided at (WIB)', ymdhms_(now)); setCell_(h.row, 'Decided ms', now); setCell_(h.row, 'Decision note', note);
      setCell_(h.row, 'Dec lat', num_(b.lat) == null ? '' : num_(b.lat)); setCell_(h.row, 'Dec lng', num_(b.lng) == null ? '' : num_(b.lng)); setCell_(h.row, 'Dec acc', num_(b.acc) == null ? '' : Math.round(num_(b.acc)));
      setCell_(h.row, 'Checklist', b.checks ? JSON.stringify(b.checks).slice(0, 300) : '');
      log_(String(h.v[0]), dec === 'release' ? 'RELEASED' : 'REJECTED', by, note);
      ROWS_ = null;
      return {ok: true, status: dec === 'release' ? ST_REL : ST_REJ, at: ymdhms_(now), ref: String(h.v[0]), company: String(h.v[PC['Company']]), vehicle: String(h.v[PC['Vehicle no']])};
    } finally { lock.releaseLock(); }
  }
  if (a === 'b_audit_list') return auditList_();
  if (a === 'b_audit_done') return auditDone_(b);
  return {ok: false, err: 'action'};
}
function img_(id) {
  if (!id) return '';
  try { return 'data:image/jpeg;base64,' + Utilities.base64Encode(DriveApp.getFileById(id).getBlob().getBytes()); } catch (e) { return ''; }
}


/* ---------- Admin PIN reset by email (v1.20) ----------
   The ONLY address that can receive a reset link is ADMIN_EMAIL below (the HSSE manager). Nobody can choose another address.
   a_forgot (no PIN, 3 per hour): mails a one-use link APP_URL?resetpin=<token> (30 minutes, only its hash is stored).
   a_reset (token + new 6-digit PIN): stores the PIN only as a salted hash (script property ADMIN_PIN_HASH), deletes the plain ADMIN_PIN,
   clears the Admin lockout and mails a 'PIN was changed' notice. Wrong tokens count toward a 10-try lock. */
var ADMIN_EMAIL = 'ignatius.ambrosio@ecooils.com.my';
function adminForgot_() {
  if (!hits_('fgt', 3, 3600)) return {ok: false, err: 'busy'};
  var p = props_(), tok = secret_();
  p.setProperty('RESET_HASH', hash_('RT|' + tok));
  p.setProperty('RESET_EXP', String(Date.now() + 30 * 60 * 1000));
  try {
    MailApp.sendEmail({to: ADMIN_EMAIL, subject: 'Gate Pass: reset your Admin PIN',
      body: 'Someone asked to reset the Gate Pass Admin PIN. If it was you, open this link within 30 minutes (it works once):\n\n' + APP_URL_ + '?resetpin=' + tok + '\n\nIf it was not you, ignore this email: nothing changes.'});
  } catch (e) { return {ok: false, err: 'mail'}; }
  return {ok: true, masked: ADMIN_EMAIL.slice(0, 2) + '***@' + ADMIN_EMAIL.split('@')[1]};
}
function adminReset_(b) {
  if (locked_('frt', 10)) return {ok: false, err: 'locked'};
  var p = props_(), tok = String(b.token || ''), pin = String(b.newPin || '');
  var okTok = /^[0-9a-f]{64}$/.test(tok) && p.getProperty('RESET_HASH') === hash_('RT|' + tok) && Number(p.getProperty('RESET_EXP') || 0) > Date.now();
  if (!okTok) { failed_('frt'); return {ok: false, err: 'badtoken'}; }
  if (!/^\d{6}$/.test(pin)) return {ok: false, err: 'badpin'};
  p.setProperty('ADMIN_PIN_HASH', hash_('AP|' + pin));
  p.deleteProperty('ADMIN_PIN'); p.deleteProperty('RESET_HASH'); p.deleteProperty('RESET_EXP');
  CacheService.getScriptCache().remove('fp');
  try { MailApp.sendEmail({to: ADMIN_EMAIL, subject: 'Gate Pass: Admin PIN was changed', body: 'The Gate Pass Admin PIN was changed just now. If it was not you, open Forgot PIN in the app and set a new one.'}); } catch (e) {}
  return {ok: true};
}
var APP_URL_ = 'https://iggifernandes.github.io/EcoOils-Project-Material-Gate-Pass/';


/* ---------- Daily pass audit (v1.21) ----------
   Every evening (auditDaily trigger, about 20:00 WIB) the system looks at the passes RELEASED that day, scores each one from the data (flags),
   and puts into the Audit sheet: every pass with a flag + a random sample of the clean ones (Config AUDIT_PCT default 20, AUDIT_MIN 3, AUDIT_MAX 10).
   The Security Danru / Shift Supervisor (Patroli app, via the bridge secret, never the Admin PIN) checks each assigned pass against the paper original
   and reports inconsistencies (b_audit_list, b_audit_done). A person cannot audit a pass released by himself. An inconsistency emails the owner at once.
   auditOverdue (trigger about 12:00 WIB next day) marks assigned passes still open after 16 hours as Overdue and emails the owner. Run setupAuditTriggers() once.
   Config (all optional): AUDIT_PCT, AUDIT_MIN, AUDIT_MAX, AUDIT_OPEN_H (default 6), AUDIT_CLOSE_H (default 22), GATE_LAT, GATE_LNG, GATE_RADIUS_M (default 300). */
HEAD.Audit = ['Audit date', 'Ref', 'Why', 'Auto score', 'Auto flags', 'Status', 'Assigned (WIB)', 'Assigned ms', 'Auditor', 'Auditor role', 'Paper held', 'Photos match', 'Items match', 'Inconsistency', 'Note', 'Done (WIB)', 'Done ms', 'Released by'];
var AC = {}; HEAD.Audit.forEach(function (h, i) { AC[h] = i; });
function auditSheet_() {
  var s = SpreadsheetApp.getActiveSpreadsheet(), sh = s.getSheetByName('Audit');
  if (!sh) { sh = s.insertSheet('Audit'); sh.appendRow(HEAD.Audit); sh.setFrozenRows(1); sh.getRange(1, 1, 1, HEAD.Audit.length).setFontWeight('bold'); }
  return sh;
}
function auditRows_() {
  var sh = auditSheet_(), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, HEAD.Audit.length).getValues().map(function (v, i) { return {row: i + 2, v: v}; });
}
function auditSet_(row, name, val) { auditSheet_().getRange(row, AC[name] + 1).setValue(safe_(val)); }
function distM_(la1, lo1, la2, lo2) {
  var R = 6371000, d = Math.PI / 180, a = Math.sin((la2 - la1) * d / 2), b = Math.sin((lo2 - lo1) * d / 2);
  var h = a * a + Math.cos(la1 * d) * Math.cos(la2 * d) * b * b;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/* flags of one RELEASED pass (v = Passes row). Major: NO_SIGNED, QUICK_RELEASE. Minor: the rest. */
function auditFlags_(v, all) {
  var f = [], sig = String(v[PC['Signed IDs']] || '').replace(/[, ]/g, ''), sMs = Number(v[PC['Signed ms']]) || 0, dMs = Number(v[PC['Decided ms']]) || 0;
  if (!sig) f.push('NO_SIGNED');
  if (sMs && dMs && dMs - sMs < 60000) f.push('QUICK_RELEASE');
  if (dMs) {
    var h = new Date(dMs + OFF).getUTCHours();
    if (h < Number(cfg_('AUDIT_OPEN_H', 6)) || h >= Number(cfg_('AUDIT_CLOSE_H', 22))) f.push('AFTER_HOURS');
  }
  var gl = num_(cfg_('GATE_LAT', '')), gn = num_(cfg_('GATE_LNG', '')), la = num_(v[PC['Dec lat']]), lo = num_(v[PC['Dec lng']]);
  if (gl != null && gn != null) {
    if (la == null || lo == null) f.push('NO_GATE_GPS');
    else if (distM_(la, lo, gl, gn) > Number(cfg_('GATE_RADIUS_M', 300))) f.push('FAR_FROM_GATE');
  }
  var ic = String(v[PC['Carrier I/C no']] || ''), co = String(v[PC['Company']] || '');
  if (ic && ic.indexOf('COURIER ') !== 0 && all.some(function (o) { return o !== v && String(o[PC['Carrier I/C no']] || '') === ic && String(o[PC['Company']] || '') !== co && dMs && Math.abs((Number(o[PC['Created ms']]) || 0) - dMs) < 30 * 86400000; })) f.push('SHARED_ID');
  var veh = String(v[PC['Vehicle no']] || '').toUpperCase();
  if (veh && veh !== 'HAND CARRY' && all.filter(function (o) { return String(o[PC['Vehicle no']] || '').toUpperCase() === veh && String(o[PC['Date']] || '') === String(v[PC['Date']] || ''); }).length > 3) f.push('REPEAT_VEHICLE');
  return f;
}
function auditScore_(f) { return f.some(function (x) { return x === 'NO_SIGNED' || x === 'QUICK_RELEASE'; }) ? 'Major' : (f.length ? 'Minor' : 'Compliant'); }
function auditDaily(dayMs) {
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    CFGM_ = null; ROWS_ = null;
    var forced = typeof dayMs === 'number', now = forced ? dayMs : Date.now(), day = ymd_(now), all = rows_().map(function (r) { return r; });
    if (!forced && props_().getProperty('AUDIT_LAST') === day) return {ok: true, day: day, released: 0, assigned: 0, skipped: true};   /* once per day: a second run would draw more samples */
    var have = {}; auditRows_().forEach(function (r) { have[String(r.v[AC['Ref']])] = true; });
    var rel = all.filter(function (v) { var d = Number(v[PC['Decided ms']]) || 0; return String(v[PC['Status']]) === ST_REL && d && ymd_(d) === day && !have[String(v[0])]; });
    var flagged = [], clean = [];
    rel.forEach(function (v) { var f = auditFlags_(v, all); (f.length ? flagged : clean).push({v: v, f: f}); });
    var pct = Number(cfg_('AUDIT_PCT', 20)), mn = Number(cfg_('AUDIT_MIN', 3)), mx = Number(cfg_('AUDIT_MAX', 10));
    var take = clean.length ? Math.min(clean.length, Math.min(mx, Math.max(mn, Math.ceil(clean.length * pct / 100)))) : 0;
    for (var i = clean.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = clean[i]; clean[i] = clean[j]; clean[j] = t; }
    var pick = flagged.map(function (x) { x.why = 'Flag'; return x; }).concat(clean.slice(0, take).map(function (x) { x.why = 'Random sample'; return x; }));
    var sh = auditSheet_();
    pick.forEach(function (x) {
      sh.appendRow([day, String(x.v[0]), x.why, auditScore_(x.f), x.f.join(', '), 'Open', ymdhms_(now), now, '', '', '', '', '', '', '', '', '', String(x.v[PC['Decided by']] || '')]);
    });
    var major = flagged.filter(function (x) { return auditScore_(x.f) === 'Major'; });
    var open = all.filter(function (v) { var st = statusNow_(v, now); return (st === ST_WAIT || st === ST_PEND) && now - (Number(v[PC['Created ms']]) || now) > 72 * 3600000; });
    try {
      MailApp.sendEmail({to: ADMIN_EMAIL, subject: 'Gate Pass audit ' + day + ': ' + rel.length + ' released, ' + pick.length + ' to audit' + (major.length ? ', ' + major.length + ' MAJOR flag' : ''),
        body: 'Gate Pass audit for ' + day + ' (WIB)\n\nReleased today: ' + rel.length + '\nAssigned to the Security Danru / Shift Supervisor: ' + pick.length + ' (' + flagged.length + ' flagged, ' + Math.min(take, clean.length) + ' random sample)\n' +
        (major.length ? '\nMAJOR flags:\n' + major.map(function (x) { return ' - ' + x.v[0] + ': ' + x.f.join(', '); }).join('\n') + '\n' : '') +
        (open.length ? '\nOpen for more than 72 hours (not released): ' + open.map(function (v) { return v[0]; }).join(', ') + '\n' : '') +
        '\nThey audit in the Patroli app (Gate pass audit) and report any inconsistency; you are emailed at once if they find one.'});
    } catch (e) { Logger.log('audit mail: ' + e); }
    if (!forced) props_().setProperty('AUDIT_LAST', day);
    log_('', 'AUDIT_ASSIGNED', 'system', day + ': ' + pick.length + ' of ' + rel.length);
    return {ok: true, day: day, released: rel.length, assigned: pick.length};
  } finally { lock.releaseLock(); }
}
function auditOverdue() {
  var now = Date.now(), late = [];
  auditRows_().forEach(function (r) {
    var st = String(r.v[AC['Status']]), ms = Number(r.v[AC['Assigned ms']]) || 0;
    if ((st === 'Open' || st === 'Overdue') && ms && now - ms > 16 * 3600000) { if (st === 'Open') auditSet_(r.row, 'Status', 'Overdue'); late.push(String(r.v[AC['Ref']])); }
  });
  if (late.length) { try { MailApp.sendEmail({to: ADMIN_EMAIL, subject: 'Gate Pass audit overdue: ' + late.length + ' pass(es) not audited', body: 'These assigned passes have not been audited after 16 hours:\n' + late.join('\n')}); } catch (e) { Logger.log('overdue mail: ' + e); } }
  return late.length;
}
/* run ONCE from the editor: it asks to authorise sending mail; it makes the evening and noon triggers */
function setupAuditTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { var n = t.getHandlerFunction(); if (n === 'auditDaily' || n === 'auditOverdue') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('auditDaily').timeBased().everyDays(1).atHour(13).create();    /* 13:00 UTC = 20:00 WIB */
  ScriptApp.newTrigger('auditOverdue').timeBased().everyDays(1).atHour(5).create();   /* 05:00 UTC = 12:00 WIB */
  Logger.log('Audit triggers set: assignment 20:00 WIB, overdue check 12:00 WIB (Google may run them within the hour).');
}
function auditView_(r, all, now) {
  var hit = null; all.forEach(function (v) { if (String(v[0]) === String(r.v[AC['Ref']])) hit = v; });
  var o = {ref: String(r.v[AC['Ref']]), day: String(r.v[AC['Audit date']]), why: String(r.v[AC['Why']]), score: String(r.v[AC['Auto score']]), flags: String(r.v[AC['Auto flags']]), status: String(r.v[AC['Status']]), releasedBy: String(r.v[AC['Released by']])};
  if (hit) { o.company = String(hit[PC['Company']]); o.vehicle = String(hit[PC['Vehicle no']]); o.carrier = String(hit[PC['Carrier name']]); o.items = Number(hit[PC['Items']]) || 0; o.releasedAt = String(hit[PC['Decided at (WIB)']] || ''); }
  return o;
}
function auditList_() {
  var now = Date.now(), all = rows_(), rs = auditRows_(), open = [], done = 0;
  rs.forEach(function (r) { var st = String(r.v[AC['Status']]); if (st === 'Open' || st === 'Overdue') open.push(auditView_(r, all, now)); else if (st.indexOf('Done') === 0 && ymd_(now) === ymd_(Number(r.v[AC['Done ms']]) || 0)) done++; });
  return {ok: true, list: open, n: open.length, doneToday: done, now: now};
}
function auditDone_(b) {
  var ref = String(b.ref || '').toUpperCase(), by = clean_(b.by, 60), role = clean_(b.role, 30), note = clean_(b.note, 400);
  if (!ref) return {ok: false, err: 'bad_ref'};
  if (!by) return {ok: false, err: 'bad_by'};
  var yn = function (x) { return x === 'yes' ? 'yes' : (x === 'no' ? 'no' : ''); };
  var pa = yn(b.paper), ph = yn(b.photos), it = yn(b.items);
  if (!pa || !ph || !it) return {ok: false, err: 'need_checks'};
  var bad = pa === 'no' || ph === 'no' || it === 'no';
  if (bad && note.length < 3) return {ok: false, err: 'need_note'};
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    var hit = null; auditRows_().forEach(function (r) { if (String(r.v[AC['Ref']]) === ref && !hit) hit = r; });
    if (!hit) return {ok: false, err: 'notfound'};
    var st = String(hit.v[AC['Status']]);
    if (st.indexOf('Done') === 0) return {ok: false, err: 'already_done', by: String(hit.v[AC['Auditor']])};
    if (String(hit.v[AC['Released by']]).toLowerCase() === by.toLowerCase()) return {ok: false, err: 'own_release'};
    var now = Date.now();
    auditSet_(hit.row, 'Status', bad ? 'Done - inconsistency' : 'Done');
    auditSet_(hit.row, 'Auditor', by); auditSet_(hit.row, 'Auditor role', role);
    auditSet_(hit.row, 'Paper held', pa); auditSet_(hit.row, 'Photos match', ph); auditSet_(hit.row, 'Items match', it);
    auditSet_(hit.row, 'Inconsistency', bad ? 'yes' : 'no'); auditSet_(hit.row, 'Note', note);
    auditSet_(hit.row, 'Done (WIB)', ymdhms_(now)); auditSet_(hit.row, 'Done ms', now);
    log_(ref, bad ? 'AUDIT_INCONSISTENCY' : 'AUDIT_OK', by, note);
    if (bad) { try { MailApp.sendEmail({to: ADMIN_EMAIL, subject: 'Gate Pass audit INCONSISTENCY: ' + ref, body: ref + ' was audited by ' + by + ' (' + role + ').\nSigned scan clear with 4 signatures: ' + pa + '\nPhotos match: ' + ph + '\nItems match: ' + it + '\nNote: ' + note + '\nReleased by: ' + String(hit.v[AC['Released by']]) + '\nAuto flags: ' + (String(hit.v[AC['Auto flags']]) || 'none')}); } catch (e) { Logger.log('audit mail: ' + e); } }
    return {ok: true, inconsistency: bad};
  } finally { lock.releaseLock(); }
}
function auditAdmin_(b) {
  var now = Date.now(), all = rows_(), from = Date.now() - (Number(b.days) || 30) * 86400000, out = [], cnt = {Open: 0, Overdue: 0, Done: 0, Inconsistency: 0};
  auditRows_().forEach(function (r) {
    var st = String(r.v[AC['Status']]); var o = auditView_(r, all, now);
    o.auditor = String(r.v[AC['Auditor']]); o.role = String(r.v[AC['Auditor role']]); o.paper = String(r.v[AC['Paper held']]); o.photos = String(r.v[AC['Photos match']]); o.itemsOk = String(r.v[AC['Items match']]); o.note = String(r.v[AC['Note']]); o.doneAt = String(r.v[AC['Done (WIB)']]);
    if (Date.parse(String(r.v[AC['Audit date']]) + 'T00:00:00Z') < from - 86400000) return;
    out.push(o);
    if (st === 'Open') cnt.Open++; else if (st === 'Overdue') cnt.Overdue++; else if (st === 'Done - inconsistency') cnt.Inconsistency++; else cnt.Done++;
  });
  out.reverse();
  return {ok: true, list: out.slice(0, 500), counts: cnt};
}
