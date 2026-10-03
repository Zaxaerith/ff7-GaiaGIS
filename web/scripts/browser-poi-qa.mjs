// SPDX-License-Identifier: GPL-3.0-only
// Private real-data integration QA. Generates no public FF7-derived fixtures.
import {chromium} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),output=`${root}output/v1_1/browser-qa`;
mkdirSync(`${output}/screenshots`,{recursive:true});mkdirSync(`${output}/tmp`,{recursive:true});
for(const key of ['TEMP','TMP','TMPDIR'])process.env[key]=`${output}/tmp`;
const data=JSON.parse(readFileSync(`${root}web/public/data/gaia-poi.json`,'utf8'));
const results={checks:{},errors:[],metrics:{poiCount:data.locations.length,entrances:data.entrances.length,jsonBytes:readFileSync(`${root}web/public/data/gaia-poi.json`).length},screenshots:[]};
const browser=await chromium.launch({executablePath:process.env.GAIA_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-networking','--no-first-run']});
const check=(name,value)=>{results.checks[name]=!!value;if(!value)throw new Error(name);};
const watch=p=>p.on('pageerror',e=>results.errors.push(String(e)));
const shot=async(p,name)=>{await p.screenshot({path:`${output}/screenshots/${name}.png`,fullPage:true});results.screenshots.push(name);};
const ready=async p=>{await p.locator('#loading').waitFor({state:'hidden',timeout:60000});await p.waitForFunction(count=>document.getElementById('location-status').textContent.includes(`${count} locations`),data.locations.length);};
const mode=async(p,id)=>{await p.locator('#projection').selectOption(id);await p.waitForFunction(()=>document.getElementById('app').dataset.morphing==='false');};
const choose=async(p,query)=>{
  await p.locator('#location-search').fill(query);await p.locator('.location-result').first().click();await p.waitForTimeout(1200);
};
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();watch(page);
  const began=Date.now();await page.goto('http://127.0.0.1:5173/');await ready(page);results.metrics.totalReadyMs=Date.now()-began;
  await page.waitForTimeout(2200);results.metrics.fpsWithPoi=Number(await page.locator('#app').getAttribute('data-fps'));
  await page.locator('#locations-toggle').uncheck();await page.waitForTimeout(2200);results.metrics.fpsWithoutPoi=Number(await page.locator('#app').getAttribute('data-fps'));await page.locator('#locations-toggle').check();
  const targets=['midgar','junon','mythril-mine','temple-of-the-ancients'];
  for(const id of ['globe','equirectangular','mercator','mollweide','orthographic']){
    await mode(page,id);
    for(const target of targets){
      const l=data.locations.find(l=>l.id===target);await choose(page,l.display_name);
      check(`${id}_${target}_inspector`,await page.locator('#selection-details').getAttribute('data-location')===target);
      check(`${id}_${target}_marker`,await page.locator(`.location-marker[data-location="${target}"]`).isVisible());
      const marker=await page.locator(`.location-marker[data-location="${target}"]`).boundingBox(),canvas=await page.locator('canvas').boundingBox();
      check(`${id}_${target}_fly_center`,Math.abs(marker.x+marker.width/2-canvas.x-canvas.width/2)<3&&Math.abs(marker.y+marker.height/2-canvas.y-canvas.height/2)<3);
      check(`${id}_${target}_provenance`,(await page.locator('#selection-details').innerText()).includes('wm0.ev'));
    }
    await shot(page,id);
  }
  await mode(page,'globe');await choose(page,'Mythril Mine');await page.locator('.entrance-list summary').click();
  check('multiple_entrances_list',await page.locator('.entrance-list button').count()>1);
  await page.locator('.entrance-list button').last().click();await page.waitForTimeout(1200);check('entrance_navigation',await page.locator('.entrance-list button[aria-pressed="true"]').count()===1);
  await page.locator('#clear-selection').click();await page.locator('#location-search').fill('cosmo');
  const center=await page.locator('#view-center').innerText();await page.locator('#location-search').press('ArrowDown');check('search_keyboard_no_rotation',await page.locator('#view-center').innerText()===center);
  await page.locator('#location-search').press('Enter');await page.waitForTimeout(1200);check('search_enter',await page.locator('#selection-details').getAttribute('data-location')==='cosmo-canyon');
  await page.locator('#location-search').fill('anything');await page.locator('#location-search').press('Escape');check('search_escape',await page.locator('.location-result').count()===0);
  const marker=page.locator('.location-marker[data-location="cosmo-canyon"]');await marker.click();check('marker_click',await page.locator('#inspector-title').innerText()==='Location inspector');
  await page.locator('#locations-toggle').uncheck();await page.waitForTimeout(150);check('locations_toggle',await page.locator('.location-marker:visible').count()===0);await page.locator('#locations-toggle').check();
  await page.locator('#location-filter').selectOption('dungeons');await page.waitForTimeout(100);check('category_filter',!await marker.isVisible());await page.locator('#location-filter').selectOption('all');
  await page.locator('#locations-toggle').uncheck();await page.waitForTimeout(100);await page.locator('#clear-selection').click();const box=await page.locator('canvas').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.locator('#selection-details').waitFor({state:'visible'});
  check('triangle_inspector_preserved',await page.locator('#inspector-title').innerText()==='Triangle inspector');
  await page.locator('#locations-toggle').check();
  await page.locator('#local-poi-file').setInputFiles({name:'gaia-poi.json',mimeType:'application/json',buffer:Buffer.from('{"schema":"bad"}')});await page.waitForFunction(()=>document.getElementById('location-status').textContent.includes('Invalid'));
  check('corrupt_poi_mesh_survives',await page.locator('canvas').count()===1);await page.locator('#local-poi-file').setInputFiles(`${root}web/public/data/gaia-poi.json`);await ready(page);
  for(const width of [390,320]){
    const mobile=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),p=await mobile.newPage();watch(p);await p.goto('http://127.0.0.1:5173/');await ready(p);
    for(const id of ['globe','equirectangular','mercator','mollweide','orthographic']){
      await mode(p,id);
      for(const target of targets){
        const l=data.locations.find(l=>l.id===target);
        await p.locator('#mobile-display').tap();await p.locator('#location-search').fill(l.display_name);await p.locator('.location-result').first().tap();await p.waitForTimeout(1200);
        check(`mobile_${width}_${id}_${target}_search_inspector`,await p.locator('#selection-details').getAttribute('data-location')===target);
        await p.locator('#clear-selection').tap();const dot=await p.locator(`.location-marker[data-location="${target}"]`).boundingBox();await p.touchscreen.tap(dot.x+dot.width/2,dot.y+dot.height/2);check(`mobile_${width}_${id}_${target}_marker_tap`,await p.locator('#selection-details').getAttribute('data-location')===target);
      }
    }
    check(`mobile_${width}_no_overflow`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot(p,`mobile-${width}`);await mobile.close();
  }
  const reduced=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),p=await reduced.newPage();watch(p);await p.goto('http://127.0.0.1:5173/#location=midgar');await ready(p);
  check('deep_link_reduced_motion',await p.locator('#selection-details').getAttribute('data-location')==='midgar');
  await p.locator('#location-search').fill('Junon');await p.locator('.location-result').first().click();await p.waitForTimeout(100);
  check('reduced_motion_endpoint',await p.locator('.location-marker[data-location="junon"]').isVisible());await reduced.close();
  // Separate source-only production server, no GET for data and no uploads.
  const release=await browser.newContext({viewport:{width:1440,height:1000}}),r=await release.newPage(),requests=[];watch(r);r.on('request',q=>requests.push({method:q.method(),url:q.url()}));
  await r.goto('http://127.0.0.1:5175/');await r.locator('#loading').waitFor({state:'visible'});
  await r.locator('#local-dataset-files').setInputFiles([`${root}web/public/data/gaia-meta.json`,`${root}web/public/data/gaia-mesh.bin`]);await r.locator('#loading').waitFor({state:'hidden',timeout:60000});
  check('two_file_chooser_unchanged',await r.locator('canvas').count()===1);check('optional_missing_poi',await r.locator('#location-status').innerText()==='Locations unavailable · optional local file');
  await r.locator('#local-poi-file').setInputFiles(`${root}web/public/data/gaia-poi.json`);await ready(r);await choose(r,'Midgar');check('source_only_local_poi',await r.locator('#selection-details').getAttribute('data-location')==='midgar');
  check('code_only_no_data_requests_or_uploads',requests.every(q=>q.method==='GET'&&!q.url.includes('/data/')));await shot(r,'source-only-local-poi');results.requests=requests;
  check('no_browser_errors',results.errors.length===0);results.success=true;
}catch(error){results.success=false;results.failure=String(error);console.error(error);}
writeFileSync(`${output}/results.json`,JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));await browser.close();if(!results.success)process.exitCode=1;
