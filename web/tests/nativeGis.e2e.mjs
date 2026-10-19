// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import path from 'node:path';

/** Runs through the existing shell and Native Viewer, with original private input. */
export async function nativeGisChecks({browser,url,pass,errors}){
 const samples=[];
 for(const lang of ['en','zh-CN','zh-TW','ja','ko'])for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:true}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  try{
   const began=performance.now();await page.goto(url+'?lang='+lang);await page.waitForSelector('#workspace-connection[data-connected="true"]',{state:'attached'});
   const panel=async id=>{if(!await page.locator('#app-tab-'+id).isVisible())await page.locator('#app-menu').click();await page.locator('#app-tab-'+id).click();};
   const open=async()=>{await panel('analysis');await page.locator('#native-analysis').waitFor({state:'visible'});if(!await page.locator('#native-analysis').evaluate(e=>e.open))await page.locator('#native-analysis > summary').click();};
   await panel('map');await page.locator('#map-selector').selectOption('WM2');await open();
   const source=await page.locator('#native-analysis').textContent();assert(!/native\.[a-z]+/.test(source));
   await page.locator('#native-diagnostic-filter').selectOption('zero');assert.equal(await page.locator('#native-analysis').getAttribute('data-matches'),'1257');
   await page.locator('#native-next-diagnostic').press('Enter');await page.locator('#native-inspector[data-triangle]').waitFor({state:'attached'});const picked=Number(await page.locator('#native-inspector').getAttribute('data-triangle'));assert(Number.isInteger(picked));assert((await page.locator('#native-inspector').textContent()).includes('raw height/raw horizontal unit'));
   await open();await page.locator('#native-diagnostic-filter').selectOption('degenerate');assert.equal(await page.locator('#native-analysis').getAttribute('data-matches'),'4');
   if(width<700)await page.locator('#native-next-diagnostic').tap();else await page.locator('#native-next-diagnostic').click();
   await open();await page.locator('#native-face-index').fill('0');await page.locator('#native-inspect-face').press('Enter');assert.equal(await page.locator('#native-inspector').getAttribute('data-triangle'),'0');
   await open();const before=await page.locator('#native-inspector').textContent(),raw=await page.locator('#native-measure-from').inputValue();assert.equal(raw,'0');assert((await page.locator('#native-analysis output').textContent()).includes('raw unit'));
   await panel('view');await page.locator('#native-relief').selectOption('100');await open();assert.equal(await page.locator('#native-inspector').textContent(),before);
   await page.locator('#native-diagnostic-filter').selectOption('nonmanifold');assert(Number(await page.locator('#native-analysis').getAttribute('data-matches'))>0);
   await panel('map');await page.locator('#map-selector').selectOption('WM3');await open();assert.equal(await page.locator('#native-analysis').getAttribute('data-map-id'),'WM3');assert.equal(await page.locator('#native-face-index').inputValue(),'');
   await page.locator('#native-diagnostic-filter').selectOption('zero');assert.equal(await page.locator('#native-analysis').getAttribute('data-matches'),'0');await page.locator('#native-diagnostic-filter').selectOption('all');assert.equal(await page.locator('#native-analysis').getAttribute('data-matches'),'8268');
   await page.locator('#native-face-index').fill('8268');await page.locator('#native-inspect-face').click();assert.equal(await page.locator('#native-inspector').getAttribute('data-triangle'),null);
   await page.locator('#native-face-index').fill('0');await page.locator('#native-inspect-face').click();assert.equal(await page.locator('#native-inspector').getAttribute('data-map-id'),'WM3');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await panel('map');await page.locator('#map-selector').selectOption('WM0');assert(await page.locator('#native-analysis').evaluate(e=>e.hidden));assert.equal(await page.locator('#native-inspector').getAttribute('data-triangle'),null);
   samples.push({lang,width,flowMs:performance.now()-began,heap:await page.evaluate(()=>performance.memory?.usedJSHeapSize??null)});
   pass(`Native GIS ${lang} ${width}px / source diagnostics / raw measure / relief invariance / WM2-WM3-WM0 release`);
  }finally{await context.close();}
 }
 console.log('Native GIS observed performance (no forced GC): '+JSON.stringify(samples));
 await nativeGisLifecycleChecks({browser,url,pass,errors});
}

export async function nativeGisLifecycleChecks({browser,url,pass,errors}){
 const folder=process.env.GAIA_BROWSER_WORKSPACE;assert(folder);
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(url+'?lang=en');await page.waitForSelector('#workspace-connection[data-connected="true"]',{state:'attached'});
  const panel=async id=>{if(!await page.locator('#app-tab-'+id).isVisible())await page.locator('#app-menu').click();await page.locator('#app-tab-'+id).click();};
  await panel('map');await page.locator('#map-selector').selectOption('WM2');await page.waitForSelector('#native-analysis[data-map-id="WM2"]',{state:'attached'});
  await page.evaluate(()=>{const read=File.prototype.arrayBuffer;window.__nativeGate=true;File.prototype.arrayBuffer=async function(){if(this.name==='gaia-map-WM2.bin'&&window.__nativeGate){window.__nativeReadStarted=true;await new Promise(resolve=>window.__nativeReadRelease=resolve);}return read.call(this);};});
  await page.locator('#native-map-file').setInputFiles(path.join(folder,'gaia-map-WM2.bin'));await page.waitForFunction(()=>window.__nativeReadStarted);
  await page.locator('#map-selector').selectOption('WM3');await page.waitForSelector('#native-analysis[data-map-id="WM3"]',{state:'attached'});await page.evaluate(()=>{window.__nativeGate=false;window.__nativeReadRelease();});await page.waitForTimeout(250);assert.equal(await page.locator('#map-selector').inputValue(),'WM3');assert.equal(await page.locator('#native-analysis').getAttribute('data-map-id'),'WM3');
  await page.locator('#native-map-file').setInputFiles({name:'damaged.bin',mimeType:'application/octet-stream',buffer:Buffer.from('not a native pack')});await page.waitForTimeout(200);assert.equal(await page.locator('#native-analysis').getAttribute('data-map-id'),'WM3');
  for(let repeat=0;repeat<2;repeat++){
   await panel('data');await page.locator('#workspace-directory').setInputFiles(folder);await page.waitForSelector('#workspace-connection[data-connected="true"][data-source="manual"]',{state:'attached'});await page.waitForFunction(()=>document.querySelector('#map-selector').value==='WM0');
   assert(await page.locator('#native-analysis').evaluate(e=>e.hidden));assert.equal(await page.locator('#native-inspector').getAttribute('data-triangle'),null);
   await panel('map');await page.locator('#map-selector').selectOption('WM2');await page.waitForSelector('#native-analysis[data-map-id="WM2"]',{state:'attached'});
  }
  pass('Native delayed source cancellation / corrupt input preserves valid map / two Workspace imports clear analysis and Inspector');
 }finally{await context.close();}
}
