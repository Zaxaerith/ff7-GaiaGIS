// SPDX-License-Identifier: GPL-3.0-only
// Test the built static Viewer under a repository-style Pages base path.
import {chromium,devices} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const output=`${root}output/web/qa`;
mkdirSync(output,{recursive:true});
const context=await chromium.launchPersistentContext(`${output}/production-profile`,{
  executablePath:process.env.GAIA_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless:true,...devices['iPhone 13'],viewport:{width:390,height:844},
  args:['--disable-background-networking','--no-first-run']
});
const page=context.pages()[0],errors=[],requests=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
page.on('response',response=>{
  requests.push({url:response.url(),status:response.status()});
  if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);
});
const results={checks:{},errors,requests};
try{
  await page.goto('http://127.0.0.1:5174/FF7Gaia/',{waitUntil:'networkidle'});
  await page.locator('#loading').waitFor({state:'hidden',timeout:30000});
  await page.waitForTimeout(1200);
  for(const resource of ['gaia-meta.json','gaia-mesh.bin']){
    if(!requests.some(r=>r.url.endsWith(`/FF7Gaia/data/${resource}`)&&r.status===200))throw new Error(`Missing base-prefixed ${resource}`);
  }
  results.checks.production_repository_base=true;
  const canvas=page.locator('canvas'),box=await canvas.boundingBox();
  const session=await context.newCDPSession(page);
  const x=box.x+box.width/2,y=box.y+box.height/2;
  const send=(type,points)=>session.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  const point=(id,x,y)=>({id,x,y,radiusX:5,radiusY:5,force:1});
  const initial=await canvas.screenshot();
  await send('touchStart',[point(1,x,y)]);
  for(let i=1;i<=12;i++)await send('touchMove',[point(1,x+i*6,y+i*2)]);
  await send('touchEnd',[]);await page.waitForTimeout(700);
  const rotated=await canvas.screenshot();
  if(initial.equals(rotated))throw new Error('Touch rotation did not change the rendered globe');
  results.checks.mobile_touch_rotate=true;
  await send('touchStart',[point(1,x-30,y),point(2,x+30,y)]);
  for(let i=1;i<=10;i++)await send('touchMove',[point(1,x-30-i*5,y),point(2,x+30+i*5,y)]);
  await send('touchEnd',[]);await page.waitForTimeout(700);
  if(rotated.equals(await canvas.screenshot()))throw new Error('Pinch did not change the rendered globe');
  results.checks.mobile_pinch_zoom=true;
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Mobile horizontal overflow');
  if(errors.length)throw new Error(errors.join('\n'));
  results.success=true;
}catch(error){results.success=false;results.failure=String(error);}
await context.close();
writeFileSync(`${output}/production-results.json`,JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
if(!results.success)process.exitCode=1;
