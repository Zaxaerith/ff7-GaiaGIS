// SPDX-License-Identifier: GPL-3.0-only
// Private before/after captures stay in ignored output, never in public fixtures.
import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=root+'output/v2_1/color';mkdirSync(out+'/tmp',{recursive:true});for(const k of ['TEMP','TMP','TMPDIR'])process.env[k]=out+'/tmp';
const report={checks:{},pixels:{},metrics:{},errors:[]},check=(k,v)=>{report.checks[k]=!!v;if(!v)throw Error(k);};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
try{
 for(const [name,port]of [['before',5176],['after',5173]]){
  const p=await context.newPage();p.on('pageerror',e=>report.errors.push(String(e)));await p.goto(`http://127.0.0.1:${port}/?lang=en`);
  await p.locator('#workspace-files').setInputFiles([...['gaia-meta.json','gaia-mesh.bin','gaia-textures.bin'].map(name=>({name,mimeType:'application/octet-stream',buffer:readFileSync(root+'output/local-workspace/'+name)})),{name:'gaia-explorer.bin',mimeType:'application/octet-stream',buffer:readFileSync(name==='before'?root+'output/v2_1/baseline-explorer.bin':root+'output/local-workspace/gaia-explorer.bin')}]);
  await p.waitForFunction(()=>document.querySelector('#viewport canvas')!==null,{},{timeout:60000});
  await p.waitForFunction(()=>document.getElementById('explorer-start')&&!document.getElementById('explorer-start').disabled);
  await p.evaluate(async()=>{const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/explorer/controller.ts')).name;window.e=(await import(url)).activeExplorer;await window.e.arm();if(!window.e.place(22556,[1/3,1/3,1/3]))throw Error('fixed grass anchor rejected');});
  await p.waitForTimeout(500);await p.screenshot({path:out+'/'+name+'.png'});
  report.metrics[name]=await p.evaluate(()=>({point:[window.e.state.nativeX,window.e.state.nativeZ,window.e.state.rawInterpolatedHeight],camera:window.e.viewer.explorerBridge.camera.position.toArray(),target:window.e.viewer.explorerBridge.controls.target.toArray(),fps:document.getElementById('fps')?.textContent,diagnostics:window.e.diagnostics}));
  if(name==='after'){
   report.pixels=await p.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{srgbToLinear,configureOutput}=await import('/src/explorer/lighting.ts');
    const renderer=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(16,16);configureOutput(renderer);const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;
    const geometry=new T.PlaneGeometry(2,2),material=new T.MeshBasicMaterial({vertexColors:true}),mesh=new T.Mesh(geometry,material);scene.add(mesh);const colors=new Float32Array(12);geometry.setAttribute('color',new T.BufferAttribute(colors,3));
    const sample=(value,texture=false)=>{colors.fill(value);geometry.attributes.color.needsUpdate=true;if(texture){material.map=new T.DataTexture(new Uint8Array([128,128,128,255]),1,1);material.map.colorSpace=T.SRGBColorSpace;material.map.needsUpdate=true;material.needsUpdate=true;}renderer.render(scene,camera);const bytes=new Uint8Array(4);renderer.getContext().readPixels(8,8,1,1,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,bytes);return [...bytes];};
    const result={missingDecode:sample(128/255),corrected:sample(srgbToLinear(128/255)),white:sample(1),textureGray:sample(1,true)};material.map?.dispose();material.dispose();geometry.dispose();renderer.dispose();renderer.forceContextLoss();return result;
   });check('missing_decode_188',Math.abs(report.pixels.missingDecode[0]-188)<=1);check('correct_gray_128',Math.abs(report.pixels.corrected[0]-128)<=1);check('texture_decoded_once',Math.abs(report.pixels.textureGray[0]-128)<=1);check('white_not_clipped',report.pixels.white[0]===255);
   check('all_nine_animation_matrices_finite',await p.evaluate(async()=>{const {OriginalModel}=await import('/src/explorer/model.ts'),{Box3}=await import('/node_modules/three/build/three.module.js');for(const m of window.e.pack.header.models.filter(m=>m.characterId)){const model=new OriginalModel(window.e.pack,m);model.object.updateMatrixWorld(true);if(Math.abs(new Box3().setFromObject(model.object).min.y)>1e-4)return false;for(let clip=0;clip<2;clip++)for(let f=0;f<m.clips[clip].frame_count;f++){model.pose(clip,f/30+.000001);model.object.updateMatrixWorld(true);if(model.bones.some(b=>b.matrixWorld.elements.some(v=>!Number.isFinite(v))))return false;}model.dispose();}return true;}));
   check('incompatible_party_switch_rejected',await p.evaluate(()=>{const e=window.e;e.selectVisual('chocobo-gold');let water=-1;for(let i=0;i<e.surface.count;i++)if(e.surface.attrs(i).terrain===3&&e.place(i,[1/3,1/3,1/3])){water=i;break;}if(water<0)return false;const before=e.state.nativeX,result=e.selectVisual('aerith');return result===false&&e.model.model.id==='chocobo'&&e.state.nativeX===before;}));
   await p.evaluate(()=>{window.qaViewer=window.e.viewer;window.e.exit();window.qaViewer.setProjection('mercator');});await p.waitForTimeout(1800);
   const hash=async()=>createHash('sha256').update(await p.locator('#viewport canvas').screenshot()).digest('hex'),flat=await hash();
   await p.evaluate(async()=>{const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/app/presentation.ts')).name;(await import(url)).setPresentation({lighting:'debug'});});await p.waitForTimeout(100);check('2d_map_pixel_identical_across_model_presets',flat===await hash());
  }
  await p.close();
 }
 check('same_raw_anchor',JSON.stringify(report.metrics.before.point)===JSON.stringify(report.metrics.after.point));
 check('same_camera_and_target',JSON.stringify(report.metrics.before.camera)===JSON.stringify(report.metrics.after.camera)&&JSON.stringify(report.metrics.before.target)===JSON.stringify(report.metrics.after.target));
 // Public/no-source UX remains silent and does not fetch local assets.
 const publicPage=await context.newPage(),requests=[];publicPage.on('request',r=>requests.push(r.url()));await publicPage.goto('http://127.0.0.1:5173/?lang=en');await publicPage.waitForSelector('#presentation-theme',{state:'attached'});await publicPage.waitForTimeout(600);check('public_no_private_requests',!requests.some(s=>/__gaiagis_local__|gaia-presentation|audio\.dat|char\.lgp/.test(s)));check('public_audio_unavailable',await publicPage.locator('#presentation-sounds').isDisabled());
 await publicPage.locator('#app-tab-view').click();await publicPage.locator('#presentation-settings').evaluate(e=>e.open=true);await publicPage.locator('#presentation-theme').selectOption('scientific');await publicPage.reload();await publicPage.waitForSelector('#presentation-theme',{state:'attached'});check('theme_persisted',await publicPage.locator('html').getAttribute('data-theme')==='scientific');await publicPage.locator('#app-tab-view').click();await publicPage.locator('#presentation-settings').evaluate(e=>e.open=true);await publicPage.locator('#presentation-theme').selectOption('ff7');await publicPage.locator('#presentation-theme').focus();await publicPage.keyboard.press('Tab');check('keyboard_focus_visible',await publicPage.evaluate(()=>getComputedStyle(document.activeElement).outlineWidth==='3px'));await publicPage.close();
 check('no_errors',report.errors.length===0);
}catch(e){report.failure=String(e);process.exitCode=1;}finally{writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
