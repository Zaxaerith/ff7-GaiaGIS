// SPDX-License-Identifier: GPL-3.0-only
// Synthetic save bytes and source-derived reference points exist in memory only.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const EV='a020dace94f21b73094c204c54b01e13b3688002f65ffd9b1edf8ada5e372a64';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function checksum(bytes){let crc=0xffff;for(let i=4;i<bytes.length;i++){crc^=bytes[i]<<8;for(let bit=0;bit<8;bit++)crc=((crc<<1)^((crc&0x8000)?0x1021:0))&0xffff;}return crc^0xffff;}
function saveBytes(slots){
 const bytes=Buffer.alloc(65109);bytes.set([0x71,0x73,0x27,0x06]);
 for(const [i,input]of slots.entries()){
  const slot=bytes.subarray(9+i*4340,9+(i+1)*4340);slot[0x55]=1;slot[0x4f9]=slot[0x4fa]=255;
  slot.writeUInt16LE(input.module??1,0xb94);slot.writeUInt16LE(input.field??177,0xb96);
  slot.writeInt16LE(input.x??0,0xb9a);slot.writeInt16LE(input.y??0,0xb9c);slot.writeUInt16LE(input.triangle??0,0xb9e);slot[0xba0]=input.direction??255;
  slot.writeInt16LE(input.progress??1620,0xba4);slot[0xc1f]=(input.bits??0)&1;slot[0xf2b]=((input.bits??0)>>1)&1;slot[0xf2a]=(((input.bits??0)>>2)&1)<<4;
  slot.writeUInt16LE(checksum(slot)^(input.invalid?1:0),0);
 }
 return bytes;
}
function referencePoints(raw){
 const count=raw.readUInt32LE();
 const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
 for(let triangle=0;triangle<count;triangle++){
  const points=[0,1,2].map(k=>[0,1,2].map(j=>raw.readInt16LE(4+triangle*24+k*8+j*2))),den=cross(points[0],points[1],points[2]);if(!den)continue;
  const bary=p=>[cross(points[1],points[2],p),cross(points[2],points[0],p),cross(points[0],points[1],p)].map(n=>n/den);
  const center=[0,1].map(j=>points.reduce((sum,p)=>sum+p[j],0)/3);
  for(const x of [Math.floor(center[0]),Math.ceil(center[0])])for(const y of [Math.floor(center[1]),Math.ceil(center[1])]){
   const weights=bary([x,y]);if(!weights.every(n=>n>0))continue;
   const outside=[[32767,32767],[-32768,-32768],[32767,-32768]].find(p=>bary(p).some(n=>n<0));assert(outside);
   return {triangle,inside:{x,y,z:weights.reduce((sum,n,k)=>sum+n*points[k][2],0)},boundary:{x:points[0][0],y:points[0][1],z:points[0][2]},outside:{x:outside[0],y:outside[1]},count};
  }
 }
 throw Error('Expected a nondegenerate source triangle with an integer interior point');
}

