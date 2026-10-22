// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

/** Private actual source acceptance through the maintained Viewer and shell. */
export async function worldVariantChecks({browser,url,pass,errors}){
 const resource=process.env.GAIA_WORLD_VARIANT_RESOURCE;
 if(!resource){console.log('SKIP World variant private browser checks: GAIA_WORLD_VARIANT_RESOURCE not supplied');return;}
 const samples=[];
 for(const lang of ['en','zh-CN','zh-TW','ja','ko'])for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:true}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type())&&/THREE.WebGLProgram|VALIDATE_STATUS|GL_INVALID|shader error/i.test(m.text()))errors.push(m.text());});
  try{
   const began=performance.now();await page.goto(url+'?lang='+lang);await page.waitForSelector('#workspace-connection[data-connected="true"]',{state:'attached'});
   const panel=async id=>{if(!await page.locator('#app-tab-'+id).isVisible())await page.locator('#app-menu').click();await page.locator('#app-tab-'+id).click();};
   const open=async()=>{await panel('analysis');if(!await page.locator('#world-variants').evaluate(e=>e.open))await page.locator('#world-variants > summary').click();};
   await open();assert.equal(await page.locator('#variant-enable').isChecked(),false);const before=await page.evaluate(()=>performance.memory?.usedJSHeapSize??null);
   await page.locator('#variant-file').setInputFiles(resource);await page.waitForSelector('#world-variants[data-source-hash]',{state:'attached'});assert.equal(await page.locator('#variant-enable').isChecked(),false);
   await page.waitForTimeout(1500);await page.locator('#variant-enable').check();await page.waitForSelector('#world-variants[data-active="true"]',{state:'attached'});
   assert.equal(await page.locator('#analysis-panel input:enabled,#analysis-panel select:enabled,#analysis-panel button:enabled').count(),0);assert.equal(await page.locator('#variant-state option').count(),5);assert(!/variant\.[a-z]/.test(await page.locator('#world-variants').textContent()));
   const switches=[],constructMs=[];
   for(let state=0;state<5;state++){
    await open();const at=performance.now();await page.locator('#variant-state').selectOption(String(state));assert.equal(await page.locator('#world-variants').getAttribute('data-state'),String(state));
    await page.locator('#variant-group').selectOption(String(Math.max(1,state)));if(width<700)await page.locator('#variant-next').tap();else await page.locator('#variant-next').press('Enter');
    const expected=[50,63,64,66,67][state];await page.waitForFunction(expected=>document.getElementById('variant-inspector')?.dataset.sourceId?.startsWith(expected+'/'),expected);
    const raw=await page.locator('#variant-inspector pre').textContent();assert.match(raw,/source_reference_state/);assert.match(raw,/runtime_selection/);assert.match(raw,/Unknown/);assert.match(raw,/raw_X_Z_Y/);assert.match(raw,/compressed_header_offset/);
    switches.push(performance.now()-at);constructMs.push(Number(await page.locator('#world-variants').getAttribute('data-switch-ms')));
   }
   await comparisonChecks({page,open,lang,width,pass});
   await open();await page.locator('#variant-boundary').uncheck();await page.locator('#variant-boundary').check();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   samples.push({lang,width,flowMs:performance.now()-began,decodeMs:Number(await page.locator('#world-variants').getAttribute('data-decode-ms')),geometryBytes:Number(await page.locator('#world-variants').getAttribute('data-geometry-bytes')),drawSubmissionMs:Number(await page.locator('#app').getAttribute('data-variant-draw-ms')),projectionMs:Number(await page.locator('#app').getAttribute('data-variant-projection-ms')),switchMs:switches,constructMs,heapBefore:before,heapResearch:await page.evaluate(()=>performance.memory?.usedJSHeapSize??null)});
   if(lang==='en'&&(width===1440||width===320)){
    await open();await page.locator('#variant-group').selectOption('1');await page.locator('#variant-next').click();await page.waitForTimeout(1100);
    if(width<1100){if(await page.locator('#integrated-inspector').evaluate(e=>e.classList.contains('open')))await page.locator('#collapse-inspector').click();if(await page.locator('#integrated-panel').evaluate(e=>e.classList.contains('open')))await page.locator('#integrated-close').click();}
    const bounds=await page.locator('#viewport canvas').boundingBox();assert(bounds);if(width===320)await page.touchscreen.tap(bounds.x+bounds.width/2,bounds.y+bounds.height/2);else await page.mouse.click(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
    await page.waitForFunction(()=>document.getElementById('world-variants')?.dataset.canvasPick?.startsWith('63/'));assert.match(await page.locator('#variant-inspector').getAttribute('data-source-id'),/^63\//);pass('World variant actual Canvas '+(width===320?'touch':'mouse')+' picking keeps alternative source identity');
   }
   if(lang==='en'&&width===1440){
    await panel('view');const ids=await page.locator('#projection option').evaluateAll(options=>options.map(o=>o.value));assert.equal(ids.length,13);
    for(const id of ids){await page.locator('#projection').selectOption(id);await page.waitForTimeout(1250);assert.equal(await page.locator('#world-variants').getAttribute('data-active'),'true');}
    await page.locator('#projection').selectOption('globe');await page.waitForTimeout(1300);pass('World variants: all 13 projections / Globe / independent source namespace');
    if(process.env.GAIA_VARIANT_QA_DIR)await page.screenshot({path:path.join(process.env.GAIA_VARIANT_QA_DIR,'variant-state4-private.png')});
   }
   await open();await page.locator('#variant-reset').click();assert.equal(await page.locator('#world-variants').getAttribute('data-active'),'false');assert.equal(await page.locator('#world-variants').getAttribute('data-source-hash'),null);assert.equal(await page.locator('#variant-inspector').getAttribute('data-source-id'),null);assert.equal(await page.locator('#variant-compare-results button').count(),0);assert.equal(await page.locator('#variant-compare-chart svg').count(),0);
   await panel('map');for(const id of ['WM2','WM3','WM0']){await page.locator('#map-selector').selectOption(id);await page.waitForTimeout(450);}
   assert.equal(await page.locator('#world-variants').getAttribute('data-active'),'false');
   pass(`World variants ${lang} ${width}px / explicit import / cumulative 0–4 / raw Inspector / keyboard-touch / native return / release`);
  }finally{await context.close();}
 }
 await lifecycle({browser,url,resource,pass,errors,samples});
 console.log('World variant observed performance (no forced GC): '+JSON.stringify(samples));
 if(process.env.GAIA_VARIANT_QA_DIR)await writeFile(path.join(process.env.GAIA_VARIANT_QA_DIR,'browser-performance.json'),JSON.stringify(samples,null,2)+'\n');
}

