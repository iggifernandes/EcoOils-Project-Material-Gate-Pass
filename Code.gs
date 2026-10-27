/* EcoOils Mentari - Material Gate Pass backend (Google Apps Script)  v1.0
   Form EOSM-HSSE-FM003. Paste into Extensions > Apps Script of the "EcoOils Gate Pass Log" Google Sheet (personal Gmail account).
   Do NOT upload this file to GitHub (keep the repo to index.html and the static files only).
   Who calls this web app:
   - ICs (anyone with the link): create a pass, upload the signed copy, cancel, check status. Protected by a per-pass token kept on the IC's phone.
   - Public QR check: action 'verify' returns status only (no names, no ID numbers, no photos).
   - Patroli (guards): actions b_list / b_get / b_release, protected by the shared secret BRIDGE_SECRET (script property). The guard's name comes from Patroli's PIN login.
   - Admin (you): actions a_*, protected by the script property ADMIN_PIN. */
var VERSION = 'v1.7';
var OFF = 7 * 3600000;      // Jakarta (WIB), no daylight saving
var TZ = 'Asia/Jakarta';
var P_HEAD = ['Ref', 'Created (WIB)', 'Date', 'Purpose', 'Carrier name', 'Carrier I/C no', 'Company', 'Vehicle no', 'Purpose of taking out', 'EcoOils dept', 'IC rep name', 'IC rep position', 'Items', 'Status', 'Token hash',
  'Photo front', 'Photo load', 'Photo left (old)', 'Photo right (old)', 'Photo IDs', 'Signed copy links', 'Signed IDs', 'Signed at (WIB)', 'Decided by', 'Decided at (WIB)', 'Decision note', 'Dec lat', 'Dec lng', 'Dec acc', 'Checklist', 'Created ms', 'Signed ms', 'Decided ms', 'Cancelled reason', 'Decider role', 'Client id', 'IC rep phone'];
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
  if (!p.getProperty('ADMIN_PIN')) p.setProperty('ADMIN_PIN', rand6_());
  if (!p.getProperty('BRIDGE_SECRET')) p.setProperty('BRIDGE_SECRET', secret_());
  if (!p.getProperty('TOKEN_SALT')) p.setProperty('TOKEN_SALT', secret_());
  folder_();
  Logger.log('Setup done. Now run showCodes and read ADMIN_PIN and BRIDGE_SECRET in the Execution log.');
}
/* Prints the Admin PIN and the Patroli bridge secret in the Execution log. Copy the secret into Patroli (Project Settings > Script properties > GATEPASS_SECRET). Never paste it in chat or WhatsApp. */
function showCodes() {
  var p = props_();
  Logger.log('ADMIN_PIN = ' + p.getProperty('ADMIN_PIN'));
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
function cfgList_(k, def) { return String(cfg_(k, def)).split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x; }); }
function failed_(k) { var c = CacheService.getScriptCache(); c.put(k, String(Number(c.get(k) || 0) + 1), 600); }
function locked_(k, max) { return Number(CacheService.getScriptCache().get(k) || 0) >= max; }
function hits_(k, max, secs) { var c = CacheService.getScriptCache(), n = Number(c.get(k) || 0) + 1; c.put(k, String(n), secs); return n <= max; }
function adminOk_(pin) {
  if (locked_('fp', 10)) return false;
  var ok = !!pin && String(pin).trim() === String(props_().getProperty('ADMIN_PIN') || '').trim();
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
function log_(ref, ev, by, detail) { sh_('Log').appendRow([ymdhms_(Date.now()), ref || '', ev, by || '', detail || '']); }

/* ---------- rows ---------- */
var ROWS_ = null;
function rows_() {
  if (ROWS_) return ROWS_;
  var sh = sh_('Passes'), n = sh.getLastRow();
  ROWS_ = n > 1 ? sh.getRange(2, 1, n - 1, P_HEAD.length).getValues() : [];
  return ROWS_;
}
function rowOf_(ref) {
  var rs = rows_(), r = String(ref || '').trim().toUpperCase();
  for (var i = 0; i < rs.length; i++) if (String(rs[i][0]).toUpperCase() === r) return {row: i + 2, v: rs[i]};
  return null;
}
function setCell_(row, name, val) { sh_('Passes').getRange(row, PC[name] + 1).setValue(val); }
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
  o.cancelReason = String(v[PC['Cancelled reason']] || ''); o.siteLead = cfg_('SITE_LEAD_NAME', ''); o.qk = key_(o.ref);
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
  if (a.indexOf('a_') === 0) { if (!adminOk_(b.pin)) return {ok: false, err: 'pin'}; return admin_(a, b); }
  if (a.indexOf('b_') === 0) { if (!bridgeOk_(b.secret)) return {ok: false, err: 'auth'}; return bridge_(a, b); }
  return {ok: false, err: 'action'};
}
function config_() {
  return {ok: true, version: VERSION, units: cfgList_('UNITS', UNITS_DEF), companies: companies_(), depts: cfgList_('DEPTS', 'Project Eng,Discipline Eng,HSSE,Stores'), validHours: cfgNum_('VALID_HOURS', 48), signHours: cfgNum_('SIGN_WINDOW_HOURS', 72), maxItems: 15, siteLead: cfg_('SITE_LEAD_NAME', ''), now: Date.now()};
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
  if (!hits_('create', 30, 600)) return {ok: false, err: 'busy'};
  var cl = cfgList_('COMPANIES', 'GSB,WEN,KKS,PBS'), purpose = String(b.purpose || '').toUpperCase();
  if (purpose !== 'A' && purpose !== 'B') return {ok: false, err: 'bad_purpose'};
  var carrier = clean_(b.carrier, 60), icNo = clean_(b.icNo, 30), company = clean_(b.company, 60), vehicle = clean_(b.vehicle, 20).toUpperCase(), ptxt = clean_(b.purposeText, 300), dept = clean_(b.dept, 40);
  var icRep = clean_(b.icRep, 60), icPos = clean_(b.icPos, 40), icPhone = clean_(b.icPhone, 20);
  if (carrier.length < 2) return {ok: false, err: 'bad_carrier'};
  if (!/^(KTP \d{16}|SIM \d{12})$/.test(icNo)) return {ok: false, err: 'bad_icno'};
  if (company.length < 2) return {ok: false, err: 'bad_company'};
  if (vehicle.length < 2) return {ok: false, err: 'bad_vehicle'};
  if (ptxt.length < 3) return {ok: false, err: 'bad_purposetext'};
  if (icRep.length < 2) return {ok: false, err: 'bad_icrep'};
  if (icPos.length < 2) return {ok: false, err: 'bad_icpos'};
  if (!/^\+?[0-9][0-9 \-]{6,18}$/.test(icPhone) || icPhone.replace(/\D/g, '').length < 8 || icPhone.replace(/\D/g, '').length > 15) return {ok: false, err: 'bad_icphone'};
  if (cfgList_('DEPTS', 'Project Eng,Discipline Eng,HSSE,Stores').indexOf(dept) < 0) return {ok: false, err: 'bad_dept'};
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
    var row = new Array(P_HEAD.length).fill('');
    row[0] = ref; row[PC['Created (WIB)']] = ymdhms_(now); row[PC['Date']] = today; row[PC['Purpose']] = purpose; row[PC['Carrier name']] = carrier; row[PC['Carrier I/C no']] = icNo;
    row[PC['Company']] = company; row[PC['Vehicle no']] = vehicle; row[PC['Purpose of taking out']] = ptxt; row[PC['EcoOils dept']] = dept; row[PC['IC rep name']] = icRep; row[PC['IC rep position']] = icPos;
    row[PC['Items']] = items.length; row[PC['Status']] = ST_WAIT; row[PC['Token hash']] = hash_(token);
    row[PC['Photo front']] = saved.front.url; row[PC['Photo load']] = saved.load.url; row[PC['IC rep phone']] = icPhone;
    row[PC['Photo IDs']] = VIEWS.map(function (v) { return saved[v].id; }).join(','); row[PC['Created ms']] = now; row[PC['Client id']] = cid;
    sh_('Passes').appendRow(row);
    var ish = sh_('Items');
    ish.getRange(ish.getLastRow() + 1, 1, items.length, 5).setValues(items.map(function (x) { return [ref, x[0], x[1], x[2], x[3]]; }));
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
  if (!hits_('photos', 90, 600)) return {ok: false, err: 'busy'};
  var hit = rowOf_(b.ref);
  if (!hit || !(tokenOk_(hit, b.token) || (b.pin && adminOk_(b.pin)))) return {ok: false, err: 'notfound'};
  var ids = String(hit.v[PC['Photo IDs']] || '').split(','), vs = viewsOf_(ids), imgs = {};
  vs.forEach(function (v, i) { imgs[v] = img_(ids[i]); });
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
  if (!hits_('signed', 60, 600)) return {ok: false, err: 'busy'};
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
  if (!hits_('verify', 120, 600)) return {ok: false, err: 'busy'};
  var hit = rowOf_(b.ref);
  if (!hit) return {ok: true, found: false};
  var s = summary_(hit.v, Date.now());
  return {ok: true, found: true, ref: s.ref, status: s.status, date: s.date, company: s.company, vehicle: s.vehicle, items: s.items, validUntil: s.validUntil, decidedAt: s.status === ST_REL ? s.decidedAt : '', ready: s.status === ST_PEND, purpose: s.purpose, upload: !!b.k && String(b.k) === key_(s.ref) && s.status === ST_WAIT};
}

/* ---------- admin (Admin PIN) ---------- */
function admin_(a, b) {
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
  return {ok: false, err: 'action'};
}
function img_(id) {
  if (!id) return '';
  try { return 'data:image/jpeg;base64,' + Utilities.base64Encode(DriveApp.getFileById(id).getBlob().getBytes()); } catch (e) { return ''; }
}
