// SPDX-License-Identifier: GPL-3.0-only
import type {GaiaMeta,TriangleAttributes} from './mesh';
export const encounterKinds=['normal','back_attack','side_attack','both_sides','chocobo'] as const;
export type EncounterKind=typeof encounterKinds[number];
export interface EncounterRecord {scene_id:number;weight:number;packed:number;encounter_type:EncounterKind;byte_offset:number;}
export interface EncounterSet {id:string;region_id:number;slot:number;byte_offset:number;active_raw:number;active:boolean;encounter_rate:number;padding_hex:string;records:Record<EncounterKind,EncounterRecord[]>;}
export interface EncounterDataset {
  schema:'gaiagis-encounters';version:1;reconstruction:'v1-geometric-gaia';
  lookup_profile:'classic-pc-reference';runtime_equivalence:'not-verified-steam2026';
  sources:Record<string,string>;source_record:{filename:string;size:number;toc_index:number;archive_data_offset:number};
  regions:{id:number;terrain_slots:number[];yuffie_threshold:number}[];
  terrain_aliases:{source:number;effective:number}[];encounter_sets:EncounterSet[];
  yuffie:{level_max:number;scene_id:number;raw_scene_id:number;byte_offset:number}[];
  chocobo_ratings:{scene_id:number;rating:number;valid:boolean;byte_offset:number}[];
}
// Independent format facts; no runtime code copied from references.
export const terrainSlots=[[0,9,0,17],[0,0,0,17],[0,9,1,17],[0,20,0,17],[0,9,8,17],[0,0,25,17],[0,9,19,17],[0,0,1,17],
  [0,0,1,17],[0,9,14,17],[0,9,25,17],[0,10,9,17],[0,9,25,17],[0,0,8,11],[0,0,8,0],[0,0,1,0]];