async function comparisonChecks({page,open,lang,width,pass}){
 const comparison=async()=>{await open();if(!await page.locator('#variant-comparison').evaluate(e=>e.open))await page.locator('#variant-comparison>summary').click();};
 const point=async(a,b,x,z)=>{await comparison();await page.locator('#variant-compare-left').selectOption(String(a));await page.locator('#variant-compare-right').selectOption(String(b));await page.locator('#variant-compare-x').fill(x);await page.locator('#variant-compare-z').fill(z);await page.locator('#variant-compare-query').press('Enter');};
 const profile=async(a,b,A,B)=>{await comparison();await page.locator('#variant-compare-left').selectOption(String(a));await page.locator('#variant-compare-right').selectOption(String(b));for(const [id,value]of [['a-x',A[0]],['a-z',A[1]],['b-x',B[0]],['b-z',B[1]]])await page.locator('#variant-compare-'+id).fill(value);await page.locator('#variant-compare-transect').click();};
 const result=()=>page.locator('#variant-comparison');
 await point(0,1,'510089/3','547085/3');assert.equal(await result().getAttribute('data-delta'),'-1760');assert.equal(await page.locator('#variant-state').inputValue(),'4');
 const row=page.locator('[data-variant-result="63/8/15"][data-query-state="1"]');if(width<700)await row.tap();else await row.press('Enter');
 assert.equal(await page.locator('#variant-inspector').getAttribute('data-query-state'),'1');assert.equal(await page.locator('#variant-inspector').getAttribute('data-display-state'),'4');assert.equal(await page.locator('#variant-state').inputValue(),'4');
 await page.locator('#variant-show-source-state').click();assert.equal(await page.locator('#variant-state').inputValue(),'1');assert.equal(await page.locator('#variant-compare-right').inputValue(),'1');
 await open();await page.locator('#variant-state').selectOption('4');
 if(lang==='en'&&width===1440){
  for(const [a,b,x,z,delta]of [[1,2,'175979','133610','10'],[2,3,'641024/3','199290','-16'],[3,4,'293017/3','502708/3','2450317/96357']]){await point(a,b,x,z);assert.equal(await result().getAttribute('data-delta'),delta);}
  for(const [a,b,x,z,n,m]of [[1,2,'507551/3','146422',3,3],[2,3,'660265/3','604807/3',4,1],[3,4,'262898/3','510173/3',4,4],[2,3,'395817/2','394175/2',2,2]]){await point(a,b,x,z);assert.equal(await result().getAttribute('data-left-hits'),String(n));assert.equal(await result().getAttribute('data-right-hits'),String(m));assert.equal(await result().getAttribute('data-delta'),'');}
  await point(1,2,'538505/3','414776/3');assert.equal(await result().getAttribute('data-delta'),'0');await page.locator('[data-variant-result="64/1/95"]').click();assert.match(await page.locator('#variant-inspector pre').textContent(),/1229/);assert.equal(await page.locator('#variant-state').inputValue(),'4');
  for(const [a,b,A,B,n,m]of [[1,2,['507551/3','145910'],['507551/3','146934'],6,6],[1,2,['169322','146422'],['168960','146422'],13,13],[2,3,['660265/3','603271/3'],['660265/3','606343/3'],10,6],[3,4,['87562','169823'],['87668','170175'],13,13]]){await profile(a,b,A,B);assert.equal(await page.locator('#variant-compare-chart [data-trace][data-series="0"]').count(),n);assert.equal(await page.locator('#variant-compare-chart [data-trace][data-series="1"]').count(),m);}
  await profile(0,4,['160000','180000'],['180000','180000']);assert.equal(await page.locator('#variant-compare-chart [data-coverage="outside"]').count(),2);assert.equal(await page.locator('#variant-compare-chart [data-coverage="noSurface"]').count(),0);assert.match(await page.locator('#variant-compare-chart').textContent(),/24\/125/);
  await point(0,4,'0','0');assert.equal(await result().getAttribute('data-coverage'),'outside');assert.equal(await result().getAttribute('data-left-hits'),'0');await point(0,4,'163840','180000');assert.equal(await result().getAttribute('data-coverage'),'boundary');
  await point(0,1,'1/0','0');assert.equal(await page.locator('#variant-compare-results button').count(),0);assert.equal(await result().getAttribute('data-delta'),null);
  pass('Variant comparison G1–G4 / strict delta / multi-height / shared edge / attribute source / vertical bands / resource coverage / invalid input');
 }
 await profile(0,1,['507017/3','547085/3'],['513161/3','547085/3']);assert.equal(await page.locator('#variant-compare-chart [data-trace][data-series="0"]').count(),12);assert.equal(await page.locator('#variant-compare-chart [data-trace][data-series="1"]').count(),12);
 const path=page.locator('#variant-compare-chart [data-query-state="1"][data-trace]').first();await path.press('Enter');assert.equal(await page.locator('#variant-inspector').getAttribute('data-query-state'),'1');assert.equal(await page.locator('#variant-state').inputValue(),'4');
 await comparison();assert(!/variant\.compare\.[a-z]/.test(await result().textContent()));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#variant-compare-clear').click();assert.equal(await page.locator('#variant-compare-chart svg').count(),0);assert.equal(await page.locator('#variant-compare-results button').count(),0);
 if(lang==='en'&&width===1440)await point(0,1,'510089/3','547085/3');
 pass(`Variant comparison ${lang} ${width}px / independent states / explicit display / keyboard-touch / shared SVG / clear`);
}

