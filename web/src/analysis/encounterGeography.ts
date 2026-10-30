// SPDX-License-Identifier: GPL-3.0-only
import {encounterKinds,resolveEncounter} from '../data/encounters';
import type {EncounterDataset,EncounterKind,EncounterRecord,EncounterResource} from '../data/encounters';
import type {GameplayIndex} from '../data/gameplay';
import {assertSourceAgreement} from '../data/sourceRoles';
import type {WM0Source} from './wm0Source';

export interface EncounterReference {setId:string;kind:EncounterKind;record:EncounterRecord;}
export type RelationStatus='available'|'gameplay_missing'|'source_mismatch'|'invalid_links';
export interface EncounterRelations {status:RelationStatus;records:EncounterReference[];formations:Map<number,EncounterReference[]>;enemies:Map<string,Set<number>>;index?:GameplayIndex;reason?:string;}
export const referenceKey=(r:EncounterReference)=>`${r.setId}/${r.record.byte_offset}`;
export function positiveEncounterReferences(data:EncounterDataset):EncounterReference[]{return data.encounter_sets.flatMap(s=>encounterKinds.flatMap(kind=>s.records[kind].filter(record=>record.weight>0).map(record=>({setId:s.id,kind,record}))));}

/** Cross-asset bijection: never trust a Gameplay link merely because its Battle ID exists. */
export function validateEncounterRelations(resource:EncounterResource,index:GameplayIndex|null):EncounterRelations{
 const records=positiveEncounterReferences(resource.data),empty=(status:RelationStatus,reason?:string):EncounterRelations=>({status,records,formations:new Map(),enemies:new Map(),reason});
 if(!index)return empty('gameplay_missing');
 try{
  assertSourceAgreement(resource.data.sources,index.pack.sources);
  // Gameplay v1 stores enc_w + its World archive, but need not repeat WM0.
  // Its exact Encounter asset digest pins that file's WM0 identity; the Source
  // owner independently checks it against current geometry before querying.
  for(const [key,value]of Object.entries(resource.data.sources))if(key!=='wm0.map'&&index.pack.sources[key]?.toLowerCase()!==value.toLowerCase())throw Error('Encounter member source mismatch');
  const assets=index.pack.links.assets as Record<string,{sha256?:string;status?:string}>|undefined,asset=assets?.['gaia-encounters.json'];
  if(!/^[a-f0-9]{64}$/.test(resource.sha256)||asset?.sha256!==resource.sha256||asset.status!=='matched')throw Error('Encounter asset fingerprint mismatch');
 }catch(e){return empty('source_mismatch',String(e));}
 try{
  const expected=new Map(records.map(r=>[referenceKey(r),r])),seen=new Set<string>(),formations=new Map<number,EncounterReference[]>(),enemies=new Map<string,Set<number>>();
  if(expected.size!==records.length)throw Error('Duplicate Encounter source record');
  for(const link of index.pack.links.encounters){
   const key=`${link.setId}/${link.byteOffset}`,r=expected.get(key);
   if(!r||seen.has(key)||link.sourceKind!=='world_encounter'||link.encounterType!==r.kind||link.weight!==r.record.weight||link.battleId!==r.record.scene_id||link.formationId!==link.battleId||link.status!=='matched')throw Error('Missing, duplicate or conflicting Encounter link');
   seen.add(key);const f=index.formations.get(r.record.scene_id);
   if(!f||f.id!==f.sceneId*4+f.slot||f.battleId!==f.id||f.status!=='parsed'||!f.enemyIds.length)throw Error('Unresolved Formation identity');
   const rows=formations.get(f.id)??[];rows.push(r);formations.set(f.id,rows);
   for(const id of new Set(f.enemyIds)){const key=`${f.sceneId}/${id}`;if(!index.enemies.has(key))throw Error('Unresolved composite Enemy identity');const ids=enemies.get(key)??new Set<number>();ids.add(f.id);enemies.set(key,ids);}
  }
  if(seen.size!==expected.size)throw Error('Incomplete positive Encounter links');
  return {status:'available',records,formations,enemies,index};
 }catch(e){return empty('invalid_links',String(e));}
}

export type GeographyTarget={kind:'all'}|{kind:'set';id:string}|{kind:'formation';id:number}|{kind:'enemy';sceneId:number;enemyId:number};
export type GeographyRange='lookup'|'candidate';
export type GeographyFamily='ordinary'|'chocobo';
export interface GeographyCount {count:number;area:number;}
export interface GeographyResult {
 status:'ok'|'no_records'|'no_coverage'|'unknown_identity'|RelationStatus;
 faces:number[];mask:Uint8Array;records:EncounterReference[];
 total:GeographyCount;regions:Map<number,GeographyCount>;terrains:Map<number,GeographyCount>;sets:Map<string,GeographyCount>;
 zeroXZ:number;duplicateMembers:number;clamped:number;aliased:number;fallback:number;
}
const add=<K>(map:Map<K,GeographyCount>,key:K,area:number)=>{const row=map.get(key)??{count:0,area:0};row.count++;row.area+=area;map.set(key,row);};