/** Maintained Browser coverage for Save → existing Field Canvas and static EV evidence. */
export async function saveSpatialChecks({browser,url,pass,errors}){
 const resourcesOnly=process.env.GAIA_SAVE_BROWSER_PHASE==='resources';
 const folder=process.env.GAIA_BROWSER_WORKSPACE;if(!folder){console.log('SKIP save spatial checks: GAIA_BROWSER_WORKSPACE not supplied');return;}
 const names=['gaia-meta.json','gaia-mesh.bin','gaia-poi.json','gaia-field-context.json','gaia-field-walkmesh.bin'];
 const files=new Map();for(const name of names)files.set(name,await readFile(path.join(folder,name)));
 const walk=files.get('gaia-field-walkmesh.bin'),length=walk.readUInt32LE(12),header=JSON.parse(walk.subarray(16,16+length)),span=header.scenes.find(s=>s.fieldId===177);assert(span?.status==='available');
 const raw=walk.subarray(16+length+span.offset,16+length+span.offset+span.bytes),point=referencePoints(raw);
 const input={field:177,triangle:point.triangle,direction:255};
 const slots=[{...input,...point.inside},{...input,...point.boundary,bits:7},{...input,...point.outside,progress:601},{...input,...point.inside,triangle:65535,progress:1000},{...input,...point.inside,field:65535,progress:664},{...input,...point.inside,invalid:true},{...input,...point.inside,progress:-1}];
 const fixture=saveBytes(slots),replacement=saveBytes([{...input,...point.inside,bits:7}]);
 const manifest=JSON.parse(await readFile(path.join(folder,'gaia-workspace.json'),'utf8'));
 const uploadFiles=(selected,includeManifest=true)=>{
  const rows=[...selected].map(([name,buffer])=>({name,mimeType:'application/octet-stream',buffer}));if(includeManifest){const m=structuredClone(manifest);m.assets=m.assets.filter(a=>selected.has(a.filename));for(const a of m.assets){a.bytes=selected.get(a.filename).length;a.sha256=sha(selected.get(a.filename));a.dependencies=a.dependencies.filter(n=>selected.has(n));}rows.push({name:'gaia-workspace.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(m))});}return rows;
 };
 const makePage=async(lang='en',width=1440)=>{
  const context=await browser.newContext({viewport:{width,height:1000},hasTouch:true}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const read=Blob.prototype.arrayBuffer;Blob.prototype.arrayBuffer=async function(){const bytes=await read.call(this);if(window.__savePauseBytes===bytes.byteLength){window.__savePauseBytes=null;window.__saveDecodeWaiting=true;await new Promise(resolve=>window.__saveRelease=resolve);}return bytes;};});
  const panel=async id=>{if(!await page.locator('#app-tab-'+id).isVisible())await page.locator('#app-menu').click();await page.locator('#app-tab-'+id).click();};
  const ready=async()=>{await page.waitForSelector('#workspace-connection[data-connected="true"]',{state:'attached'});await page.waitForSelector('#field-context[data-walk-parse-ms]',{state:'attached'});};
  const importSave=async(buffer=fixture)=>{await panel('data');if(!await page.locator('#my-save').evaluate(e=>e.open))await page.locator('#my-save > summary').click();await page.locator('#save-file').setInputFiles({name:'synthetic.ff7',mimeType:'application/octet-stream',buffer});await page.waitForSelector('#save-inspector:not([hidden]) #save-world-state',{state:'attached'});};
  const slot=async index=>{await panel('data');await page.locator(`#save-slots [data-slot="${index}"]`).click();};
  const inspect=async()=>{if(!await page.locator('#integrated-inspector').evaluate(e=>e.classList.contains('open')))await page.locator('#toggle-inspector').click();};
  const openField=async()=>{await inspect();await page.locator('#save-inspector .save-open-field').click();await page.waitForSelector('#field-workspace:not([hidden])',{state:'attached'});};
  const marker=async(status,shown)=>{await page.waitForSelector(`#field-save-position[data-status="${status}"][data-marker="${shown}"]`,{state:'attached'});await page.waitForSelector(`#field-walkmesh-canvas[data-save-marker="${shown}"]`,{state:'attached'});assert.equal(await page.locator('#field-walkmesh-canvas').count(),1);};
  const absent=async()=>{await page.waitForFunction(()=>!document.querySelector('#field-walkmesh-canvas[data-save-marker="true"]'));assert.equal(await page.locator('#field-save-position[data-marker="true"]').count(),0);};
  const release=async()=>{await page.evaluate(()=>window.__saveRelease?.());await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
  await page.goto(url+'?lang='+lang);await ready();return {context,page,panel,ready,importSave,slot,openField,marker,absent,release,inspect};
 };
 if(!resourcesOnly)for(const [lang,width]of [['en',1440],['zh-CN',390],['zh-TW',320],['ja',390],['ko',320]]){
  const api=await makePage(lang,width),{context,page,panel,importSave,slot,openField,marker,absent}=api;let phase='import';
  try{
   await importSave();assert.equal(await page.locator('#save-world-state').getAttribute('data-state'),'3');assert.equal(await page.locator('#save-world-state').getAttribute('data-source-hash'),EV);assert.match(await page.locator('.save-world-inputs').textContent(),/1620.*C1F.bit0 = 0.*F2B.bit0 = 0.*F2A.bit4 = 0/);assert(await page.locator('.save-world-disclaimer').first().textContent());
   const variantBefore=await page.locator('#world-variants').getAttribute('data-active');await api.inspect();await page.locator('#save-world-research').click();assert.equal(await page.locator('#world-variants').getAttribute('data-active'),variantBefore);assert(await page.locator('#world-variants').evaluate(e=>e.open));assert(await page.locator('#world-variants').isVisible());await slot(1);
   phase='inside';await openField();await marker('inside',true);const result=page.locator('#field-save-position');assert.equal(await result.getAttribute('data-triangle'),String(point.triangle));assert.equal(await result.getAttribute('data-raw-x'),String(point.inside.x));assert.equal(await result.getAttribute('data-raw-y'),String(point.inside.y));assert.equal(await result.getAttribute('data-direction'),'255');assert(Math.abs(Number(await result.getAttribute('data-derived-z'))-point.inside.z)<1e-8);
   phase='boundary';await slot(2);await absent();assert.equal(await page.locator('#save-world-state').getAttribute('data-state'),'4');assert.match(await page.locator('.save-world-groups').first().textContent(),/G1.*G2.*G3.*G4/);await openField();await marker('boundary',true);assert.equal(Number(await result.getAttribute('data-derived-z')),point.boundary.z);
   phase='outside';await slot(3);await openField();await marker('outside',false);assert.equal(await result.getAttribute('data-triangle'),String(point.triangle));assert.equal(await result.getAttribute('data-derived-z'),null);
   phase='invalid triangle';await slot(4);assert.equal(await page.locator('#save-world-state').getAttribute('data-state'),'2');await openField();await marker('invalid_triangle',false);assert.equal(await result.getAttribute('data-triangle'),'65535');
   phase='unknown Field / invalid slot';await slot(5);assert.equal(await page.locator('#save-inspector .save-open-field').count(),0);assert.equal(await page.locator('#save-world-state').getAttribute('data-state'),'1');await slot(6);await absent();assert.equal(await page.locator('#save-inspector .save-open-field').count(),0);await slot(7);assert.equal(await page.locator('#save-world-state').getAttribute('data-state'),'0');assert.match(await page.locator('.save-world-inputs').textContent(),/signed16\) = -1/);assert.match(await page.locator('#save-inspector').textContent(),/65535/);
   assert(!/save51\.[A-Za-z_]+/.test(await page.locator('#save-inspector').textContent()));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   phase='Clear / session only';await panel('data');await page.locator('#save-clear').click();await absent();assert.equal(await page.locator('#save-slots button').count(),0);const persistent=await page.evaluate(()=>({url:location.href,state:JSON.parse(localStorage.getItem('gaiagis.user-state')),session:Object.keys(sessionStorage)}));assert(!JSON.stringify(persistent).includes('fieldPosition'));assert(!JSON.stringify(persistent).includes('worldStateInputs'));assert(!/save-position|save-field|world-state/.test(persistent.url));
   pass(`v5.1 Save spatial ${lang} ${width}px / one Canvas inside & boundary / exact outside & invalid triangle / signed prediction / clear & session privacy`);
  }catch(error){console.log('Save spatial phase',lang,phase,await page.locator('#field-save-position').evaluateAll(rows=>rows.map(e=>({...e.dataset,text:e.textContent}))));throw error;}finally{await context.close();}
 }

 // Every delayed decode starts in a fresh session, avoiding a warm mesh cache.
 if(!resourcesOnly)for(const action of ['slot','clear','import','other-field','map','workspace']){
  const {context,page,panel,importSave,slot,openField,absent,release}=await makePage();
  try{
   await importSave();await page.evaluate(bytes=>{window.__saveDecodeWaiting=false;window.__savePauseBytes=bytes;},span.bytes);await openField();await page.waitForFunction(()=>window.__saveDecodeWaiting);
   if(action==='slot')await slot(2);
   if(action==='clear'){await panel('data');await page.locator('#save-clear').click();}
   if(action==='import')await importSave(replacement);
   let otherField=null;if(action==='other-field'){
    otherField=await page.locator('#field-scene-selector option').evaluateAll(rows=>rows.find(o=>o.value!=='177'&&!o.disabled)?.value);assert(otherField);await page.locator('#field-scene-selector').selectOption(otherField);await page.waitForFunction(id=>document.getElementById('field-walkmesh')?.dataset.fieldId===id,otherField);
   }
   if(action==='map'){await page.locator('#field-world-return').click();await panel('map');await page.locator('#map-selector').selectOption('WM2');await page.waitForFunction(()=>document.getElementById('map-selector')?.value==='WM2');}
   if(action==='workspace'){await panel('data');await page.locator('#workspace-directory').setInputFiles(folder);await page.waitForSelector('#workspace-connection[data-connected="true"][data-source="manual"]',{state:'attached'});await page.waitForSelector('#field-context[data-walk-parse-ms]',{state:'attached'});}
   await release();await absent();await page.waitForTimeout(100);await absent();
   if(action==='other-field')assert.equal(await page.locator('#field-walkmesh').getAttribute('data-field-id'),otherField);
   if(action==='map'){await page.locator('#map-selector').selectOption('WM3');await absent();await page.locator('#map-selector').selectOption('WM0');await absent();}
   if(action==='workspace')assert(await page.locator('#field-workspace').isHidden());
   pass(`v5.1 pending Field decode / ${action} cancels obsolete save request without marker resurrection`);
  }finally{await context.close();}
 }

 // The Context identity can arrive before its optional Walkmesh. Gate exactly
 // openWalkmeshPack's header read, after the Context owner has been adopted.
 for(const cancel of [false,true]){
  const {context,page,panel,importSave,openField,marker,absent,release}=await makePage();
  try{
   await panel('data');await page.evaluate(bytes=>{window.__saveDecodeWaiting=false;window.__savePauseBytes=bytes;window.__oldSaveFields=new WeakRef(document.getElementById('field-context'));},16+length);
   await page.locator('#workspace-files').setInputFiles(uploadFiles(files));
   await page.waitForFunction(()=>window.__oldSaveFields.deref()!==document.getElementById('field-context')&&document.getElementById('field-context')?.dataset.parseMs!==undefined&&window.__saveDecodeWaiting);
   await importSave();await openField();await page.waitForSelector('#field-save-position[data-status="mesh_unavailable"]',{state:'attached'});await absent();
   if(cancel){await panel('data');await page.locator('#save-clear').click();}
   await release();await page.waitForSelector('#field-context[data-walk-parse-ms]',{state:'attached'});
   if(cancel){await absent();assert.equal(await page.locator('#field-save-position').count(),0);}else await marker('inside',true);
   pass(`v5.1 late optional Walkmesh / ${cancel?'Clear cancels pending session evidence':'matching identity resumes exact saved triangle'} / one existing Field owner`);
  }finally{await context.close();}
 }

 // Optional assets carry EV identity; neither a filename nor an unrelated core
 // geometry hash can authorize the verified-English formula.
 for(const mode of ['missing-source','mismatched-source','missing-walkmesh']){
  const {context,page,panel,importSave,openField,absent}=await makePage();
  try{
   const selected=new Map([...files].filter(([name])=>mode==='missing-source'?['gaia-meta.json','gaia-mesh.bin'].includes(name):mode==='missing-walkmesh'?name!=='gaia-field-walkmesh.bin':true));
   if(mode==='mismatched-source')for(const name of ['gaia-poi.json','gaia-field-context.json']){const value=JSON.parse(selected.get(name));value.sources['wm0.ev']='0'.repeat(64);selected.set(name,Buffer.from(JSON.stringify(value)));}
   await panel('data');await page.evaluate(()=>window.__oldSaveFields=new WeakRef(document.getElementById('field-context')));await page.locator('#workspace-files').setInputFiles(uploadFiles(selected));
   await page.waitForFunction(()=>window.__oldSaveFields.deref()!==document.getElementById('field-context')&&document.getElementById('workspace-status')?.dataset.manifest==='valid');
   if(mode!=='missing-source')await page.waitForSelector('#field-context[data-parse-ms]',{state:'attached'});
   await importSave();
   if(mode==='missing-walkmesh'){await openField();await page.waitForSelector('#field-save-position[data-status="mesh_unavailable"]',{state:'attached'});await absent();assert.equal(await page.locator('#field-save-position').getAttribute('data-triangle'),String(point.triangle));}
   else {assert.equal(await page.locator('#save-world-state').getAttribute('data-state'),'unknown');assert.equal(await page.locator('#save-world-state').getAttribute('data-reason'),mode==='missing-source'?'source_missing':'source_mismatch');assert.equal(await page.locator('#save-world-research').count(),0);}
   pass(`v5.1 ${mode} / explicit unavailable evidence without invented position or static prediction`);
  }finally{await context.close();}
 }
}