async function lifecycle({browser,url,resource,pass,errors,samples}){
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type())&&/THREE.WebGLProgram|VALIDATE_STATUS|GL_INVALID|shader error/i.test(m.text()))errors.push(m.text());});
 try{
  await page.goto(url+'?lang=en');await page.waitForSelector('#workspace-connection[data-connected="true"]',{state:'attached'});
  const panel=async id=>{if(!await page.locator('#app-tab-'+id).isVisible())await page.locator('#app-menu').click();await page.locator('#app-tab-'+id).click();};
  const open=async()=>{await panel('analysis');await page.locator('#world-variants').evaluate(e=>e.open=true);};
  await open();await page.locator('#variant-file').setInputFiles(resource);await page.waitForSelector('#world-variants[data-source-hash]',{state:'attached'});await page.waitForTimeout(1500);await page.locator('#variant-enable').check();
  const original=JSON.parse(await readFile(resource,'utf8'));
  for(const error of ['source','duplicate','index','compression']){
   const envelope=structuredClone(original);if(error==='source')envelope.source_sha256='b'.repeat(64);
   if(['duplicate','index'].includes(error)){const payload=JSON.parse(envelope.payload);if(error==='duplicate')payload.meshes[1]=structuredClone(payload.meshes[0]);else payload.meshes[0][8][0][0]=256;envelope.payload=JSON.stringify(payload);envelope.payload_bytes=Buffer.byteLength(envelope.payload);envelope.payload_sha256=createHash('sha256').update(envelope.payload).digest('hex');}
   const bytes=error==='compression'?Buffer.from([31,139,8,0,1,2,3]):Buffer.from(JSON.stringify(envelope));await page.locator('#variant-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:bytes});await page.waitForFunction(()=>document.getElementById('variant-status')?.title.length>0);assert.equal(await page.locator('#world-variants').getAttribute('data-active'),'true');
  }
  await page.locator('#variant-comparison').evaluate(e=>e.open=true);await page.locator('#variant-compare-x').fill('510089/3');await page.locator('#variant-compare-z').fill('547085/3');await page.locator('#variant-compare-query').click();assert(await page.locator('#variant-compare-results button').count()>0);
  // Replacing a valid active resource must release old geometry and restore base tools.
  await page.locator('#variant-file').setInputFiles(resource);await page.waitForFunction(()=>document.getElementById('world-variants')?.dataset.active==='false'&&!!document.getElementById('world-variants')?.dataset.sourceHash);
  assert.equal(await page.locator('#variant-enable').isChecked(),false);assert.equal(await page.locator('#compare-projections').isDisabled(),false);assert(await page.locator('#analysis-panel input:enabled,#analysis-panel select:enabled,#analysis-panel button:enabled').count()>0);assert.equal(await page.locator('#variant-active-note').isVisible(),false);
  assert.equal(await page.locator('#variant-compare-results button').count(),0);assert.equal(await page.locator('#variant-comparison').isVisible(),false);
  await page.locator('#variant-enable').check();
  await page.evaluate(()=>{const read=File.prototype.arrayBuffer;File.prototype.arrayBuffer=async function(){if(this.name==='world-variants.json'&&window.__variantGate){window.__variantWaiting=true;await new Promise(resolve=>window.__variantRelease=resolve);}return read.call(this);};window.__variantGate=true;});
  await page.locator('#variant-file').setInputFiles(resource);await page.waitForFunction(()=>window.__variantWaiting);await panel('map');await page.locator('#map-selector').selectOption('WM2');await page.evaluate(()=>{window.__variantGate=false;window.__variantRelease();});await page.waitForTimeout(200);assert.equal(await page.locator('#world-variants').getAttribute('data-active'),'false');
  await page.locator('#map-selector').selectOption('WM0');await open();assert.equal(await page.locator('#world-variants').getAttribute('data-source-hash'),null);
  const folder=process.env.GAIA_BROWSER_WORKSPACE;assert(folder);
  for(let i=0;i<3;i++){
   await open();await page.locator('#variant-file').setInputFiles(resource);await page.waitForSelector('#world-variants[data-source-hash]',{state:'attached'});await page.locator('#variant-enable').check();await page.locator('#variant-state').selectOption('4');
   const heapResearch=await page.evaluate(()=>performance.memory?.usedJSHeapSize??null);await page.locator('#variant-reset').click();await page.waitForTimeout(150);samples.push({cycle:i,heapResearch,heapClosed:await page.evaluate(()=>performance.memory?.usedJSHeapSize??null)});
  }
  await open();await page.locator('#variant-file').setInputFiles(resource);await page.waitForSelector('#world-variants[data-source-hash]',{state:'attached'});await page.locator('#variant-enable').check();await page.locator('#variant-comparison').evaluate(e=>e.open=true);await page.locator('#variant-compare-x').fill('510089/3');await page.locator('#variant-compare-z').fill('547085/3');await page.locator('#variant-compare-query').click();
  await panel('explore');await page.locator('#location-search').fill('mds5_1');await page.locator('[data-navigation-id="field:177"]').click();await page.locator('#field-view-walkmesh').click();await page.waitForSelector('#field-walkmesh-canvas');assert.equal(await page.locator('#variant-compare-results button').count(),0);assert.equal(await page.locator('#variant-compare-chart svg').count(),0);await page.locator('#field-world-return').click();
  for(let i=0;i<2;i++){await panel('data');await page.locator('#workspace-directory').setInputFiles(folder);await page.waitForSelector('#workspace-connection[data-connected="true"][data-source="manual"]',{state:'attached'});await page.waitForSelector('#world-variants',{state:'attached'});assert.equal(await page.locator('#variant-enable').isChecked(),false);assert.equal(await page.locator('#world-variants').getAttribute('data-source-hash'),null);}
  pass('World variant corrupt/source/duplicate/index/compressed input rejection / late import / WM2 / repeated mode release / Workspace replacement');
 }finally{await context.close();}
}