/** One compact lookup index over the existing BASE owner; no display copies or geometry duplication. */
export function createEncounterGeography(source:WM0Source,data:EncounterDataset){
 if(source.sourceSHA.toLowerCase()!==data.sources['wm0.map']?.toLowerCase())throw Error('Encounter WM0 source mismatch');
 const began=performance.now(),setIndex=new Map(data.encounter_sets.map((s,i)=>[s.id,i])),faceSets=new Uint8Array(source.count),flags=new Uint8Array(source.count),counts=new Uint32Array(data.encounter_sets.length);
 for(let i=0;i<source.count;i++){
  const a=source.source(i);if(a.origin||a.region===null||a.terrain===null)throw Error('Encounter Geography requires BASE source attributes');
  const r=resolveEncounter(data,a.region,a.terrain),set=setIndex.get(r.set.id);if(set===undefined)throw Error('Encounter Set identity');
  faceSets[i]=set;counts[set]++;flags[i]=(a.script===0?1:0)|(a.chocobo?2:0)|(r.fallback?4:0)|(r.sourceRegion!==r.effectiveRegion?8:0)|(r.sourceTerrain!==r.effectiveTerrain?16:0);
 }
 const offsets=new Uint32Array(counts.length+1);for(let i=0;i<counts.length;i++)offsets[i+1]=offsets[i]+counts[i];
 const cursor=offsets.slice(),order=new Uint32Array(source.count);for(let i=0;i<source.count;i++)order[cursor[faceSets[i]]++]=i;
 const references=positiveEncounterReferences(data),allReferences=data.encounter_sets.flatMap(s=>encounterKinds.flatMap(kind=>s.records[kind].map(record=>({setId:s.id,kind,record}))));
 function query(target:GeographyTarget|GeographyTarget[],range:GeographyRange,family:GeographyFamily,relations?:EncounterRelations):GeographyResult{
  const result:GeographyResult={status:'ok',faces:[],mask:new Uint8Array(source.count),records:[],total:{count:0,area:0},regions:new Map(),terrains:new Map(),sets:new Map(),zeroXZ:0,duplicateMembers:0,clamped:0,aliased:0,fallback:0};
  const selected=new Map<string,EncounterReference>(),targets=Array.isArray(target)?target:[target];
  for(const t of targets){
   let rows:EncounterReference[];
   if(t.kind==='all')rows=range==='lookup'?allReferences:references;
   else if(t.kind==='set'){if(!setIndex.has(t.id)){result.status='unknown_identity';return result;}rows=(range==='lookup'?allReferences:references).filter(r=>r.setId===t.id);}
   else{
    if(!relations||relations.status!=='available'){result.status=relations?.status??'gameplay_missing';return result;}
    if(t.kind==='formation'?!relations.index?.formations.has(t.id):!relations.index?.enemies.has(`${t.sceneId}/${t.enemyId}`)){result.status='unknown_identity';return result;}
    const ids=t.kind==='formation'?[t.id]:[...(relations.enemies.get(`${t.sceneId}/${t.enemyId}`)??[])];
    rows=ids.flatMap(id=>relations.formations.get(id)??[]);
   }
   for(const r of rows)if((r.kind==='chocobo')===(family==='chocobo'))selected.set(referenceKey(r),r);
  }
  result.records=[...selected.values()];if(!result.records.length){result.status='no_records';return result;}
  for(const id of new Set(result.records.map(r=>r.setId))){const set=setIndex.get(id)!;
   if(range==='candidate'&&!data.encounter_sets[set].active)continue;
   for(let j=offsets[set];j<offsets[set+1];j++){
    const face=order[j],f=flags[face];if(range==='candidate'&&(!(f&1)||family==='chocobo'&&!(f&2)))continue;
    if(result.mask[face])continue;result.mask[face]=1;result.faces.push(face);
    const a=source.source(face),m=source.metrics(face),area=m.area;
    result.total.count++;result.total.area+=area;add(result.regions,a.region!,area);add(result.terrains,a.terrain!,area);add(result.sets,id,area);
    result.zeroXZ+=Number(m.zeroXZ);result.duplicateMembers+=Number(m.duplicateCount>1);result.fallback+=Number(!!(f&4));result.clamped+=Number(!!(f&8));result.aliased+=Number(!!(f&16));
   }
  }
  result.faces.sort((a,b)=>a-b);if(!result.faces.length)result.status='no_coverage';return result;
 }
 return {source,data,faceSets,flags,offsets,order,milliseconds:performance.now()-began,bytes:faceSets.byteLength+flags.byteLength+offsets.byteLength+order.byteLength,query,
  setForFace:(face:number)=>data.encounter_sets[faceSets[face]],references};
}
