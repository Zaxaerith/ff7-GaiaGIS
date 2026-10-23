// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

/** Actual V1 source queries through the existing Analysis/Inspector owners. */
export async function wm0SourceChecks({browser,url,pass,errors}){
 const folder=process.env.GAIA_BROWSER_WORKSPACE;
 if(!folder){console.log('SKIP WM0 source browser checks: GAIA_BROWSER_WORKSPACE not supplied');return;}
 const poi=JSON.parse(await readFile(path.join(folder,'gaia-poi.json'),'utf8'));
 const entrance=poi.entrances.find(e=>e.id==='wm0-a0e4-1-0-16');assert(entrance);
 const samples=[];
 for(const [lang,width]of [['en',1440],['zh-CN',390],['zh-TW',320],['ja',390],['ko',320]]){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:true}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(url+'?lang='+lang);
   await page.waitForSelector('#workspace-connection[data-connected="true"]',{state:'attached'});
   await page.waitForSelector('#field-context[data-parse-ms]',{state:'attached'});
   const panel=async id=>{if(!await page.locator('#app-tab-'+id).isVisible())await page.locator('#app-menu').click();await page.locator('#app-tab-'+id).click();};
   const open=async()=>{
    await panel('analysis');await page.locator('#wm0-source-queries').waitFor({state:'visible'});
    if(!await page.locator('#wm0-source-queries').evaluate(e=>e.open))await page.locator('#wm0-source-queries > summary').click();
    await page.waitForSelector('#wm0-source-queries[data-faces="142586"]',{state:'attached'});
   };
   const timings=[];
   const query=async(x,z)=>{await open();await page.locator('#wm0-query-x').fill(String(x));await page.locator('#wm0-query-z').fill(String(z));await page.locator('#wm0-query-run').press('Enter');timings.push({kind:'point',ms:Number(await page.locator('#wm0-source-queries').getAttribute('data-query-ms'))});};
   const trace=async(ax,az,bx,bz)=>{await open();for(const [id,value]of [['a-x',ax],['a-z',az],['b-x',bx],['b-z',bz]])await page.locator('#wm0-'+id).fill(String(value));await page.locator('#wm0-transect-run').press('Enter');timings.push({kind:'transect',ms:Number(await page.locator('#wm0-source-queries').getAttribute('data-transect-ms'))});};
   const inspector=page.locator('#wm0-source-inspector');
   await query(38269,88205);
   assert.equal(await page.locator('#wm0-source-queries').getAttribute('data-corners'),'427758');
   assert.equal(await page.locator('#wm0-source-queries').getAttribute('data-zero-xz'),'246');
   assert.equal(await page.locator('#wm0-source-queries').getAttribute('data-duplicate-excess'),'84');
   assert.equal(await page.locator('#wm0-source-queries').getAttribute('data-hits'),'9');
   assert.equal(await page.locator('#wm0-source-queries').getAttribute('data-height-count'),'2');
   await page.locator('#wm0-query-results [data-source-id="19/8/115"]').press('Enter');
   assert.equal(await inspector.getAttribute('data-source-id'),'19/8/115');
   assert.equal(await inspector.getAttribute('data-query-kind'),'vertical');
   assert.match(await inspector.textContent(),/307/);assert.match(await inspector.textContent(),/462/);
   await query('510089/3','547085/3');
   assert.equal(await page.locator('#wm0-source-queries').getAttribute('data-hits'),'1');
   await page.locator('#wm0-query-results [data-source-id="50/8/15"]').press('Enter');
   assert.equal(await inspector.getAttribute('data-source-id'),'50/8/15');assert.match(await inspector.textContent(),/1814/);
   for(const x of [0,294912]){await query(x,100000);assert.equal(await page.locator('#wm0-source-queries').getAttribute('data-hits'),'2');}
   await trace(38000,88000,39000,89000);
   assert.equal(await page.locator('#wm0-transect-chart .native-transect-surface').count(),14);
   assert.equal(await page.locator('#wm0-transect-chart .native-transect-vertical_event').count(),4);
   await trace(100,100000,294800,100000);
   assert.equal(await page.locator('#wm0-transect-chart .native-transect-surface').count(),631);
   await page.locator('#wm0-transect-chart [data-trace]').first().focus();await page.keyboard.press('Enter');
   assert(await inspector.getAttribute('data-source-id'));
   await trace(294800,100000,295100,100000);
   assert(await page.locator('#wm0-query-results [data-wrap-offset="294912"]').count()>0);
   assert.match(await page.locator('#wm0-transect-chart').textContent(),/300 raw unit/);
   await trace(188,100000,-112,100000);
   assert(await page.locator('#wm0-query-results [data-wrap-offset="-294912"]').count()>0);

   // Read the existing trigger-derived navigation representative, not a new
   // hard-coded coordinate or a nearest-location association.
   await query(entrance.game_x,entrance.game_north);
   await page.locator('#wm0-query-results [data-source-id="32/10/132"]').press('Enter');
   assert(await inspector.locator('[data-source-event]').count()>0);
   assert.equal(await inspector.locator(`[data-source-entrance="${entrance.id}"]`).count(),1);
   assert.equal(await inspector.locator('[data-source-location="midgar"]').count(),1);
   assert(await inspector.locator('[data-source-atlas]').count()>0);
   assert(await inspector.locator('[data-source-field]').count()>0);
   assert(await inspector.locator('[data-source-encounter]').count()>0);
   assert(!/source\.[A-Za-z_]+/.test(await page.locator('#wm0-source-queries').textContent()));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));

   if(lang==='en'){
    await inspector.locator('[data-source-event]').first().press('Enter');
    assert(await page.locator('#selection-details').getAttribute('data-event'));
    await query(entrance.game_x,entrance.game_north);await page.locator('#wm0-query-results [data-source-id="32/10/132"]').press('Enter');
    await inspector.locator(`[data-source-entrance="${entrance.id}"]`).press('Enter');
    assert.equal(await page.locator('#selection-details').getAttribute('data-entrance'),entrance.id);
    await query(entrance.game_x,entrance.game_north);await page.locator('#wm0-query-results [data-source-id="32/10/132"]').press('Enter');
    await inspector.locator('[data-source-field]').first().press('Enter');
    // A context link selects the existing Field identity first. Enter its local
    // Walkmesh explicitly, as in the established Atlas/Field navigation flow.
    await page.locator('#field-view-walkmesh').click();
    await page.waitForSelector('#field-workspace:not([hidden])',{state:'attached'});
    assert.equal(await page.locator('#wm0-query-results button').count(),0);
    assert.equal(await page.locator('#wm0-transect-chart svg').count(),0);
    await page.locator('#field-world-return').click();
    await panel('explore');
    if(!await page.locator('#user-drawing').evaluate(e=>e.open))await page.locator('#user-drawing > summary').click();
    await page.locator('#draw-Polyline').click();
    const featuresBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('gaiagis.user-state')).userFeatures.length);
    await query(100000,100000);await page.locator('#wm0-query-pick').click();
    assert.equal(await page.locator('#user-drawing').getAttribute('data-tool'),'select');
    const canvas=page.locator('#viewport > canvas'),rect=await canvas.boundingBox();assert(rect);
    await page.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);
    await page.waitForFunction(()=>!document.getElementById('wm0-source-queries').dataset.armed&&document.getElementById('wm0-query-x').value!==''&&document.getElementById('wm0-source-queries').dataset.hits!==undefined);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gaiagis.user-state')).userFeatures.length),featuresBefore);
    await open();await page.locator('#wm0-query-pick').click();await panel('explore');await page.locator('#draw-Point').click();
    assert.equal(await page.locator('#wm0-source-queries').getAttribute('data-armed'),null);
    await page.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);
    await page.waitForFunction(count=>JSON.parse(localStorage.getItem('gaiagis.user-state')).userFeatures.length===count,featuresBefore+1);
    await page.locator('#draw-cancel').click();
    // The existing point lies exactly under this pick. Select-mode feature
    // capture must yield to source picking as well as drawing/edit modes.
    await open();await page.locator('#wm0-query-pick').click();await page.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);
    await page.waitForFunction(()=>!document.getElementById('wm0-source-queries').dataset.armed);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gaiagis.user-state')).userFeatures.length),featuresBefore+1);
    await panel('map');await page.locator('#map-selector').selectOption('WM2');
    assert(await page.locator('#wm0-source-queries').evaluate(e=>e.hidden));
    assert.equal(await page.locator('#wm0-query-results button').count(),0);
    await page.locator('#map-selector').selectOption('WM3');await page.locator('#map-selector').selectOption('WM0');
    await query(38269,88205);
    await page.evaluate(()=>{window.__previousWM0Source=new WeakRef(document.getElementById('wm0-source-queries'));});
    await panel('data');await page.locator('#workspace-directory').setInputFiles(folder);
    await page.waitForFunction(()=>document.getElementById('wm0-source-queries')&&window.__previousWM0Source.deref()!==document.getElementById('wm0-source-queries'));
    await page.waitForSelector('#workspace-connection[data-connected="true"][data-source="manual"]',{state:'attached'});
    await page.evaluate(()=>delete window.__previousWM0Source);
    assert.equal(await page.locator('#wm0-query-results button').count(),0);
    assert.equal(await page.locator('#wm0-transect-chart svg').count(),0);
    await query(100000,100000);await page.locator('#wm0-query-x').fill('1/0');await page.locator('#wm0-query-run').click();
    assert.equal(await page.locator('#wm0-query-results button').count(),0);
   }
   samples.push({lang,width,prepareMs:Number(await page.locator('#wm0-source-queries').getAttribute('data-prepare-ms')),timings});
   pass(`WM0 source ${lang} ${width}px / all-source heights & intervals / explicit periodic transect / integrated evidence`);
  }finally{await context.close();}
 }
 console.log('WM0 source observed query work: '+JSON.stringify(samples));
}
