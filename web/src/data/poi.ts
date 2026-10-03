// SPDX-License-Identifier: GPL-3.0-only
import type {GaiaMeta,GaiaMesh} from './mesh';
export const categories=['city','town','village','settlement','dungeon','landmark','facility','temple','cave','entrance','other'] as const;
export type Category=typeof categories[number];
export interface Entrance {
  id:string;location_id:string;game_x:number;game_north:number;game_height:number;
  longitude:number;latitude:number;height:number;world_map:number;section_id:number;mesh_id:number;triangle_id:number;
  field_id:number;field_name:string;entrance_table_id:number;scenario:number;region_id:number;
  source_kind:string;source_file:string;source_record:number;source_script:number;confidence:string;notes:string;
  height_source:string;heading:number|null;trigger_radius:number|null;availability:string|null;
  trigger_triangle_ids:number[];script_calls:{call_table_record:number;instruction_word_offset:number}[];
  field_x:number;field_y:number;field_triangle:number;field_direction:number;field_table_record:number;field_table_byte_offset:number;
}
export interface Location {
  id:string;name:string;display_name:string;category:Category;aliases:string[];field_names:string[];
  primary_entrance:string;entrance_ids:string[];longitude:number;latitude:number;height:number;navigation_kind:string;name_source:string;
  center:{longitude:number;latitude:number;source_kind:string}|null;
}
export interface PoiDataset {schema:'gaiagis-poi';version:1;reconstruction:'v1-geometric-gaia';locations:Location[];entrances:Entrance[];sources:Record<string,string>;}
const fail=()=>{throw new Error('Invalid or incompatible Gaia locations dataset.');};
const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:fail();
const text=(v:unknown,max=500)=>typeof v==='string'&&v.length>0&&v.length<=max;
const number=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const integer=(v:unknown,min:number,max:number)=>number(v,min,max)&&Number.isInteger(v);
const strings=(v:unknown)=>Array.isArray(v)&&v.length<=100&&v.every(s=>text(s));
function coordinates(v:Record<string,unknown>){return number(v.longitude,-180,180)&&number(v.latitude,-90,90)&&number(v.height,-100000,100000);}
export function parsePoi(input:unknown,meta?:GaiaMeta):PoiDataset {
  const d=object(input),m=object(d.mapping),s=object(d.sources);
  if(d.schema!=='gaiagis-poi'||d.version!==1||d.reconstruction!=='v1-geometric-gaia'||JSON.stringify(d.world_extent)!=='[294912,229376]'||
    m.method!=='inverse_mercator'||m.radius_m!==6371008.8||m.flip_latitude!==false||m.antimeridian_game_east!==0||m.vertical_scale_m_per_raw_unit!==1)fail();
  for(const key of ['wm0.map','wm0.ev','field.tbl','maplist'])if(typeof s[key]!=='string'||!/^[a-f0-9]{64}$/i.test(s[key] as string))fail();
  const source=(meta as GaiaMeta&{stage1?:{source_wm0_sha256?:string}})?.stage1?.source_wm0_sha256;
  if(source&&source.toLowerCase()!==(s['wm0.map'] as string).toLowerCase())throw new Error('Locations were generated from a different WM0 source.');
  if(!Array.isArray(d.locations)||!Array.isArray(d.entrances)||d.locations.length>2000||d.entrances.length>10000)fail();
  const entrances=new Map<string,Entrance>();
  for(const value of d.entrances as unknown[]){
    const e=object(value);
    if(!text(e.id,100)||!text(e.location_id,100)||entrances.has(e.id as string)||!coordinates(e)||
      !number(e.game_x,0,294912)||!number(e.game_north,0,229376)||!number(e.game_height,-32768,32767)||e.game_height!==e.height||
      e.world_map!==0||!integer(e.section_id,0,62)||!integer(e.mesh_id,0,15)||!integer(e.triangle_id,0,65534)||
      !integer(e.field_id,1,65535)||!text(e.field_name,32)||!integer(e.entrance_table_id,1,64)||!integer(e.scenario,0,1)||!integer(e.region_id,0,31)||
      e.source_kind!=='derived_from_entry_trigger'||e.source_file!=='wm0.map'||e.source_record!==e.triangle_id||!integer(e.source_script,0,4)||
      e.height_source!=='interpolated_from_surface'||e.confidence!=='verified_trigger_derived_position'||!text(e.notes)||
      e.heading!==null||e.trigger_radius!==null||e.availability!==null||
      !Array.isArray(e.trigger_triangle_ids)||!e.trigger_triangle_ids.length||e.trigger_triangle_ids.length>10000||!e.trigger_triangle_ids.every(t=>integer(t,0,65534))||!e.trigger_triangle_ids.includes(e.triangle_id)||
      !Array.isArray(e.script_calls)||!e.script_calls.length||e.script_calls.length>100||!e.script_calls.every(c=>{const p=object(c);return integer(p.call_table_record,1,255)&&integer(p.instruction_word_offset,1,13823);})||
      !integer(e.field_table_record,0,127)||e.field_table_record!==2*((e.entrance_table_id as number)-1)+(e.scenario as number)||e.field_table_byte_offset!==(e.field_table_record as number)*12||
      !integer(e.field_x,-32768,32767)||!integer(e.field_y,-32768,32767)||!integer(e.field_triangle,0,65535)||!integer(e.field_direction,0,255))fail();
    entrances.set(e.id as string,e as unknown as Entrance);
  }
  const ids=new Set<string>(),references=new Set<string>();
  for(const value of d.locations as unknown[]){
    const l=object(value);
    if(!text(l.id,100)||ids.has(l.id as string)||!text(l.name,100)||!text(l.display_name,100)||!categories.includes(l.category as Category)||!coordinates(l)||
      !strings(l.aliases)||!strings(l.field_names)||!strings(l.entrance_ids)||!(l.entrance_ids as string[]).length||!text(l.primary_entrance,100)||
      l.navigation_kind!=='primary_entrance'||!['manual_verified_field_identity','maplist_internal_name'].includes(l.name_source as string))fail();
    ids.add(l.id as string);
    const primary=entrances.get(l.primary_entrance as string);
    if(!primary||primary.location_id!==l.id||primary.longitude!==l.longitude||primary.latitude!==l.latitude||primary.height!==l.height||!(l.entrance_ids as string[]).includes(primary.id))fail();
    for(const id of l.entrance_ids as string[]){if(references.has(id)||entrances.get(id)?.location_id!==l.id)fail();references.add(id);}
    const fields=new Set((l.entrance_ids as string[]).map(id=>entrances.get(id)!.field_name));
    if((l.field_names as string[]).length!==fields.size||(l.field_names as string[]).some(name=>!fields.has(name)))fail();
    if(l.center!==null){const c=object(l.center);if(!number(c.longitude,-180,180)||!number(c.latitude,-90,90)||c.source_kind!=='derived_navigation_center')fail();}
  }
  if(references.size!==entrances.size)fail();
  return input as PoiDataset;
}
export async function readLocalPoi(file:File,meta:GaiaMeta){
  if(file.name!=='gaia-poi.json'||file.size>5_000_000)throw new Error('Choose a gaia-poi.json file smaller than 5 MB.');
  return parsePoi(JSON.parse(await file.text()),meta);
}
export function validatePoiMesh(data:PoiDataset,mesh:GaiaMesh){
  const source=new Map<string,number>();
  for(let t=0;t<mesh.triangleCount;t++){const a=mesh.attributes(t);if(!a.origin)source.set(`${a.section}/${a.mesh}/${a.triangle}`,t);}
  for(const e of data.entrances){
    for(const id of e.trigger_triangle_ids){
      const index=source.get(`${e.section_id}/${e.mesh_id}/${id}`);
      if(index===undefined||mesh.attributes(index).script!==e.source_script+3)throw new Error('Location trigger does not match the loaded V1 mesh.');
    }
    const index=source.get(`${e.section_id}/${e.mesh_id}/${e.triangle_id}`)!;
    const points=Array.from({length:3},(_,j)=>{const i=mesh.indices[index*3+j]*3;return [mesh.geographic[i],mesh.geographic[i+1],mesh.geographic[i+2]];});
    if(mesh.attributes(index).region!==e.region_id||Math.abs(e.longitude-points.reduce((a,p)=>a+p[0]/3,0))>1e-4||
      e.latitude<Math.min(...points.map(p=>p[1]))-1e-4||e.latitude>Math.max(...points.map(p=>p[1]))+1e-4||
      Math.abs(e.height-points.reduce((a,p)=>a+p[2]/3,0))>.002)throw new Error('Location position/region does not match its V1 source triangle.');
  }
}
export async function loadOptionalPoi(meta:GaiaMeta):Promise<PoiDataset|null>{
  if(import.meta.env.VITE_GAIA_SOURCE_ONLY==='true')return null;
  const response=await fetch(`${import.meta.env.BASE_URL}data/gaia-poi.json`);
  if(response.status===404||response.ok&&!response.headers.get('content-type')?.includes('application/json'))return null;
  if(!response.ok)throw new Error(`Locations could not load (HTTP ${response.status}).`);
  const text=await response.text();if(text.length>5_000_000)throw new Error('Locations dataset exceeds 5 MB.');
  return parsePoi(JSON.parse(text),meta);
}
export type LocationFilter='all'|'settlements'|'dungeons'|'landmarks';
export function filterLocation(l:Location,filter:LocationFilter){return filter==='all'||(filter==='settlements'?['city','town','village','settlement'].includes(l.category):filter==='dungeons'?['dungeon','cave','temple'].includes(l.category):['landmark','facility','entrance','other'].includes(l.category));}
export const normalizeSearch=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim();
export function searchLocations(locations:Location[],query:string,filter:LocationFilter='all') {
  const q=normalizeSearch(query);
  return locations.filter(l=>filterLocation(l,filter)).map(l=>{
    const names=[l.display_name,l.name].map(normalizeSearch),aliases=l.aliases.map(normalizeSearch),fields=l.field_names.map(normalizeSearch);
    const rank=!q?0:names.some(n=>n===q)?0:names.some(n=>n.startsWith(q))?1:names.some(n=>n.includes(q))?2:aliases.some(n=>n.includes(q))?3:fields.some(n=>n.includes(q))?4:Infinity;
    return {location:l,rank};
  }).filter(r=>Number.isFinite(r.rank)).sort((a,b)=>a.rank-b.rank||a.location.display_name.localeCompare(b.location.display_name)).map(r=>r.location);
}
