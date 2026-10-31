// Mock Google Apps Script runtime for the Gate Pass Code.gs
const fs=require('fs'),crypto=require('crypto'),vm=require('vm'),path=require('path');
function load(file){
const src=fs.readFileSync(file||path.join(__dirname,'..','Code.gs'),'utf8');
// like Google Sheets: text starting with ' is stored as plain text; unprefixed text starting with = + @ becomes a formula that fails (#ERROR!)
function sv(v,fm,key){if(typeof v==='string'){if(v[0]==="'")return v.slice(1);if(/^[=+@]/.test(v)){if(fm)fm[key]=v[0]==='='?v:'='+v;return '#ERROR!'}}return v}
function mkSheet(name){const rows=[];const fm={};return {name,rows,fm,
  getLastRow:()=>rows.length,
  appendRow:r=>{const n=rows.length;rows.push(r.map((v,j)=>sv(v,fm,(n+1)+','+(j+1))))},
  deleteRow:r=>{rows.splice(r-1,1)},
  setFrozenRows(){},
  getRange(r,c,nr,nc){nr=nr||1;nc=nc||1;
    const rg={getValues:()=>{const o=[];for(let i=0;i<nr;i++){const row=[];for(let j=0;j<nc;j++){const v=(rows[r-1+i]||[])[c-1+j];row.push(v===undefined?'':v)}o.push(row)}return o},
      setValues:(vals)=>{vals.forEach((vr,i)=>{rows[r-1+i]=rows[r-1+i]||[];vr.forEach((v,j)=>{rows[r-1+i][c-1+j]=sv(v,fm,(r+i)+','+(c+j))})});return rg},
      setValue:(v)=>{rows[r-1]=rows[r-1]||[];rows[r-1][c-1]=(rg._txt&&typeof v==='string')?v:sv(v,fm,r+','+c);if(rg._txt)delete fm[r+','+c];return rg},
      getFormulas:()=>{const o=[];for(let i=0;i<nr;i++){const row=[];for(let j=0;j<nc;j++)row.push(fm[(r+i)+','+(c+j)]||'');o.push(row)}return o},
      getValue:()=>{const v=(rows[r-1]||[])[c-1];return v===undefined?'':v},
      setFontWeight(){return rg},setNumberFormat(f){if(f==='@')rg._txt=true;return rg}};return rg}};}
const sheets={},props={},cache={},files={};let fid=0;
const folders={},trashed=[];
function mkFolder(name){const subs={};const f={name,getId:()=>'folder_'+name,createFile:(blob)=>{const id='f'+(++fid);files[id]=blob;(folders[name]=folders[name]||[]).push(id);return {getId:()=>id,getUrl:()=>'https://drive.example/'+id}},
  getFoldersByName:n=>{const x=subs[n];let used=false;return {hasNext:()=>!!x&&!used,next:()=>{used=true;return x}}},
  createFolder:n=>{subs[n]=mkFolder(n);return subs[n]},setTrashed:t=>{if(t)trashed.push(name)}};return f;}
const rootF=mkFolder('root');
const ctx={console,Date,Math,JSON,String,Number,Object,Array,isFinite,parseInt,RegExp,Error,
 SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n]||null,insertSheet:n=>sheets[n]=mkSheet(n),getSheets:()=>Object.values(sheets),deleteSheet(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=String(v)},deleteProperty:k=>{delete props[k]}})},
 CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>{cache[k]=v},remove:k=>{delete cache[k]}})},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(a,s)=>Array.from(crypto.createHash('sha256').update(s).digest()).map(b=>b>127?b-256:b),
   newBlob:(bytes,type,name)=>({bytes,type,name,getBytes:()=>bytes}),base64Decode:s=>Array.from(Buffer.from(s,'base64')).map(b=>b>127?b-256:b),base64Encode:b=>Buffer.from(b.map(x=>x&255)).toString('base64')},
 ContentService:{createTextOutput:s=>({s,setMimeType(){return this}}),MimeType:{JSON:1}},
 MailApp:{sendEmail(m){ctx.mails.push(m)}},mails:[],
 DriveApp:{createFolder:()=>mkFolder('root'),
   getFolderById:()=>rootF,
   getFileById:id=>{if(!files[id])throw new Error('nofile');return {getBlob:()=>files[id]}}},
 Logger:{log:m=>ctx.logs.push(m)},logs:[]};
vm.createContext(ctx);vm.runInContext(src,ctx);
ctx.setup();
const call=b=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(b)}}).s);
return {ctx,sheets,props,files,cache,call,folders,trashed};}
module.exports=load;module.exports.load=load;
