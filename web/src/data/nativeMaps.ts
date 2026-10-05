// SPDX-License-Identifier: GPL-3.0-only
import type {GaiaMesh} from './mesh';
export type MapId='WM0'|'WM2'|'WM3';
export type NativeMapId=Exclude<MapId,'WM0'>;
export interface NativeHeader {schema:string;version:number;mapId:NativeMapId;coordinate_space:string;global_mapping:null;axis_order:string[];height_unit:string;section_grid:number[];section_count:number;triangle_count:number;record_bytes:number;extent:number[];source_sha256:string;payload_sha256:string;terrain_names:Record<string,string>;region_names:Record<string,string>;}
export interface NativeMap {header:NativeHeader;sha256:string;records:DataView;sourceTriangleCount:number;attributes:GaiaMesh['attributes'];positions:Float32Array;}
export const RECORD_BYTES=72;
export function parseNativeMap(buffer:ArrayBuffer){
 if(buffer.byteLength<48||buffer.byteLength>32_000_000)throw Error('Native map size');
 const view=new DataView(buffer),n=view.getUint32(12,true);
 if(new TextDecoder().decode(new Uint8Array(buffer,0,8))!=='GAIAMAP\0'||view.getUint32(8,true)!==1||n>100_000||16+n>buffer.byteLength-32)throw Error('Native map header');
 const h=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,16,n))) as NativeHeader;
 for(const names of [h.terrain_names,h.region_names])if(!names||typeof names!=='object'||Array.isArray(names)||Object.entries(names).some(([id,name])=>!/^\d+$/.test(id)||Number(id)>31||typeof name!=='string'||name.length>160))throw Error('Native categorical names');
 const grid=h.mapId==='WM2'?[3,4]:h.mapId==='WM3'?[2,2]:null;
 if(!grid||h.schema!=='gaiagis-native-map'||h.version!==1||h.coordinate_space!==h.mapId+'Native'||h.global_mapping!==null||h.height_unit!=='raw_source_units'||JSON.stringify(h.axis_order)!==JSON.stringify(['native_x','native_z','raw_height'])||JSON.stringify(h.section_grid)!==JSON.stringify(grid)||h.section_count!==grid[0]*grid[1]||!Number.isInteger(h.triangle_count)||h.triangle_count<1||h.triangle_count>100_000||h.record_bytes!==72||buffer.byteLength!==16+n+h.triangle_count*72+32||! /^[a-f0-9]{64}$/.test(h.source_sha256)||! /^[a-f0-9]{64}$/.test(h.payload_sha256)||!Array.isArray(h.extent)||h.extent[0]!==grid[0]*32768||h.extent[1]!==grid[1]*32768)throw Error('Native map schema/layout');
 const records=new DataView(buffer,16+n,h.triangle_count*72),positions=new Float32Array(h.triangle_count*9),lineage=new Set<string>();
 const attributes=(t:number)=>{if(!Number.isInteger(t)||t<0||t>=h.triangle_count)throw Error('Native triangle index');const p=t*72;return {origin:0,map:Number(h.mapId[2]),section:records.getUint16(p+54,true),mesh:records.getUint16(p+56,true),triangle:records.getUint16(p+58,true),texture:records.getUint16(p+60,true),terrain:records.getUint8(p+62),region:records.getUint8(p+63),script:records.getUint8(p+64),chocobo:!!(records.getUint8(p+65)&1),capTriangle:null} as ReturnType<GaiaMesh['attributes']>;};
 for(let t=0;t<h.triangle_count;t++){const a=attributes(t),key=`${a.section}/${a.mesh}/${a.triangle}`;if(a.section!>=h.section_count||a.mesh!>=16||a.texture!>511||a.terrain!>31||a.region!>31||a.script!>7||records.getUint8(t*72+65)>3||lineage.has(key))throw Error('Native triangle attributes/lineage');lineage.add(key);for(let j=0;j<9;j++){const v=records.getInt32(t*72+j*4,true),axis=j%3;if((axis<2&&(v<0||v>h.extent[axis]))||(axis===2&&(v<-32768||v>32767)))throw Error('Native position bounds');positions[t*9+j]=v;}}
 return {header:h,records,positions,attributes,sourceTriangleCount:h.triangle_count};
}
const hex=(data:ArrayBuffer)=>Array.from(new Uint8Array(data),x=>x.toString(16).padStart(2,'0')).join('');
export async function decodeNativeMap(buffer:ArrayBuffer):Promise<NativeMap>{const parsed=parseNativeMap(buffer);const body=await crypto.subtle.digest('SHA-256',buffer.slice(0,-32));if(!new Uint8Array(body).every((v,i)=>v===new Uint8Array(buffer,buffer.byteLength-32)[i]))throw Error('Native checksum');const payload=await crypto.subtle.digest('SHA-256',new Uint8Array(buffer,parsed.records.byteOffset,parsed.records.byteLength));if(hex(payload)!==parsed.header.payload_sha256)throw Error('Native payload checksum');return {...parsed,sha256:hex(await crypto.subtle.digest('SHA-256',buffer))};}
export interface MapTransition {id:string;from_map:string;to_map:string;from_anchor_kind:string;from_native_position:number[]|null;from_source_lineage:{mapId:string;section_id:number;mesh_id:number;triangle_id:number}|null;to_native_position:number[]|null;transform_kind:string;evidence_class:string;runtime_availability:string;source_file:string;source_function?:string|number;instruction_offset?:number;condition_kind:string[];field_id?:number|null;field_name?:string|null;notes:string;}
export function parseTransitions(text:string,loaded:Partial<Record<MapId,string>>={}){
 if(text.length>8_000_000)throw Error('Transitions size');
 const data=JSON.parse(text);
 if(data.schema!=='gaiagis-map-transitions'||data.version!==1||!Array.isArray(data.transitions)||data.transitions.length>10000||!data.sources||typeof data.sources!=='object'||Array.isArray(data.sources)||Object.values(data.sources).some(hash=>typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash)))throw Error('Transitions schema');
 for(const [map,hash]of Object.entries(loaded))if(data.sources[map.toLowerCase()+'.map']!==hash)throw Error('Transition source mismatch');
 const ids=new Set();
 for(const r of data.transitions as MapTransition[]){
  if(!r||typeof r.id!=='string'||r.id.length>128||ids.has(r.id)||!['WM0','WM2','WM3','FIELD'].includes(r.from_map)||!['WM0','WM2','WM3','FIELD'].includes(r.to_map)||!['script_constant','unresolved','runtime_dependent','reference_cross_checked','source_exact','transition_pair_only'].includes(r.evidence_class)||typeof r.notes!=='string'||typeof r.source_file!=='string'||typeof r.transform_kind!=='string'||typeof r.from_anchor_kind!=='string'||r.runtime_availability!=='not_simulated'||!Array.isArray(r.condition_kind)||!r.condition_kind.every(x=>typeof x==='string'))throw Error('Transition record');
  for(const [map,p]of [[r.from_map,r.from_native_position],[r.to_map,r.to_native_position]] as const){
   if(p===null)continue;
   if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))throw Error('Transition anchor');
   const extent=map==='WM0'?[294912,229376]:map==='WM2'?[98304,131072]:map==='WM3'?[65536,65536]:null;
   if(extent&&(p[0]<0||p[0]>extent[0]||p[1]<0||p[1]>extent[1]||p[2]<-32768||p[2]>32767))throw Error('Transition anchor bounds');
  }
  if(r.from_source_lineage){const l=r.from_source_lineage,max=r.from_map==='WM0'?63:r.from_map==='WM2'?12:4;if(l.mapId!==r.from_map||!Number.isInteger(l.section_id)||l.section_id<0||l.section_id>=max||!Number.isInteger(l.mesh_id)||l.mesh_id<0||l.mesh_id>15||!Number.isInteger(l.triangle_id)||l.triangle_id<0||l.triangle_id>65535)throw Error('Transition lineage');}
  ids.add(r.id);
 }
 return data as {sources:Record<string,string>;transitions:MapTransition[]};
}
