// SPDX-License-Identifier: GPL-3.0-only
import type {Surface} from './explorer';
import type {SaveBinding,SaveSlot,SaveFieldPosition} from './save';
import {currentSaveField,localPoint} from './fieldContext';
import type {FieldIndex,FieldNode,FieldWalkmesh} from './fieldContext';
import {barycentric} from '../explorer/walker';
import {archiveKey} from './sourceRoles';
/** Exact source triangle containment. Never nearest-centroid snapping. */
export function saveSurfacePoint(surface:Surface,binding:SaveBinding){
 if(surface.header.mapId!=='WM0'||surface.header.extent[0]!==294912||surface.header.extent[1]!==229376)return null;
 const {x,z}=binding.raw;
 for(const triangle of surface.candidates(x,z)){const points=surface.points(triangle),b=barycentric(points,x,z);if(b&&b.every(v=>v>=-1e-6&&v<=1+1e-6))return {triangle,b};}
 return null;
}

export type SaveFieldPointStatus='inside'|'boundary'|'outside'|'invalid_triangle'|'degenerate'|'invalid_slot'|'non_field'|'context_unavailable'|'field_unavailable'|'position_missing'|'source_missing'|'source_mismatch'|'mesh_unavailable';
export interface SaveFieldPointResult {field:FieldNode|null;raw:SaveFieldPosition|null;status:SaveFieldPointStatus;derivedZ:number|null;}
/** A selected save's exact Triangle and XY, on the current verified local mesh.
 * The caller decodes the identified scene through openWalkmeshPack. No nearest
 * triangle search or tolerance adjustment is allowed; Z belongs to this mesh.
 */
export function saveFieldPoint(slot:SaveSlot|null,index:FieldIndex|null,mesh:FieldWalkmesh|null,sources:Record<string,string>|null):SaveFieldPointResult {
 const result:SaveFieldPointResult={field:null,raw:slot?.status==='valid'&&slot.module===1?slot.fieldPosition:null,status:'invalid_slot',derivedZ:null};
 const reject=(status:SaveFieldPointStatus)=>({...result,status});
 if(!slot||slot.status!=='valid')return result;
 if(slot.module!==1)return reject('non_field');
 if(!index)return reject('context_unavailable');
 result.field=currentSaveField(slot,index);if(!result.field)return reject('field_unavailable');
 if(!result.raw)return reject('position_missing');
 if(!mesh)return reject('mesh_unavailable');
 const keys=[index.pack.archive,'maplist'];
 if(!sources||keys.some(k=>!sources[k]||!index.pack.sources[k]))return reject('source_missing');
 try{if(archiveKey(sources,'field')!==index.pack.archive)return reject('source_mismatch');}catch{return reject('source_mismatch');}
 if(keys.some(k=>!/^[a-f0-9]{64}$/.test(sources[k])||sources[k]!==index.pack.sources[k]))return reject('source_mismatch');
 const point=localPoint(mesh,result.raw.triangle,[result.raw.x,result.raw.y]);
 return {...result,status:point.status as SaveFieldPointStatus,derivedZ:point.derivedZ};
}

export const SAVE_WORLD_STATE_EV_SHA256='a020dace94f21b73094c204c54b01e13b3688002f65ffd9b1edf8ada5e372a64';
export const SAVE_WORLD_STATE_EV_SOURCES=Object.freeze({
 en:SAVE_WORLD_STATE_EV_SHA256,
 fr:'7664bf39da3f7f46474bcce29aa39f9ffd044e88b587e1c251a4acd23bd506bd',
 de:'c11d93aff555088368f432ed0c0f08d6fb0b5d0d40123d5681f83c3d0083be7f',
 es:'b92798f1b5fb9adbfd495a23d44655822e256023251f267ca43fff14ceb912db',
});
export interface SaveWorldStatePrediction {state:0|1|2|3|4|null;groups:number[];reason:'invalid_slot'|'source_missing'|'source_mismatch'|null;sourceHash:string|null;}
/** Loaded Context/Events/POI must agree, even if both EVs are reviewed. */
export function saveWorldStateSources(hashes:(string|undefined)[]):Record<string,string>|null {
 let ev:string|undefined;
 for(const hash of hashes){if(!hash)continue;if(ev&&ev.toLowerCase()!==hash.toLowerCase())return {'wm0.ev':'conflicting-source-identities'};ev=hash;}
 return ev?{'wm0.ev':ev}:null;
}
/** Static initialization only, pinned to four independently reviewed full EVs.
 * Neither the save container nor this prediction proves actual runtime state.
 */
export function predictSaveWorldState(slot:SaveSlot|null,sources:Record<string,string>|null):SaveWorldStatePrediction {
 const sourceHash=sources?.['wm0.ev']??null;
 const unknown=(reason:SaveWorldStatePrediction['reason']):SaveWorldStatePrediction=>({state:null,groups:[],reason,sourceHash});
 if(!slot||slot.status!=='valid'||!slot.worldStateInputs)return unknown('invalid_slot');
 if(!sourceHash)return unknown('source_missing');
 if(!Object.values(SAVE_WORLD_STATE_EV_SOURCES).some(hash=>hash===sourceHash))return unknown('source_mismatch');
 const {progressSigned:p,c1f0,f2b0,f2a4}=slot.worldStateInputs;
 const state=p<638?0:p<1000?1:p<1197?2:p>=1199&&c1f0&&f2b0&&f2a4?4:3;
 return {state,groups:Array.from({length:state},(_,i)=>i+1),reason:null,sourceHash};
}