export const yuffieThresholds=[0,0,32,0,0,64,0,64,255,0,128,0,128,0,0,128];
const counts=[6,2,1,1,4];
const fail=():never=>{throw new Error('Invalid or incompatible Gaia encounters dataset.');};
const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:fail();
const integer=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
export function parseEncounters(input:unknown,meta?:GaiaMeta):EncounterDataset {
  const d=object(input),sources=object(d.sources),record=object(d.source_record);
  if(d.schema!=='gaiagis-encounters'||d.version!==1||d.reconstruction!=='v1-geometric-gaia'||d.lookup_profile!=='classic-pc-reference'||d.runtime_equivalence!=='not-verified-steam2026')fail();
  for(const key of ['wm0.map','world_us.lgp','enc_w.bin'])if(typeof sources[key]!=='string'||!/^[a-f0-9]{64}$/i.test(sources[key] as string))fail();
  if(meta){const source=(meta as GaiaMeta&{stage1?:{source_wm0_sha256?:string}}).stage1?.source_wm0_sha256;
    if(!source||source.toLowerCase()!==(sources['wm0.map'] as string).toLowerCase())throw new Error('Encounters were generated from a different or unverified WM0 source.');}
  if(record.filename!=='enc_w.bin'||record.size!==2208||!integer(record.toc_index,0,100000)||!integer(record.archive_data_offset,0,2**32-1))fail();
  if(!Array.isArray(d.regions)||d.regions.length!==16||!Array.isArray(d.encounter_sets)||d.encounter_sets.length!==64||!Array.isArray(d.terrain_aliases)||d.terrain_aliases.length!==2)fail();
  const aliases=d.terrain_aliases as unknown[];
  for(let i=0;i<2;i++){const a=object(aliases[i]);if(a.source!==[16,24][i]||a.effective!==[0,8][i])fail();}
  const regions=d.regions as unknown[],sets=d.encounter_sets as unknown[];
  for(let i=0;i<16;i++){const r=object(regions[i]);if(r.id!==i||JSON.stringify(r.terrain_slots)!==JSON.stringify(terrainSlots[i])||r.yuffie_threshold!==yuffieThresholds[i])fail();}
  for(let i=0;i<64;i++){
    const s=object(sets[i]),offset=160+i*32,groups=object(s.records);
    if(s.id!==`${Math.floor(i/4)}:${i%4}`||s.region_id!==Math.floor(i/4)||s.slot!==i%4||s.byte_offset!==offset||!integer(s.active_raw,0,255)||
      s.active!==!!((s.active_raw as number)&1)||!integer(s.encounter_rate,0,255)||typeof s.padding_hex!=='string'||!/^[a-f0-9]{4}$/.test(s.padding_hex))fail();
    let position=offset+2;
    for(let k=0;k<encounterKinds.length;k++){
      const kind=encounterKinds[k],array=groups[kind];if(!Array.isArray(array)||array.length!==counts[k])fail();
      for(const raw of array as unknown[]){const r=object(raw);
        if(!integer(r.scene_id,0,1023)||!integer(r.weight,0,63)||r.packed!==((r.weight as number)<<10|(r.scene_id as number))||r.encounter_type!==kind||r.byte_offset!==position)fail();position+=2;}
    }
  }
  if(!Array.isArray(d.yuffie)||d.yuffie.length!==8||!Array.isArray(d.chocobo_ratings)||d.chocobo_ratings.length!==32)fail();
  const yuffie=d.yuffie as unknown[],ratings=d.chocobo_ratings as unknown[];
  let previous=-1;
  for(let i=0;i<8;i++){const r=object(yuffie[i]);if(!integer(r.level_max,previous,65535)||!integer(r.raw_scene_id,0,65535)||r.scene_id!==((r.raw_scene_id as number)&1023)||r.byte_offset!==i*4)fail();previous=r.level_max as number;}
  for(let i=0;i<32;i++){const r=object(ratings[i]);if(!integer(r.scene_id,0,65535)||!integer(r.rating,0,65535)||r.valid!==((r.scene_id as number)<=1023)||r.byte_offset!==32+i*4)fail();}
  return d as unknown as EncounterDataset;
}
export function resolveEncounter(data:EncounterDataset,region:number,terrain:number){
  if(!Number.isInteger(region)||!Number.isInteger(terrain)||terrain<0||terrain>31)throw new Error('Invalid encounter region/terrain.');
  const effectiveRegion=Math.max(0,Math.min(15,region)),effectiveTerrain=terrain===16?0:terrain===24?8:terrain;
  const r=data.regions[effectiveRegion],index=r.terrain_slots.indexOf(effectiveTerrain),slot=Math.max(0,index);
  return {sourceRegion:region,effectiveRegion,sourceTerrain:terrain,effectiveTerrain,slot,fallback:index<0,
    set:data.encounter_sets[effectiveRegion*4+slot],yuffieThreshold:r.yuffie_threshold,yuffieTerrain:terrain===1||terrain===25};
}
export function yuffieScene(data:EncounterDataset,level:number,terrain:number){
  if(!Number.isInteger(level)||level<0||![1,25].includes(terrain))throw new Error('Cloud level and Forest/Jungle required.');
  const r=data.yuffie.find(r=>level<=r.level_max)??data.yuffie.at(-1)!;return r.scene_id+(terrain===25?1:0);
}
export function chocoboRating(data:EncounterDataset,scene:number){return data.chocobo_ratings.find(r=>r.valid&&r.scene_id===scene)?.rating??null;}
export type ColorLayer='terrain'|'region'|'encounter'|'encounter-rate'|'traversal';
export const encounterPalette={active:'#53c2a2',inactive:'#586474',script:'#b19a61',unavailable:'#76818b',tracks:'#ffdb64'};
export function encounterColor(data:EncounterDataset|null,a:TriangleAttributes,rate=false):string{
  if(a.origin||!data||a.region===null||a.terrain===null)return encounterPalette.unavailable;
  const {set}=resolveEncounter(data,a.region,a.terrain);
  if(!set.active)return encounterPalette.inactive;
  if(a.script!==0)return encounterPalette.script;
  if(!rate)return encounterPalette.active;
  // Raw parameter intensity, not a frequency or absolute probability.
  const t=set.encounter_rate/255;return `rgb(${Math.round(55+190*t)},${Math.round(205-115*t)},${Math.round(215-145*t)})`;
}
export async function readLocalEncounters(file:File,meta:GaiaMeta){
  if(file.size>1_000_000)throw new Error('Encounters file is too large.');return parseEncounters(JSON.parse(await file.text()),meta);
}
export async function loadOptionalEncounters(meta:GaiaMeta):Promise<EncounterDataset|null>{
  if(import.meta.env.VITE_GAIA_SOURCE_ONLY==='true')return null;
  const response=await fetch(`${import.meta.env.BASE_URL}data/gaia-encounters.json`);
  if(response.status===404)return null;
  if(!response.ok)throw new Error(`Encounter data request failed (${response.status}).`);
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Encounter data is not JSON.');
  const text=await response.text();if(text.length>1_000_000)throw new Error('Encounters file is too large.');return parseEncounters(JSON.parse(text),meta);
}
