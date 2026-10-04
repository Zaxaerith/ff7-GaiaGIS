// SPDX-License-Identifier: GPL-3.0-only
// Private integration QA: real datasets/screenshots remain under ignored output/.
import {chromium} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=`${root}output/v1_3/browser-qa`;
mkdirSync(`${out}/tmp`,{recursive:true});mkdirSync(`${out}/screenshots`,{recursive:true});
for(const key of ['TMP','TEMP','TMPDIR'])process.env[key]=`${out}/tmp`;

const results={checks:{},errors:[],metrics:{},screenshots:[]};
const browser=await chromium.launch({executablePath:process.env.GAIA_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-networking','--no-first-run']});
const check=(key,v)=>{results.checks[key]=!!v;if(!v)throw new Error(key);};
const watch=p=>p.on('pageerror',e=>results.errors.push(String(e)));
const ready=async p=>{await p.locator('#loading').waitFor({state:'hidden',timeout:60000});await p.waitForFunction(()=>document.getElementById('encounter-status').textContent.startsWith('Encounters loaded'));};
const shot=async(p,name)=>{await p.screenshot({path:`${out}/screenshots/${name}.png`,fullPage:true});results.screenshots.push(name);};
const mode=async(p,id)=>{await p.locator('#projection').selectOption(id);await p.waitForFunction(()=>document.getElementById('app').dataset.morphing==='false');};
async function hook(p){
  // Test-side capture only. No debug hooks are added to the application.
  await p.evaluate(async()=>{
    const moduleUrl=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/viewer/GaiaViewer.ts'))?.name;
    const {GaiaViewer}=await import(moduleUrl||'/src/viewer/GaiaViewer.ts');const original=GaiaViewer.prototype.setColorLayer;
    GaiaViewer.prototype.setColorLayer=function(layer){window.__qaViewer=this;return original.call(this,layer);};
    document.getElementById('color-layer').dispatchEvent(new Event('change'));GaiaViewer.prototype.setColorLayer=original;
    const v=window.__qaViewer;window.__qaGeometry=v.surface.geometry;window.__qaPositions=v.surface.geometry.getAttribute('position').array;
    const selected={};let bridgeArea=-1;
    const wanted={grass:0,forest:1,mountain:2,sea:3,river:4,desert:8,beach:17,bridge:14,cave:27};
    for(let i=0;i<v.mesh.sourceTriangleCount;i++){
      const a=v.mesh.attributes(i);if(a.origin)continue;
      for(const [key,t]of Object.entries(wanted))if(a.terrain===t)selected[key]??=i;
      if(a.terrain===14){const c=[0,1,2].map(j=>{const vtx=v.mesh.indices[i*3+j]*3;return [v.mesh.geographic[vtx],v.mesh.geographic[vtx+1]];});const area=Math.abs((c[1][0]-c[0][0])*(c[2][1]-c[0][1])-(c[2][0]-c[0][0])*(c[1][1]-c[0][1]));if(area>=bridgeArea){bridgeArea=area;selected.bridge=i;}}
      if(a.terrain===0&&a.script===7)selected.grassScript7??=i;
      if(a.chocobo)selected.tracks??=i;
    }
    window.__qaCases=selected;
  });
}
async function verifySurface(p,tracks=false){
  return p.evaluate(async tracks=>{
    const {Color}=await import('/node_modules/.vite/deps/three.js');
    const {traversalColor}=await import('/src/data/traversal.ts');
    const v=window.__qaViewer,array=v.surface.geometry.getAttribute('color').array;
    for(const source of [...Object.values(window.__qaCases),v.mesh.sourceTriangleCount]){
      const a=v.mesh.attributes(source),face=v.display.renderToSource.indexOf(source);
      const expected=new Color(tracks&&a.chocobo?'#ffdb64':traversalColor(v.movementMode,a));
      for(let j=0;j<3;j++){const k=face*9+j*3;if(Math.abs(array[k]-expected.r)>1e-6||Math.abs(array[k+1]-expected.g)>1e-6||Math.abs(array[k+2]-expected.b)>1e-6)return false;}
    }
    return true;
  },tracks);
}
async function target(p,key){
  await p.evaluate(key=>{
    const v=window.__qaViewer,t=window.__qaCases[key];if(t===undefined)throw new Error(`No real case ${key}`);
    const coords=[0,1,2].map(j=>{const i=v.mesh.indices[t*3+j]*3;return [v.mesh.geographic[i],v.mesh.geographic[i+1]];});
    const lon=Math.atan2(coords.reduce((s,c)=>s+Math.sin(c[0]*Math.PI/180),0),coords.reduce((s,c)=>s+Math.cos(c[0]*Math.PI/180),0))*180/Math.PI;
    v.resetView();v.focusLocation(lon,coords.reduce((s,c)=>s+c[1],0)/3);
    if(key==='bridge')v.zoom(v.projectionId==='globe'?0.4:0.05);
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
  await p.locator('#locations-toggle').uncheck();await p.waitForTimeout(1500);
  results.metrics.terrainFps=Number(await p.locator('#app').getAttribute('data-fps'));
  results.metrics.terrainDrawCalls=Number(await p.locator('#app').getAttribute('data-draw-calls'));
  await p.locator('#color-layer').selectOption('traversal');
  check('movement_selector_available',await p.locator('#movement-mode').isVisible());
  const legendText=await p.locator('#terrain-legend').innerText();check('four_state_legend', ['Allowed','Conditional','Blocked','Unknown'].every(s=>legendText.includes(s)));
  const profiles=await p.locator('#movement-mode option').evaluateAll(es=>es.map(e=>e.value));check('ten_profiles',profiles.length===10);
  results.metrics.modeSwitchMs=[];
  for(const id of ['globe','equirectangular','mercator','mollweide','orthographic']){
    await mode(p,id);
    for(const key of ['grass','forest','mountain','sea','river','desert','beach','bridge','cave']){
      const point=await target(p,key);await p.mouse.click(point.x,point.y);
      const picked=await p.locator('#selection-details').getAttribute('data-source-triangle');if(picked!==String(point.source)){results.pickFailure={id,key,point,picked,actual:await p.evaluate(()=>window.__qaViewer.mesh.attributes(Number(document.getElementById('selection-details').dataset.sourceTriangle)))};await shot(p,'pick-failure');}
      check(`${id}_${key}_source`,await p.locator('#selection-details').getAttribute('data-source-triangle')===String(point.source));
      check(`${id}_${key}_traversal_inspector`,await p.locator('.traversal-inspector').count()===1);
      check(`${id}_${key}_encounter_coexists`,await p.locator('.gameplay-inspector').count()===1);
      check(`${id}_${key}_lineage`,(await p.locator('#selection-details').innerText()).includes('Section'));
    }
    for(const profile of profiles){
      const switchBegin=Date.now();await p.locator('#movement-mode').selectOption(profile);results.metrics.modeSwitchMs.push(Date.now()-switchBegin);
      check(`${id}_${profile}_colors`,await verifySurface(p));
      check(`${id}_${profile}_selected_mode`,await p.locator('.traversal-inspector').getAttribute('data-mode')===profile);
      const expected=await p.evaluate(async()=>{const {evaluateTraversal}=await import('/src/data/traversal.ts');const v=window.__qaViewer;const t=Number(document.getElementById('selection-details').dataset.sourceTriangle),a=v.mesh.attributes(t);return evaluateTraversal(v.movementMode,a.terrain,a.script,a.origin).state;});
      check(`${id}_${profile}_inspector_state`,await p.locator('.traversal-inspector').getAttribute('data-state')===expected);
    }
    await p.locator('.traversal-matrix summary').click();check(`${id}_matrix_ten_modes`,await p.locator('.traversal-matrix dd').count()===10);await p.locator('.traversal-matrix summary').click();
    check(`${id}_same_geometry`,await p.evaluate(()=>window.__qaViewer.surface.geometry===window.__qaGeometry&&window.__qaViewer.surface.geometry.getAttribute('position').array===window.__qaPositions));
    await p.locator('#chocobo-tracks').check();check(`${id}_tracks_overlay_independent`,await verifySurface(p,true));await p.locator('#chocobo-tracks').uncheck();
    await p.locator('#movement-mode').selectOption('highwind-landing');await shot(p,id);
  }
  await p.locator('#projection').selectOption('globe');await p.waitForFunction(()=>document.getElementById('app').dataset.morphing==='false');await p.evaluate(()=>{window.__qaViewer.clearSelection();window.__qaViewer.resetView();});await p.waitForTimeout(1600);
  results.metrics.traversalFps=Number(await p.locator('#app').getAttribute('data-fps'));results.metrics.traversalDrawCalls=Number(await p.locator('#app').getAttribute('data-draw-calls'));
  results.metrics.directModeSwitchMs=await p.evaluate(async()=>{const {movementProfiles}=await import('/src/data/traversal.ts');return movementProfiles.map(p=>{const start=performance.now();window.__qaViewer.setMovementMode(p.id);return performance.now()-start;});});
  check('no_added_draw_calls',results.metrics.terrainDrawCalls===results.metrics.traversalDrawCalls);
  // Cross-language classification for all 320 ordinary terrain cells + script-7 cases.
  const expected=JSON.parse(readFileSync(`${root}output/v1_3/statistics.json`,'utf8'));
  check('python_ts_reference_matrix',await p.evaluate(async expected=>{const {evaluateTraversal,movementProfiles}=await import('/src/data/traversal.ts');return movementProfiles.every(p=>Array.from({length:32},(_,t)=>evaluateTraversal(p.id,t).state).join(',')===expected.matrix[p.id].join(','));},expected));
  await p.locator('#locations-toggle').check();await p.locator('#location-search').fill('Midgar');await p.locator('.location-result').first().click();
  check('poi_search_fly_to_preserved',await p.locator('#selection-details').getAttribute('data-location')==='midgar');
  check('location_does_not_gain_triangle_traversal',await p.locator('.traversal-inspector').count()===0);
  await p.locator('#color-layer').selectOption('encounter-rate');check('encounter_rate_preserved',(await p.locator('#terrain-legend').innerText()).includes('divisor'));
  await p.locator('#color-layer').selectOption('region');check('traversal_selector_hides',!(await p.locator('#movement-mode').isVisible()));
  for(const width of [390,320]){
    const mobile=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),m=await mobile.newPage();watch(m);await m.goto('http://127.0.0.1:5173/?lang=en');await ready(m);await hook(m);
    await m.locator('#mobile-display').tap();await m.locator('#locations-toggle').uncheck();await m.locator('#color-layer').selectOption('traversal');await m.locator('#movement-mode').selectOption('highwind-landing');
    await m.locator('#terrain-legend').scrollIntoViewIfNeeded();check(`mobile_${width}_legend`,await m.locator('#terrain-legend').isVisible());
    check(`mobile_${width}_selector`,await m.locator('#movement-mode option').count()===10);await m.locator('#mobile-display').tap();
    for(const id of ['globe','equirectangular','mercator','mollweide','orthographic']){
      await mode(m,id);const point=await target(m,'grass');await m.touchscreen.tap(point.x,point.y);
      check(`mobile_${width}_${id}_tap`,await m.locator('#selection-details').getAttribute('data-source-triangle')===String(point.source));
      await m.locator('.traversal-inspector').scrollIntoViewIfNeeded();check(`mobile_${width}_${id}_inspector`,await m.locator('.traversal-inspector').isVisible());
      await m.locator('.traversal-matrix summary').tap();check(`mobile_${width}_${id}_matrix`,await m.locator('.traversal-matrix').getAttribute('open')!==null);
      check(`mobile_${width}_${id}_no_overflow`,await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await shot(m,`mobile-${width}`);await mobile.close();
  }
  const release=await browser.newContext({viewport:{width:1440,height:1000}}),r=await release.newPage(),requests=[];watch(r);r.on('request',q=>requests.push({method:q.method(),url:q.url()}));
  await r.goto('http://127.0.0.1:5175/?lang=en');await r.locator('#local-dataset-files').setInputFiles([`${root}web/public/data/gaia-meta.json`,`${root}web/public/data/gaia-mesh.bin`]);await r.locator('#loading').waitFor({state:'hidden',timeout:60000});
  await r.locator('#color-layer').selectOption('traversal');await r.locator('#movement-mode').selectOption('chocobo-gold');
  check('source_only_no_extra_dataset_required',await r.locator('#movement-mode').isVisible());
  check('source_only_locations_encounters_optional',(await r.locator('#encounter-status').innerText()).startsWith('Encounter data unavailable')&&(await r.locator('#location-status').innerText()).startsWith('Locations unavailable'));
  check('no_game_data_requests_or_uploads',requests.every(q=>q.method==='GET'&&!q.url.includes('/data/')));
  await r.locator('#local-encounters-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});await r.waitForFunction(()=>document.getElementById('encounter-status').title.includes('Invalid'));
  check('corrupt_optional_does_not_break_traversal',await r.locator('#movement-mode').inputValue()==='chocobo-gold'&&await r.locator('canvas').count()===1);
  await shot(r,'source-only');check('no_page_errors',results.errors.length===0);results.success=true;
}catch(error){results.failure=String(error);results.success=false;console.error(error);}
writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));await browser.close();if(!results.success)process.exitCode=1;
