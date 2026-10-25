// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {gameArchives,archiveKey,assertSourceAgreement} from '../src/data/sourceRoles';
import {parseFieldPack,openWalkmeshPack,FieldIndex,validateFieldPoi,decodeWalkmesh} from '../src/data/fieldContext';
import {openFieldVisual,parseVisualHeader} from '../src/data/fieldCamera';
import {openFieldInteraction} from '../src/data/fieldInteraction';
import {openFieldScriptEvidence} from '../src/data/fieldScriptEvidence';
import {predictSaveWorldState,saveFieldPoint} from '../src/data/saveSpatial';
import type {SaveSlot} from '../src/data/save';
import {WorkspaceLoader,fileHash} from '../src/app/workspace';
import {parsePoi} from '../src/data/poi';

const hash='a'.repeat(64),maplist='d6ac24b79403a77feeb338450b7cb2169cdbcfa5d071a6cee4884e93b700bc29';
const file=(name:string,sources:Record<string,string>={})=>new File([name.endsWith('.bin')?new Uint8Array(32):JSON.stringify({sources})],name);
function context(language:keyof typeof gameArchives){
 const [world,field]=gameArchives[language];
 return {schema:'gaiagis-field-context',version:4,coordinateSpace:'FieldLocalIdentity',archive:field,sources:{[world]:hash,[field]:hash,maplist,'wm0.ev':hash,'field.tbl':hash,'wm0.map':hash},nodes:[],edges:[],exits:[],unresolved:[],bindings:[],scriptTransitions:'bounded_mapjump',scriptEdges:[],scriptExits:[],scriptUnresolved:[],nativeRelations:[],entrances:Array.from({length:128},(_,record)=>({entry:Math.floor(record/2)+1,scenario:record%2,field_id:0,field_name:'dummy',field_x:0,field_y:0,field_triangle:0,field_direction:0,field_table_record:record,field_table_byte_offset:record*12,status:'placeholder',derivedZ:null})),gateways:[]};
}
describe('bounded game source roles',()=>{
 it('requires exact pairs and rejects aliases or mixed keys',()=>{
  for(const language of Object.keys(gameArchives) as (keyof typeof gameArchives)[]){const c=context(language);expect(parseFieldPack(c).archive).toBe(gameArchives[language][1]);expect(archiveKey(c.sources,'world')).toBe(gameArchives[language][0]);}
  for(const sources of [{},{'world_fr.lgp':hash,'world_us.lgp':hash},{'world_fr.lgp':hash,'gflevel.lgp':hash}])expect(()=>archiveKey(sources,'world')).toThrow();
  const c=context('fr');c.archive='flevel.lgp';expect(()=>parseFieldPack(c)).toThrow();
  expect(()=>assertSourceAgreement({'world_fr.lgp':hash},{'gflevel.lgp':hash})).toThrow();
 });
 it('legacy v1-v3 cannot claim a foreign archive',()=>{for(const version of [1,2,3])expect(()=>parseFieldPack({...context('fr'),version})).toThrow();});
 it('checks differing role keys before owner adoption, then accepts the next Workspace',async()=>{
  const outcomes:string[]=[],adopted:string[]=[],loader=new WorkspaceLoader((id,s)=>outcomes.push(id+':'+s.status));
  loader.register('geometry',async()=>{});loader.register('locations',async()=>{adopted.push('poi');});loader.register('events',async()=>{adopted.push('events');});
  await loader.load([file('gaia-meta.json'),file('gaia-mesh.bin'),file('gaia-poi.json',{'world_fr.lgp':hash}),file('gaia-events.json',{'world_gm.lgp':hash})]);
  expect(outcomes).toContain('events:incompatible');expect(adopted).toEqual(['poi']);
  for(const language of ['fr','de','es','en'] as const){const [world,field]=gameArchives[language];await loader.load([file('gaia-meta.json'),file('gaia-mesh.bin'),file('gaia-poi.json',{[world]:hash,[field]:hash}),file('gaia-events.json',{[world]:hash})]);}
  expect(adopted.filter(x=>x==='events')).toHaveLength(4);
 });
 it('a foreign Manifest cannot relabel legacy member-only EN POI evidence',async()=>{
  for(const language of ['en','fr'] as const){const [world,field]=gameArchives[language],files=[file('gaia-meta.json'),file('gaia-mesh.bin'),file('gaia-poi.json',{'wm0.ev':hash})],assets=await Promise.all(files.map(async(f,i)=>({filename:f.name,type:['metadata','geometry','locations'][i],mapId:'WM0',sha256:await fileHash(f),bytes:f.size,dependencies:i===0?[]:[files[i-1].name]}))),outcomes:string[]=[];let adopted=false;
   const loader=new WorkspaceLoader((id,s)=>outcomes.push(id+':'+s.status));loader.register('geometry',async()=>{});loader.register('locations',async()=>{adopted=true;});
   await loader.load([...files,new File([JSON.stringify({schema:'gaiagis-workspace',version:1,tool_version:'5.2.0',timestamp_policy:'omitted',sources:{[world]:hash,[field]:hash},assets})],'gaia-workspace.json')]);
   expect(adopted).toBe(language==='en');if(language==='fr')expect(outcomes).toContain('locations:incompatible');
  }
 });
 it('foreign complete EV fingerprints remain Unknown for static prediction',()=>{
  const slot={status:'valid',worldStateInputs:{progressSigned:1620,c1f0:true,f2b0:true,f2a4:true}} as SaveSlot;
  for(const ev of ['7664bf39da3f7f46474bcce29aa39f9ffd044e88b587e1c251a4acd23bd506bd','c11d93aff555088368f432ed0c0f08d6fb0b5d0d40123d5681f83c3d0083be7f','b92798f1b5fb9adbfd495a23d44655822e256023251f267ca43fff14ceb912db'])expect(predictSaveWorldState(slot,{'wm0.ev':ev})).toMatchObject({state:null,reason:'source_mismatch'});
 });
 it('Save Field points require the actual selected Field archive, not an EN alias',()=>{
  const raw=new ArrayBuffer(34),v=new DataView(raw);v.setUint32(0,1,true);[[0,0,10],[8,0,18],[0,8,26]].forEach((p,k)=>p.forEach((n,j)=>v.setInt16(4+k*8+j*2,n,true)));for(let i=28;i<34;i+=2)v.setUint16(i,65535,true);const mesh=decodeWalkmesh(raw);
  for(const language of ['fr','de','es'] as const){const c=context(language);Object.assign(c,{nodes:[{id:177,name:'fixture',status:'available',saveId:177,scriptName:'fixture'}]});const index=new FieldIndex(parseFieldPack(c)),slot={status:'valid',module:1,location:177,fieldPosition:{x:1,y:1,triangle:0,direction:255}} as SaveSlot;
   expect(saveFieldPoint(slot,index,mesh,c.sources)).toMatchObject({status:'inside',derivedZ:13});
   const wrong={...c.sources};delete wrong[c.archive];wrong['flevel.lgp']=hash;expect(saveFieldPoint(slot,index,mesh,wrong).status).toBe('source_missing');
   expect(saveFieldPoint({...slot,fieldPosition:{...slot.fieldPosition!,triangle:65535}},index,mesh,c.sources).status).toBe('invalid_triangle');
  }
 });
 it('isolates a rejected v4 Field member with an empty Unknown visual record',()=>{
  const c=context('fr');Object.assign(c,{nodes:[{id:177,name:'fixture',status:'corrupt',saveId:null,scriptName:null}]});const fields=parseFieldPack(c);
  const read=(change:(scene:any)=>void=()=>{})=>{const scene={fieldId:177,cameras:[],background:{status:'unknown'},reason:'Field script section size'};change(scene);const json=new TextEncoder().encode(JSON.stringify({schema:'gaiagis-field-visual',version:2,generator_revision:'field-visual-4',sources:{'fflevel.lgp':hash,maplist},scenes:[scene]})),b=new Uint8Array(16+json.length);b.set(new TextEncoder().encode('GAIACAM\0'));new DataView(b.buffer).setUint32(8,2,true);new DataView(b.buffer).setUint32(12,json.length,true);b.set(json,16);return parseVisualHeader(b.buffer,b.length,fields);};
  expect(read().scenes.get(177)?.background.status).toBe('unknown');
  for(const change of [(s:any)=>s.cameras.push({}),(s:any)=>s.background.bounds=[0,0,1,1],(s:any)=>s.background.section4SHA256=hash,(s:any)=>delete s.reason])expect(()=>read(change)).toThrow();
 });
});

