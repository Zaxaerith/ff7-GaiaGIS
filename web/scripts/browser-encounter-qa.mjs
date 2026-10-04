// SPDX-License-Identifier: GPL-3.0-only
// Private integration QA: real datasets/screenshots remain under ignored output/.
import {chromium} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=`${root}output/v1_2/browser-qa`;
mkdirSync(`${out}/tmp`,{recursive:true});mkdirSync(`${out}/screenshots`,{recursive:true});
for(const key of ['TMP','TEMP','TMPDIR'])process.env[key]=`${out}/tmp`;
const data=JSON.parse(readFileSync(`${root}web/public/data/gaia-encounters.json`,'utf8'));
const results={checks:{},errors:[],metrics:{jsonBytes:readFileSync(`${root}web/public/data/gaia-encounters.json`).length},screenshots:[]};
const browser=await chromium.launch({executablePath:process.env.GAIA_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-networking','--no-first-run']});
const check=(key,v)=>{results.checks[key]=!!v;if(!v)throw new Error(key);};
const watch=p=>p.on('pageerror',e=>results.errors.push(String(e)));
const ready=async p=>{await p.locator('#loading').waitFor({state:'hidden',timeout:60000});await p.waitForFunction(()=>document.getElementById('encounter-status').textContent.startsWith('Encounters loaded'));};
const shot=async(p,name)=>{await p.screenshot({path:`${out}/screenshots/${name}.png`,fullPage:true});results.screenshots.push(name);};
const mode=async(p,id)=>{await p.locator('#projection').selectOption(id);await p.waitForFunction(()=>document.getElementById('app').dataset.morphing==='false');};
async function hook(p){
  // Test-side capture only. No debug hooks are added to the application.
  await p.evaluate(async()=>{
    const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/viewer/GaiaViewer.ts'))?.name;
    const {GaiaViewer}=await import(url||'/src/viewer/GaiaViewer.ts');const original=GaiaViewer.prototype.setColorLayer;
    GaiaViewer.prototype.setColorLayer=function(layer){window.__qaViewer=this;return original.call(this,layer);};
    document.getElementById('color-layer').dispatchEvent(new Event('change'));GaiaViewer.prototype.setColorLayer=original;
    const v=window.__qaViewer;window.__qaGeometry=v.surface.geometry;window.__qaPositions=v.surface.geometry.getAttribute('position').array;
    const selected={};
    for(let i=0;i<v.mesh.sourceTriangleCount;i++){
      const a=v.mesh.attributes(i);if(a.origin)continue;
      const region=Math.min(a.region,15),effective=a.terrain===16?0:a.terrain===24?8:a.terrain;
      const row=v.encounters.regions[region].terrain_slots,slot=Math.max(0,row.indexOf(effective)),s=v.encounters.encounter_sets[region*4+slot];
      if(a.script===0&&s.active&&a.region===0&&a.terrain===0)selected.grass??=i;
      if(a.script===0&&s.active&&a.terrain===1)selected.forest??=i;
      if(a.script===0&&s.active&&a.terrain===25)selected.jungle??=i;
      if(a.script===0&&a.chocobo)selected.tracks??=i;
      if(!s.active)selected.inactive??=i;
      if(a.origin===0&&a.region===2&&a.script===0&&s.active)selected.other??=i;
    }
    window.__qaCases=selected;
  });
}
async function verifySurface(p,tracks){
  return p.evaluate(async tracks=>{
    const {Color}=await import('/node_modules/.vite/deps/three.js');
    const {encounterColor}=await import('/src/data/encounters.ts');
    const v=window.__qaViewer,array=v.surface.geometry.getAttribute('color').array;
    for(const key of Object.keys(window.__qaCases)){
      const source=window.__qaCases[key],a=v.mesh.attributes(source),face=v.display.renderToSource.indexOf(source);
      const expected=new Color(tracks&&a.chocobo?'#ffdb64':encounterColor(v.encounters,a,v.colorLayer==='encounter-rate'));
      const offset=face*9;if(Math.abs(array[offset]-expected.r)>1e-6||Math.abs(array[offset+1]-expected.g)>1e-6||Math.abs(array[offset+2]-expected.b)>1e-6)return false;
    }
    return true;
  },tracks);
}
async function target(p,key){
  await p.evaluate(key=>{
    const v=window.__qaViewer,t=window.__qaCases[key];if(t===undefined)throw new Error(`No real case ${key}`);
    const coords=[0,1,2].map(j=>{const i=v.mesh.indices[t*3+j]*3;return [v.mesh.geographic[i],v.mesh.geographic[i+1]];});
    const lon=Math.atan2(coords.reduce((s,c)=>s+Math.sin(c[0]*Math.PI/180),0),coords.reduce((s,c)=>s+Math.cos(c[0]*Math.PI/180),0))*180/Math.PI;
    v.focusLocation(lon,coords.reduce((s,c)=>s+c[1],0)/3);
    document.getElementById('info-panel').classList.remove('mobile-open');document.querySelector('.controls').classList.remove('mobile-open');
  },key);
  await p.waitForTimeout(80);
  return p.evaluate(async key=>{
    const {Vector3}=await import('/node_modules/.vite/deps/three.js');
    const v=window.__qaViewer,t=window.__qaCases[key],render=v.display.renderToSource.indexOf(t),pos=v.frame.positions;
    const point=new Vector3();for(let j=0;j<3;j++)point.add(new Vector3().fromArray(pos,render*9+j*3));point.divideScalar(3);
    v.camera.updateMatrixWorld();point.project(v.camera);const b=v.renderer.domElement.getBoundingClientRect();
    return {x:b.x+(point.x+1)*b.width/2,y:b.y+(1-point.y)*b.height/2,source:t,attr:v.mesh.attributes(t)};
  },key);
}
try{
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),p=await ctx.newPage();watch(p);
  const begin=Date.now();await p.goto('http://127.0.0.1:5173/?lang=en');await ready(p);results.metrics.totalReadyMs=Date.now()-begin;
  await hook(p);results.cases=await p.evaluate(()=>window.__qaCases);
  await p.locator('#locations-toggle').uncheck();await p.waitForTimeout(1800);results.metrics.terrainFps=Number(await p.locator('#app').getAttribute('data-fps'));
  await p.locator('#color-layer').selectOption('encounter');await p.waitForTimeout(1800);results.metrics.encounterFps=Number(await p.locator('#app').getAttribute('data-fps'));
  results.metrics.drawCalls=Number(await p.locator('#app').getAttribute('data-draw-calls'));
  check('all_tracks_faces_from_source_flag',await p.evaluate(async()=>{
    const {Color}=await import('/node_modules/.vite/deps/three.js');const v=window.__qaViewer;
    v.setChocoboTracks(true);const expected=new Color('#ffdb64'),array=v.surface.geometry.getAttribute('color').array;let count=0;
    for(let face=0;face<v.display.renderToSource.length;face++){
      const a=v.mesh.attributes(v.display.renderToSource[face]);if(a.origin||!a.chocobo)continue;count++;
      for(let j=0;j<3;j++){const k=face*9+j*3;if(Math.abs(array[k]-expected.r)>1e-6||Math.abs(array[k+1]-expected.g)>1e-6||Math.abs(array[k+2]-expected.b)>1e-6)return false;}
    }
    v.setChocoboTracks(false);return count>0;
  }));
  for(const id of ['globe','equirectangular','mercator','mollweide','orthographic']){
    await mode(p,id);
    for(const key of ['grass','forest','jungle','tracks','inactive','other']){
      const point=await target(p,key);await p.mouse.click(point.x,point.y);
      check(`${id}_${key}_source`,await p.locator('#selection-details').getAttribute('data-source-triangle')===String(point.source));
      check(`${id}_${key}_encounter_inspector`,await p.locator('.gameplay-inspector').count()===1);
      check(`${id}_${key}_lineage`,(await p.locator('#selection-details').innerText()).includes('Section'));
      const active=await p.locator('.gameplay-inspector').getAttribute('data-table-active');check(`${id}_${key}_active`,active===(key==='inactive'?'false':'true'));
    }
    check(`${id}_encounter_surface_colors`,await verifySurface(p,false));
    const before=await p.screenshot();await p.locator('#chocobo-tracks').check();const after=await p.screenshot();check(`${id}_tracks_changes_pixels`,!before.equals(after));
    check(`${id}_tracks_surface_colors`,await verifySurface(p,true));
    check(`${id}_tracks_flag`,await p.locator('.gameplay-inspector').getAttribute('data-tracks')==='false');
    const point=await target(p,'tracks');await p.mouse.click(point.x,point.y);check(`${id}_track_source_flag`,await p.locator('.gameplay-inspector').getAttribute('data-tracks')==='true');
    await p.locator('#color-layer').selectOption('encounter-rate');check(`${id}_rate_legend`,(await p.locator('#terrain-legend').innerText()).includes('divisor'));
    check(`${id}_rate_surface_colors`,await verifySurface(p,true));
    check(`${id}_same_geometry`,await p.evaluate(()=>window.__qaViewer.surface.geometry===window.__qaGeometry&&window.__qaViewer.surface.geometry.getAttribute('position').array===window.__qaPositions));
    await shot(p,id);await p.locator('#chocobo-tracks').uncheck();await p.locator('#color-layer').selectOption('encounter');
  }
  await p.locator('.encounter-group summary').first().click();check('record_weight_no_fake_percent',(await p.locator('.encounter-group').first().innerText()).includes('Weight'));
  await p.locator('#locations-toggle').check();await p.locator('#location-search').fill('Midgar');await p.locator('.location-result').first().click();
  check('location_inspector_preserved',await p.locator('#selection-details').getAttribute('data-location')==='midgar');
  await p.locator('#local-encounters-file').setInputFiles({name:'gaia-encounters.json',mimeType:'application/json',buffer:Buffer.from('{}')});await p.waitForFunction(()=>document.getElementById('encounter-status').title.includes('Invalid'));
  check('corrupt_keeps_mesh_and_locations',await p.locator('canvas').count()===1&&await p.locator('#selection-details').getAttribute('data-location')==='midgar');
  const bad=structuredClone(data);bad.sources['wm0.map']='f'.repeat(64);await p.locator('#local-encounters-file').setInputFiles({name:'gaia-encounters.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await p.waitForFunction(()=>document.getElementById('encounter-status').title.includes('different'));
  check('incompatible_keeps_locations',await p.locator('#selection-details').getAttribute('data-location')==='midgar');
  const reloadBegan=Date.now();await p.locator('#local-encounters-file').setInputFiles(`${root}web/public/data/gaia-encounters.json`);await ready(p);results.metrics.encounterLocalLoadWallMs=Date.now()-reloadBegan;
  for(const width of [390,320]){
    const mobile=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),m=await mobile.newPage();watch(m);await m.goto('http://127.0.0.1:5173/?lang=en');await ready(m);await hook(m);
    await m.locator('#mobile-display').tap();await m.locator('#locations-toggle').uncheck();await m.locator('#color-layer').selectOption('encounter-rate');await m.locator('#chocobo-tracks').check();
    check(`mobile_${width}_legend`,await m.locator('#terrain-legend').isVisible());
    check(`mobile_${width}_toggle`,await m.locator('#chocobo-tracks').isChecked());
    await m.locator('#mobile-display').tap();
    for(const id of ['globe','equirectangular','mercator','mollweide','orthographic']){
      await mode(m,id);const point=await target(m,'tracks');await m.touchscreen.tap(point.x,point.y);
      check(`mobile_${width}_${id}_tap`,await m.locator('#selection-details').getAttribute('data-source-triangle')===String(point.source));
      await m.locator('.gameplay-inspector').scrollIntoViewIfNeeded();check(`mobile_${width}_${id}_inspector`,await m.locator('.gameplay-inspector').getAttribute('data-tracks')==='true');
      await m.locator('.encounter-group summary').first().tap();check(`mobile_${width}_${id}_groups`,await m.locator('.encounter-group').first().getAttribute('open')!==null);
      check(`mobile_${width}_${id}_no_overflow`,await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await shot(m,`mobile-${width}`);await mobile.close();
  }
  const release=await browser.newContext({viewport:{width:1440,height:1000}}),r=await release.newPage(),requests=[];watch(r);r.on('request',q=>requests.push({method:q.method(),url:q.url()}));
  await r.goto('http://127.0.0.1:5175/?lang=en');await r.locator('#local-dataset-files').setInputFiles([`${root}web/public/data/gaia-meta.json`,`${root}web/public/data/gaia-mesh.bin`]);await r.locator('#loading').waitFor({state:'hidden',timeout:60000});
  check('source_only_optional_absent',(await r.locator('#encounter-status').innerText()).startsWith('Encounter data unavailable'));
  check('optional_encounter_layer_disabled',await r.locator('#color-layer option[value="encounter"]').isDisabled());
  await r.locator('#chocobo-tracks').check();check('tracks_independent_of_table',await r.locator('#tracks-legend').isVisible());
  await r.locator('#local-poi-file').setInputFiles(`${root}web/public/data/gaia-poi.json`);await r.waitForFunction(()=>document.getElementById('location-status').textContent.startsWith('34 locations'));
  await r.locator('#local-encounters-file').setInputFiles(`${root}web/public/data/gaia-encounters.json`);await ready(r);
  check('optional_independent_load',await r.locator('#color-layer option[value="encounter"]').isEnabled());
  check('no_game_data_requests_or_uploads',requests.every(q=>q.method==='GET'&&!q.url.includes('/data/')));
  await shot(r,'source-only');check('no_page_errors',results.errors.length===0);results.success=true;
}catch(error){results.failure=String(error);results.success=false;console.error(error);}
writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));await browser.close();if(!results.success)process.exitCode=1;
