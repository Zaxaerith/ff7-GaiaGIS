// SPDX-License-Identifier: GPL-3.0-only
import type {GaiaMeta,GaiaMesh} from './mesh';
import type {Location} from './poi';
export const eventTypes=['dynamic_entrance','script_trigger','scripted_battle','world_object','vehicle_event','map_transition','special_event','unresolved_script_event'] as const;
export type EventType=typeof eventTypes[number];
export type EventFilter='all'|'entrances'|'battles'|'objects'|'vehicle'|'other';
export interface WorldEvent {
  id:string;event_type:EventType;name:string;display_name:string;longitude:number;latitude:number;height:number|null;
  game_x:number;game_north:number;game_height:number|null;height_source:string;anchor_kind:string;world_map:0;
  section_id:number;mesh_id:number;triangle_id:number|null;trigger_triangle_ids:number[];anchor_function:number;
  function_id:number;call_table_record:number;instruction_offset:number;basic_block:number;opcode:number|null;opcode_name:string;
  raw_arguments:(number|null)[];model_id:number|null;entity_id:number|null;field_id:number|null;field_name:string|null;
  entrance_table_id:number|null;scenario:number|null;battle_id:number|null;location_id:string|null;
  condition_kind:string[];runtime_availability:'not_simulated';source_file:'wm0.ev';source_record:number;confidence:string;notes:string;
}
export interface EventsDataset {schema:'gaiagis-events';version:1;reconstruction:'v1-geometric-gaia';sources:Record<string,string>;events:WorldEvent[];unresolved:Record<string,unknown>[];extraction:Record<string,unknown>;}
const fail=():never=>{throw new Error('Invalid or incompatible Gaia events dataset.');};
const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:fail();
const num=(v:unknown,lo:number,hi:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
const int=(v:unknown,lo:number,hi:number)=>num(v,lo,hi)&&Number.isInteger(v);
const text=(v:unknown,max=500)=>typeof v==='string'&&v.length>0&&v.length<=max;
const nullable=(v:unknown,lo:number,hi:number)=>v===null||int(v,lo,hi);
export function parseEvents(input:unknown,meta?:GaiaMeta):EventsDataset{
  const d=object(input),m=object(d.mapping),s=object(d.sources);
  if(d.schema!=='gaiagis-events'||d.version!==1||d.reconstruction!=='v1-geometric-gaia'||JSON.stringify(d.world_extent)!=='[294912,229376]'||m.method!=='inverse_mercator'||m.radius_m!==6371008.8||m.flip_latitude!==false||m.antimeridian_game_east!==0||m.vertical_scale_m_per_raw_unit!==1)fail();
  for(const key of ['wm0.map','world_us.lgp','wm0.ev','field.tbl','maplist'])if(typeof s[key]!=='string'||!/^[a-f0-9]{64}$/i.test(s[key] as string))fail();
  const source=(meta as GaiaMeta&{stage1?:{source_wm0_sha256?:string}})?.stage1?.source_wm0_sha256;
  if(source&&source.toLowerCase()!==(s['wm0.map'] as string).toLowerCase())throw new Error('Events were generated from a different WM0 source.');
  if(!Array.isArray(d.events)||d.events.length>5000||!Array.isArray(d.unresolved)||d.unresolved.length>10000)fail();object(d.extraction);
  const ids=new Set<string>();
  for(const value of d.events as unknown[]){const e=object(value);
    if(!text(e.id,100)||ids.has(e.id as string)||!eventTypes.includes(e.event_type as EventType)||!text(e.name,160)||!text(e.display_name,160)||!num(e.longitude,-180,180)||!num(e.latitude,-90,90)||!num(e.game_x,0,294911)||!num(e.game_north,0,229375)||!(e.height===null||num(e.height,-32768,32767))||e.height!==e.game_height||e.height_source!==(e.height===null?'unknown':'interpolated_from_surface')||
      !['derived_trigger_centroid','derived_terrain_gate_centroid','script_model_position'].includes(e.anchor_kind as string)||e.world_map!==0||!int(e.section_id,0,62)||!int(e.mesh_id,0,15)||!nullable(e.triangle_id,0,65534)||!int(e.anchor_function,0,49151)||!int(e.function_id,0,49151)||!int(e.call_table_record,1,255)||!int(e.instruction_offset,1,13823)||!int(e.basic_block,1,13823)||!nullable(e.opcode,0,0x355)||!text(e.opcode_name,80)||
      !Array.isArray(e.raw_arguments)||e.raw_arguments.length>8||!e.raw_arguments.every(a=>a===null||int(a,-2147483648,2147483647))||!nullable(e.model_id,0,63)||e.entity_id!==null||!nullable(e.field_id,0,65535)||!(e.field_name===null||text(e.field_name,32))||!nullable(e.entrance_table_id,1,64)||!nullable(e.scenario,0,1)||!nullable(e.battle_id,0,65535)||!(e.location_id===null||text(e.location_id,100))||
      !Array.isArray(e.condition_kind)||e.condition_kind.length>20||!e.condition_kind.every(c=>text(c,80))||e.runtime_availability!=='not_simulated'||e.source_file!=='wm0.ev'||e.source_record!==e.call_table_record||!['classic_pc_reference_derived','source_constant_placement','source_trigger_derived'].includes(e.confidence as string)||!text(e.notes)||!Array.isArray(e.trigger_triangle_ids)||e.trigger_triangle_ids.length>10000||!e.trigger_triangle_ids.every(t=>int(t,0,65534)))fail();
    if(e.anchor_kind==='script_model_position'){if(e.event_type!=='world_object'||e.model_id===null||(e.trigger_triangle_ids as number[]).length)fail();}
    else if(e.triangle_id===null||!(e.trigger_triangle_ids as number[]).includes(e.triangle_id as number))fail();
    if(e.event_type==='dynamic_entrance'&&(e.field_id===null||e.field_name===null||e.entrance_table_id===null||e.scenario===null))fail();
    if(e.event_type==='scripted_battle'&&e.opcode!==0x317)fail();ids.add(e.id as string);
  }
  for(const v of d.unresolved as unknown[]){const u=object(v);if(!text(u.reason,160))fail();}return input as EventsDataset;
}
export function validateEventsMesh(data:EventsDataset,mesh:GaiaMesh){
  const sources=new Map<string,number>();for(let t=0;t<mesh.sourceTriangleCount;t++){const a=mesh.attributes(t);sources.set(`${a.section}/${a.mesh}/${a.triangle}`,t);}
  for(const e of data.events){
    const col=Math.floor(e.game_x/8192),row=Math.floor(e.game_north/8192);
    if(e.section_id!==Math.floor(col/4)+9*Math.floor(row/4)||e.mesh_id!==col%4+4*(row%4))throw new Error('Event raw coordinate does not match its WM0 cell.');
    for(const id of e.trigger_triangle_ids){const index=sources.get(`${e.section_id}/${e.mesh_id}/${id}`);if(index===undefined)throw new Error('Event trigger is missing from the V1 mesh.');const a=mesh.attributes(index);if(e.anchor_kind==='derived_trigger_centroid'&&a.script!==(e.anchor_function&15)+3||e.anchor_kind==='derived_terrain_gate_centroid'&&a.terrain!==27)throw new Error('Event trigger does not match its source rule.');}
    if(e.triangle_id===null){if(e.height!==null)throw new Error('Event height has no source surface.');continue;}
    const index=sources.get(`${e.section_id}/${e.mesh_id}/${e.triangle_id}`);if(index===undefined)throw new Error('Event source triangle is missing.');
    const p=[0,1,2].map(j=>{const i=mesh.indices[index*3+j]*3;return [mesh.geographic[i],mesh.geographic[i+1],mesh.geographic[i+2]];});
    if(e.height===null||e.height<Math.min(...p.map(v=>v[2]))-.002||e.height>Math.max(...p.map(v=>v[2]))+.002)throw new Error('Event height does not match its source surface.');
    if(e.longitude<Math.min(...p.map(v=>v[0]))-1e-4||e.longitude>Math.max(...p.map(v=>v[0]))+1e-4)throw new Error('Event longitude does not match its source triangle.');
    if(e.anchor_kind!=='script_model_position'&&(Math.abs(e.longitude-p.reduce((s,v)=>s+v[0]/3,0))>1e-4||e.height===null||Math.abs(e.height-p.reduce((s,v)=>s+v[2]/3,0))>.002))throw new Error('Event centroid does not match its source triangle.');
    if(e.latitude<Math.min(...p.map(v=>v[1]))-1e-4||e.latitude>Math.max(...p.map(v=>v[1]))+1e-4)throw new Error('Event latitude does not match its source triangle.');
  }
}
export function filterEvent(e:WorldEvent,filter:EventFilter){return filter==='all'||(filter==='entrances'?e.event_type==='dynamic_entrance':filter==='battles'?e.event_type==='scripted_battle':filter==='objects'?e.event_type==='world_object':filter==='vehicle'?e.event_type==='vehicle_event':!['dynamic_entrance','scripted_battle','world_object','vehicle_event'].includes(e.event_type));}
// Shared v1.1 marker projection/morph/culling. Null height uses display-only 0.
export function eventLocation(e:WorldEvent):Location & {eventType:string}{return {eventType:e.event_type,id:e.id,name:e.name,display_name:e.display_name,category:'landmark',longitude:e.longitude,latitude:e.latitude,height:e.height??0,aliases:[],field_names:[],primary_entrance:'',entrance_ids:[],navigation_kind:'event_anchor',name_source:e.confidence,center:null};}
export async function readLocalEvents(file:File,meta:GaiaMeta){if(file.name!=='gaia-events.json'||file.size>5_000_000)throw new Error('Choose a gaia-events.json file smaller than 5 MB.');return parseEvents(JSON.parse(await file.text()),meta);}
export async function loadOptionalEvents(meta:GaiaMeta):Promise<EventsDataset|null>{
  if(import.meta.env.VITE_GAIA_SOURCE_ONLY==='true')return null;
  const r=await fetch(`${import.meta.env.BASE_URL}data/gaia-events.json`);if(r.status===404||r.ok&&!r.headers.get('content-type')?.includes('application/json'))return null;
  if(!r.ok)throw new Error(`Events could not load (HTTP ${r.status}).`);
  const text=await r.text();if(text.length>5_000_000)throw new Error('Events dataset exceeds 5 MB.');return parseEvents(JSON.parse(text),meta);
}