// Opt-in real private packs. No game data or source paths are fixtures in Git.
const packs=process.env.GAIA_LANGUAGE_WORKSPACES;
it.skipIf(!packs||!existsSync(packs))('reads all four actual language Field codecs and six scenes',async()=>{
 for(const language of ['en','fr','de','es'] as const){
  const root=resolve(packs!,'workspace-'+language),read=(name:string)=>new File([readFileSync(resolve(root,name))],name),contextFile=read('gaia-field-context.json');
  const fields=parseFieldPack(JSON.parse(await contextFile.text())),index=new FieldIndex(fields);validateFieldPoi(fields,parsePoi(JSON.parse(await read('gaia-poi.json').text())));
  const walk=await openWalkmeshPack(read('gaia-field-walkmesh.bin'),fields),visual=await openFieldVisual(read('gaia-field-visual.bin'),fields),interaction=await openFieldInteraction(read('gaia-field-interaction.bin'),fields),script=await openFieldScriptEvidence(read('gaia-field-script-evidence.bin'),fields,await fileHash(contextFile));
  for(const name of ['mds5_1','church','elm','ghotin_4','las0_5','bugin1c']){const node=[...index.nodes.values()].find(n=>n.name===name)!;expect(node.status).toBe('available');const mesh=await walk.decode(node.id);expect(mesh).toBeTruthy();expect(await visual.decode(node.id)).toBeTruthy();expect(await interaction.decode(node.id,mesh)).toBeTruthy();expect(await script.decode(node.id)).toBeTruthy();}
 }
},120_000);
