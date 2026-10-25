// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import type {SaveSlot,SaveWorldStateInputs} from '../src/data/save';
import {FieldIndex,decodeWalkmesh,parseFieldPack,localPoint} from '../src/data/fieldContext';
import type {FieldPack} from '../src/data/fieldContext';
import {saveFieldPoint,predictSaveWorldState,saveWorldStateSources,SAVE_WORLD_STATE_EV_SHA256,SAVE_WORLD_STATE_EV_SOURCES} from '../src/data/saveSpatial';

// Generated integer geometry and fabricated scalar slots, never private saves.
const sources={'flevel.lgp':'a'.repeat(64),maplist:'d6ac24b79403a77feeb338450b7cb2169cdbcfa5d071a6cee4884e93b700bc29','wm0.ev':SAVE_WORLD_STATE_EV_SHA256,'wm0.map':'b'.repeat(64),'field.tbl':'c'.repeat(64)};
function index(){return new FieldIndex(parseFieldPack({schema:'gaiagis-field-context',version:1,coordinateSpace:'FieldLocalIdentity',archive:'flevel.lgp',sources:{...sources},nodes:[{id:748,name:'las0_5',status:'available',saveId:748},{id:749,name:'unbound',status:'available',saveId:null},{id:750,name:'missing',status:'missing',saveId:null}],edges:[],exits:[],unresolved:[],bindings:[],scriptTransitions:'unverified'} satisfies FieldPack));}
function slot(p=0,bits=0):SaveSlot{return {status:'valid',module:1,location:748,fieldPosition:{x:1,y:1,triangle:0,direction:255},worldStateInputs:{progressSigned:p,c1f0:!!(bits&4),f2b0:!!(bits&2),f2a4:!!(bits&1)},progress:p&65535} as SaveSlot;}
function mesh(triangles:number[][][]=[[[0,0,10],[8,0,18],[0,8,26]]]){
 const b=new ArrayBuffer(4+triangles.length*30),v=new DataView(b);v.setUint32(0,triangles.length,true);
 triangles.forEach((tri,i)=>tri.forEach((p,k)=>{for(let n=0;n<3;n++)v.setInt16(4+i*24+k*8+n*2,p[n],true);}));
 for(let i=4+triangles.length*24;i<b.byteLength;i+=2)v.setUint16(i,65535,true);
 return decodeWalkmesh(b);
}
describe('save Field position source composition',()=>{
 it('uses the exact save identity and localPoint; derived Z belongs to the mesh',()=>{const s=slot(),m=mesh(),result=saveFieldPoint(s,index(),m,sources);expect(result).toEqual({field:{id:748,name:'las0_5',status:'available',saveId:748},raw:{x:1,y:1,triangle:0,direction:255},status:'inside',derivedZ:13});expect(localPoint(m,0,[1,1])).toEqual({status:result.status,derivedZ:result.derivedZ});});
 it('preserves exact boundary without a containment tolerance',()=>{const s=slot();s.fieldPosition!.x=4;s.fieldPosition!.y=4;expect(saveFieldPoint(s,index(),mesh(),sources)).toMatchObject({status:'boundary',derivedZ:22});s.fieldPosition!.y=5;expect(saveFieldPoint(s,index(),mesh(),sources)).toMatchObject({status:'outside',derivedZ:null});});
 it('unknown IDs, absent saveId and unavailable fields never establish an identity',()=>{for(const location of [749,750,65535])expect(saveFieldPoint({...slot(),location},index(),mesh(),sources)).toMatchObject({field:null,status:'field_unavailable',derivedZ:null});});
 it('distinguishes slot, module, Context, missing raw and missing mesh failures',()=>{
  expect(saveFieldPoint(null,index(),mesh(),sources).status).toBe('invalid_slot');
  for(const status of ['empty','checksum','invalid'] as const)expect(saveFieldPoint({...slot(),status},index(),mesh(),sources)).toMatchObject({raw:null,status:'invalid_slot',derivedZ:null});
  expect(saveFieldPoint({...slot(),module:3},index(),mesh(),sources)).toMatchObject({raw:null,status:'non_field'});
  expect(saveFieldPoint(slot(),null,mesh(),sources).status).toBe('context_unavailable');
  expect(saveFieldPoint({...slot(),fieldPosition:null},index(),mesh(),sources).status).toBe('position_missing');
  expect(saveFieldPoint(slot(),index(),null,null)).toMatchObject({field:{id:748},raw:{triangle:0},status:'mesh_unavailable',derivedZ:null});
 });
 it('requires both exact flevel and maplist source hashes',()=>{
  expect(saveFieldPoint(slot(),index(),mesh(),null).status).toBe('source_missing');
  for(const key of ['flevel.lgp','maplist']){const missing={...sources};delete missing[key as keyof typeof missing];expect(saveFieldPoint(slot(),index(),mesh(),missing).status).toBe('source_missing');expect(saveFieldPoint(slot(),index(),mesh(),{...sources,[key]:'d'.repeat(64)}).status).toBe('source_mismatch');expect(saveFieldPoint(slot(),index(),mesh(),{...sources,[key]:'bad'}).status).toBe('source_mismatch');}
 });
 it('retains illegal Triangle and degenerate results without another face search',()=>{
  for(const triangle of [-1,1,65535])expect(saveFieldPoint({...slot(),fieldPosition:{...slot().fieldPosition!,triangle}},index(),mesh(),sources)).toMatchObject({raw:{triangle},status:'invalid_triangle',derivedZ:null});
  expect(saveFieldPoint(slot(),index(),mesh([[[0,0,0],[1,1,1],[2,2,2]]]),sources)).toMatchObject({status:'degenerate',derivedZ:null});
 });
 it('preserves original Triangle 206 outside even when Triangle 191 contains XY',()=>{
  const tris=Array.from({length:207},()=>[[0,0,0],[0,0,0],[0,0,0]]);tris[191]=[[0,0,0],[8,0,0],[0,8,0]];tris[206]=[[3,3,0],[8,3,0],[3,8,0]];
  const m=mesh(tris),s=slot();s.fieldPosition!.triangle=206;const before=JSON.stringify(s);
  expect(localPoint(m,191,[1,1]).status).toBe('inside');expect(saveFieldPoint(s,index(),m,sources)).toMatchObject({raw:{triangle:206,x:1,y:1},status:'outside',derivedZ:null});expect(JSON.stringify(s)).toBe(before);
 });
});

