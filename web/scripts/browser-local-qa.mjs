// SPDX-License-Identifier: GPL-3.0-only
// Requires the real local launcher. Evidence is private, ignored output.
import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=root+'output/local-launcher-validation/browser';
mkdirSync(out+'/tmp',{recursive:true});for(const key of ['TEMP','TMP','TMPDIR'])process.env[key]=out+'/tmp';
const base=process.env.GAIAGIS_QA_URL??'http://127.0.0.1:5180',report={checks:{},metrics:{},errors:[]};
const browser=await chromium.launch({executablePath:process.env.GAIAGIS_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const check=(id,value)=>{report.checks[id]=!!value;if(!value)throw Error(id);};
async function tab(p,id){if(await p.locator('#app-menu').isVisible()&&!await p.locator('#integrated-panel').evaluate(e=>e.classList.contains('open')))await p.locator('#app-menu').click();await p.locator('#app-tab-'+id).click();}
try{
 for(const width of [1440,390,320]){
  const p=await browser.newPage({viewport:{width,height:1000},hasTouch:true,reducedMotion:'reduce'}),requests=[];let pickers=0;
  p.on('filechooser',()=>pickers++);p.on('pageerror',e=>report.errors.push(String(e)));p.on('request',r=>requests.push(r.url()));
  const begin=performance.now();await p.goto(base+'/?lang=en');await p.waitForFunction(()=>document.getElementById('local-workspace-indicator')?.textContent?.includes('Workspace loaded automatically'),{},{timeout:60000});
  report.metrics['autoLoadMs_'+width]=performance.now()-begin;
  check('no_picker_'+width,pickers===0);check('no_intro_'+width,await p.locator('#gaia-intro').count()===0);check('WM0_visible_'+width,await p.locator('#app canvas').count()===1);
  await tab(p,'data');check('all_components_'+width,(await p.locator('#workspace-assets dd').allTextContents()).every(s=>s==='Loaded')&&await p.locator('#workspace-assets dd').count()===12);
  check('path_free_'+width,!/[A-Z]:[\\/]|Users[\\/]/i.test(await p.locator('#app-group-data').innerText()));check('manual_collapsed_'+width,!await p.locator('#manual-loading').evaluate(e=>e.open));
  await tab(p,'view');check('WM0_texture_'+width,await p.locator('#surface-style').inputValue()==='texture');
  if(await p.locator('#integrated-close').isVisible())await p.locator('#integrated-close').click();await p.screenshot({path:out+'/WM0-'+width+'.png'});
  for(const id of ['WM2','WM3']){
   await tab(p,'map');await p.locator('#map-selector').selectOption(id);await p.waitForSelector('.native-viewport canvas');await tab(p,'layers');
   check(id+'_texture_'+width,await p.locator('#native-layer').inputValue()==='texture');
   await p.waitForFunction(()=>Number(document.querySelector('.native-host')?.dataset.drawCalls??0)>0&&Number(document.querySelector('.native-host')?.dataset.fps??0)>0);
   await p.waitForTimeout(900);
   report.metrics[id+'_drawCalls_'+width]=Number(await p.locator('.native-host').getAttribute('data-draw-calls'));
   report.metrics[id+'_fps_'+width]=Number(await p.locator('.native-host').getAttribute('data-fps'));
   check(id+'_no_overflow_'+width,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(await p.locator('#integrated-close').isVisible())await p.locator('#integrated-close').click();await p.screenshot({path:out+'/'+id+'-'+width+'.png'});
  }
  await tab(p,'map');await p.locator('#map-selector').selectOption('WM0');await tab(p,'data');
  check('transitions_'+width,await p.locator('#workspace-assets div').filter({has:p.locator('dt', {hasText:/^transitions$/})}).locator('dd').innerText()==='Loaded');
  check('Explorer_'+width,await p.locator('#workspace-assets div').filter({has:p.locator('dt', {hasText:/^explorer$/})}).locator('dd').innerText()==='Loaded');
  check('only_generated_requests_'+width,requests.filter(u=>u.includes('/__gaiagis_local__/assets/')).length===13&&!requests.some(u=>/world_us\.lgp|flevel\.lgp|wm\d\.map|wm\d\.bot/i.test(u)));
  await p.close();
 }
 if(process.env.GAIAGIS_PUBLIC_QA_URL){
  const p=await browser.newPage(),requests=[],errors=[];p.on('request',r=>requests.push(r.url()));p.on('pageerror',e=>errors.push(String(e)));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  await p.goto(process.env.GAIAGIS_PUBLIC_QA_URL+'/?lang=en');await p.waitForSelector('#integrated-panel',{state:'attached'});
  check('public_no_local_probe',!requests.some(u=>u.includes('/__gaiagis_local__/')));check('public_no_generated_requests',!requests.some(u=>/gaia-.*\.(json|bin)/.test(u)));check('public_manual_retained',await p.locator('#workspace-files').count()===1);check('public_no_errors',errors.length===0);await p.close();
 }
 check('no_page_errors',report.errors.length===0);
}catch(error){report.failure=String(error);process.exitCode=1;}finally{writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
