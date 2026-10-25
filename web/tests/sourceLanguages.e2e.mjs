// SPDX-License-Identifier: GPL-3.0-only
// Private generated packs only; no game archives or saves become public fixtures.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

export async function sourceLanguageChecks({browser,url,pass,errors}){
 const root=process.env.GAIA_LANGUAGE_WORKSPACES;if(!root){console.log('SKIP multilingual Workspace checks: GAIA_LANGUAGE_WORKSPACES not supplied');return;}
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const panel=async id=>{if(!await page.locator('#app-tab-'+id).isVisible())await page.locator('#app-menu').click();await page.locator('#app-tab-'+id).click();};
 const importWorkspace=async folder=>{
  const manifest=JSON.parse(await readFile(path.join(folder,'gaia-workspace.json'),'utf8'));
  // The existing Visual pack exceeds Playwright's 50 MB in-memory upload cap.
  // Use the actual private generated files, as normal folder import does.
  const files=[...manifest.assets.map(a=>a.filename),'gaia-workspace.json'].map(name=>path.join(folder,name));
  await panel('data');const old=await page.locator('#integrated-panel').getAttribute('data-workspace-load-ms');await page.locator('#workspace-files').setInputFiles(files);
  await page.waitForFunction(previous=>{const p=document.getElementById('integrated-panel');return p?.dataset.workspaceLoadMs!==undefined&&p.dataset.workspaceLoadMs!==previous&&document.getElementById('workspace-status')?.dataset.manifest==='valid';},old,{timeout:90_000});
  assert.equal(await page.locator('#field-walkmesh-canvas').count(),0);return manifest;
 };
 try{
  await page.goto(url+'?lang=en');await page.waitForSelector('#workspace-connection[data-connected="true"]',{state:'attached'});
  for(const [language,world,field] of [['fr','world_fr.lgp','fflevel.lgp'],['de','world_gm.lgp','gflevel.lgp'],['es','world_sp.lgp','sflevel.lgp'],['en','world_us.lgp','flevel.lgp']]){
   const manifest=await importWorkspace(path.join(root,'workspace-'+language));assert.match(await page.locator('#workspace-game-language').textContent(),new RegExp(language.toUpperCase()+'.*'+world+'.*'+field));
   assert.match(await page.locator('#app-tab-explore').textContent(),/Explore/);
   await panel('explore');await page.locator('#location-search').fill('church');const fields=JSON.parse(await readFile(path.join(root,'workspace-'+language,'gaia-field-context.json'),'utf8')),node=fields.nodes.find(n=>n.name==='church');
   await page.locator(`[data-navigation-id="field:${node.id}"]`).click();await page.locator('#field-view-walkmesh').click();await page.waitForSelector('#field-walkmesh[data-triangles="93"]',{state:'attached'});
   await page.locator('#field-camera-controls').evaluate(e=>e.open=true);await page.locator('#field-camera-view').selectOption('overlay');await page.waitForFunction(()=>document.getElementById('field-walkmesh')?.dataset.backgroundDecodeMs!==undefined);
   assert.match(await page.locator('#field-camera-evidence').textContent(),new RegExp(field));assert.equal(await page.locator('#field-walkmesh-canvas').count(),1);
   const contextSources=manifest.sources;assert(contextSources[world]&&contextSources[field]);assert(!contextSources['world_jp.lgp']);
   await page.locator('#field-world-return').click();assert.equal(await page.locator('#field-walkmesh-canvas').count(),0);
   await panel('data');pass(`multilingual ${language.toUpperCase()} actual Workspace / church Camera / exact sources / owner disposal`);
  }
  // Previously published EN Context v3 and Manifest v1 remain usable.
  await importWorkspace(process.env.GAIA_BROWSER_WORKSPACE);await panel('explore');await page.locator('#location-search').fill('mds5_1');await page.locator('[data-navigation-id="field:177"]').click();await page.locator('#field-view-walkmesh').click();await page.waitForSelector('#field-walkmesh[data-triangles="163"]',{state:'attached'});pass('multilingual cycle → old EN Workspace v1 / Field Context v3 / existing Canvas');
 }finally{await context.close();}
}