describe('source-bound static WM0 initialization',()=>{
 for(const [language,hash] of Object.entries(SAVE_WORLD_STATE_EV_SOURCES))it(`${language}: complete EV pin, signed thresholds and all flag combinations`,()=>{
  for(const [p,expected] of [[-32768,0],[-1,0],[637,0],[638,1],[999,1],[1000,2],[1196,2],[1197,3],[1198,3],[1199,3],[1620,3],[32767,3]])for(let bits=0;bits<8;bits++)expect(predictSaveWorldState(slot(p,bits),{'wm0.ev':hash})).toMatchObject({state:p>=1199&&bits===7?4:expected,sourceHash:hash,reason:null});
  // A changed complete hash remains Unknown even if its initializer is equal.
  const changed=hash.slice(0,-1)+(hash.endsWith('0')?'1':'0');expect(predictSaveWorldState(slot(1620,7),{'wm0.ev':changed}).state).toBeNull();
 });
 it('conflicting loaded EV sources remain Unknown, including two reviewed EVs',()=>{
  expect(saveWorldStateSources([undefined])).toBeNull();
  for(const hash of Object.values(SAVE_WORLD_STATE_EV_SOURCES)){
   expect(predictSaveWorldState(slot(1620,7),saveWorldStateSources([hash,undefined,hash])).state).toBe(4);
   for(const other of Object.values(SAVE_WORLD_STATE_EV_SOURCES))if(hash!==other)expect(predictSaveWorldState(slot(1620,7),saveWorldStateSources([hash,other]))).toMatchObject({state:null,reason:'source_mismatch'});
  }
 });
 for(const [p,expected] of [[-32768,0],[-1,0],[0,0],[637,0],[638,1],[639,1],[999,1],[1000,2],[1001,2],[1196,2],[1197,3],[1198,3],[1199,3],[1200,3],[32767,3]])it(`threshold P=${p}, all 8 flag combinations`,()=>{
  for(let bits=0;bits<8;bits++){const state=p>=1199&&bits===7?4:expected,r=predictSaveWorldState(slot(p,bits),sources);expect(r).toEqual({state,groups:Array.from({length:state},(_,i)=>i+1),reason:null,sourceHash:SAVE_WORLD_STATE_EV_SHA256});}
 });
 it('P=1620 depends on all three flags; UInt16 progress never drives the script',()=>{
  expect(predictSaveWorldState(slot(1620,0),sources).state).toBe(3);expect(predictSaveWorldState(slot(1620,7),sources).state).toBe(4);
  for(const p of [-32768,-1]){const s=slot(p,7);expect(s.progress).toBeGreaterThan(32767);expect(predictSaveWorldState(s,sources).state).toBe(0);}
 });
 it('only the exact reviewed member fingerprint authorizes prediction',()=>{
  const missingSources:(Record<string,string>|null)[]=[null,{}, {'world_us.lgp':SAVE_WORLD_STATE_EV_SHA256}];
  for(const source of missingSources)expect(predictSaveWorldState(slot(1620,7),source)).toMatchObject({state:null,groups:[],reason:'source_missing',sourceHash:null});
  for(const hash of ['a'.repeat(64),SAVE_WORLD_STATE_EV_SHA256.toUpperCase(),'wm0.ev'])expect(predictSaveWorldState(slot(1620,7),{'wm0.ev':hash})).toEqual({state:null,groups:[],reason:'source_mismatch',sourceHash:hash});
 });
 it('invalid slots and absent input summaries never generate a state',()=>{
  for(const s of [null,...(['empty','checksum','invalid'] as const).map(status=>({...slot(),status})),{...slot(),worldStateInputs:null}])expect(predictSaveWorldState(s,sources)).toMatchObject({state:null,groups:[],reason:'invalid_slot'});
 });
 it('retains only reviewed scalar input fields',()=>{const inputs=slot(1620,7).worldStateInputs!;expect(Object.keys(inputs).sort()).toEqual(['c1f0','f2a4','f2b0','progressSigned'] satisfies (keyof SaveWorldStateInputs)[]);});
});
