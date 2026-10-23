// SPDX-License-Identifier: GPL-3.0-only
import type {TriangleAttributes} from '../data/mesh';
import type {EventsDataset,WorldEvent} from '../data/events';
import type {PoiDataset,Entrance,Location} from '../data/poi';
import {resolveEncounter} from '../data/encounters';
import type {EncounterDataset} from '../data/encounters';
import {resolveBinding,validateAtlasPoi} from '../data/atlas';
import type {AtlasContent,AtlasPack,AtlasEntity,AtlasBinding} from '../data/atlas';
import {FieldIndex,resolveFieldAtlas,validateFieldPoi,validateWorldEntrance} from '../data/fieldContext';
import type {FieldPack,FieldNode,FieldBinding,FieldEntrance,WorldEntranceReason} from '../data/fieldContext';

export interface EvidenceSource extends Pick<TriangleAttributes,'section'|'mesh'|'triangle'|'terrain'|'region'> {mapId:string;sourceSHA:string;origin?:number;}
export type SourceEvidenceStatus='linked'|'no_direct_relation'|'unavailable'|'source_mismatch'|'not_applicable';
export interface EvidenceRows<T> {status:SourceEvidenceStatus;rows:T[];}
export interface SourceAtlasEvidence {entity:AtlasEntity;binding:AtlasBinding;}
export interface SourceFieldEvidence {
 entrance:Entrance;node:FieldNode;binding:FieldBinding;table:FieldEntrance|null;tableStatus:WorldEntranceReason|null;
}
export interface SourceEvidenceResources {
 events?:EventsDataset|null;poi?:PoiDataset|null;encounters?:EncounterDataset|null;
 atlas?:AtlasContent|AtlasPack|null;field?:FieldPack|null;
}
export interface SourceEvidence {
 identityKey:string|null;terrain:number|null;region:number|null;
 encounter:{status:SourceEvidenceStatus;value:ReturnType<typeof resolveEncounter>|null};
 events:EvidenceRows<WorldEvent>;entrances:EvidenceRows<Entrance>;locations:EvidenceRows<Location>;
 atlas:EvidenceRows<SourceAtlasEvidence>;field:EvidenceRows<SourceFieldEvidence>;
}
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
const sameHash=(a:unknown,b:unknown)=>hash(a)&&hash(b)&&a.toLowerCase()===b.toLowerCase();
const worldKeys=['wm0.map','wm0.ev','field.tbl','maplist'];
const normalized=(sources:Record<string,string>)=>Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,v.toLowerCase()]));
function sameSources(a:Record<string,string>,b:Record<string,string>){
 return worldKeys.every(k=>sameHash(a[k],b[k]))&&Object.keys(a).every(k=>!Object.hasOwn(b,k)||sameHash(a[k],b[k]));
}
/** Source identity, never viewer ordinal, representative anchor or geometry. */
export function sourceIdentityKey(source:EvidenceSource){
 return `${source.sourceSHA.toLowerCase()}/${source.mapId}/${source.section}/${source.mesh}/${source.triangle}`;
}
function append<K,T>(index:Map<K,T[]>,key:K,value:T){const rows=index.get(key)??[];if(!rows.includes(value))rows.push(value);index.set(key,rows);}
const rows=<T>(status:SourceEvidenceStatus,values:T[]=[]):EvidenceRows<T>=>({status:status==='linked'&&!values.length?'no_direct_relation':status,rows:values});

/** A small index owned by the current WM0 dataset. Inputs have already passed
 * their existing codecs/mesh validation. Optional packs retain independent
 * source guards; loading one never blesses another pack's identities. */
export function buildSourceEvidenceIndex(sourceSHA:string,resources:SourceEvidenceResources){
 if(!hash(sourceSHA))throw Error('WM0 source fingerprint missing');
 const sha=sourceSHA.toLowerCase(),eventIndex=new Map<string,WorldEvent[]>(),entranceIndex=new Map<string,Entrance[]>();
 const sourceStatus=(pack:{sources:Record<string,string>}|null|undefined):SourceEvidenceStatus=>!pack?'unavailable':sameHash(pack.sources['wm0.map'],sha)?'linked':'source_mismatch';
 const eventsStatus=sourceStatus(resources.events),poiStatus=sourceStatus(resources.poi),encounterStatus=sourceStatus(resources.encounters);
 const events=eventsStatus==='linked'?resources.events!:null,poi=poiStatus==='linked'?resources.poi!:null;
 const key=(section:number,mesh:number,triangle:number)=>sourceIdentityKey({sourceSHA:sha,mapId:'WM0',section,mesh,triangle,terrain:null,region:null});
 // A model's display anchor has no trigger relation, even if its triangle_id
 // happens to equal a selected source. Every actual trigger owner is retained.
 for(const event of events?.events??[])if(event.world_map===0)for(const triangle of event.trigger_triangle_ids)append(eventIndex,key(event.section_id,event.mesh_id,triangle),event);
 for(const entrance of poi?.entrances??[])if(entrance.world_map===0)for(const triangle of entrance.trigger_triangle_ids)append(entranceIndex,key(entrance.section_id,entrance.mesh_id,triangle),entrance);
 const locations=new Map(poi?.locations.map(location=>[location.id,location])??[]);
 const eventLocationsAgree=!!events&&!!poi&&sameSources(events.sources,poi.sources);
 const atlasByLocation=new Map<string,SourceAtlasEvidence[]>(),atlasByField=new Map<number,SourceAtlasEvidence[]>();
 let atlasStatus:SourceEvidenceStatus=!resources.atlas||!poi?'unavailable':'linked';
 if(resources.atlas&&poiStatus==='source_mismatch')atlasStatus='source_mismatch';
 if(atlasStatus==='linked'){
  const atlas=resources.atlas!;
  try{
   if(atlas.schema==='gaiagis-atlas')validateAtlasPoi(atlas,poi!);
   const content=atlas.schema==='gaiagis-atlas'?atlas.content:atlas;
   for(const entity of content.entities){
    const binding=atlas.schema==='gaiagis-atlas'?atlas.bindings[entity.id]:resolveBinding(entity,poi);
    // Parent/field-only bindings remain contextual. Their rewards and authored
    // facts do not acquire a source coordinate through this association.
    if(binding.locationId&&locations.has(binding.locationId))append(atlasByLocation,binding.locationId,{entity,binding});
   }
  }catch{atlasStatus='source_mismatch';atlasByLocation.clear();}
 }
 const fieldsByEntrance=new Map<string,SourceFieldEvidence[]>();
 let fieldStatus:SourceEvidenceStatus=!resources.field||!poi?'unavailable':'linked';
 if(resources.field&&poiStatus==='source_mismatch')fieldStatus='source_mismatch';
 if(fieldStatus==='linked'){
  const pack=resources.field!;
  try{
   if(!sameSources(pack.sources,poi!.sources))throw Error('Field/POI source identity mismatch');
   validateFieldPoi({...pack,sources:normalized(pack.sources)},{...poi!,sources:normalized(poi!.sources)});
   for(const entrance of poi!.entrances){
    const binding=pack.bindings.find(b=>b.entranceId===entrance.id),node=pack.nodes.find(n=>n.id===entrance.field_id);
    if(!binding||binding.status!=='verified_direct'||!node||node.status!=='available')continue;
    const validation=validateWorldEntrance(pack,poi,entrance);
    // This is an identity/context link. A local landing point remains unproved
    // until the Field owner loads its walkmesh and completes the existing gate.
    append(fieldsByEntrance,entrance.id,{entrance,node,binding,table:validation.record,tableStatus:validation.reason});
   }
  }catch{fieldStatus='source_mismatch';fieldsByEntrance.clear();}
 }
 if(atlasStatus==='linked'&&fieldStatus==='linked'){
  const atlas=resources.atlas!,content=atlas.schema==='gaiagis-atlas'?atlas.content:atlas,index=new FieldIndex(resources.field!);
  for(const entity of content.entities)if(entity.spatialBinding.kind==='field_identity'){
   const binding=resolveFieldAtlas(entity,resolveBinding(entity,poi),index);
   if(binding.precision==='field_only')for(const node of index.nodes.values())if(binding.fieldNames.includes(node.name))append(atlasByField,node.id,{entity,binding});
  }
 }
 return {query(source:EvidenceSource):SourceEvidence{
  const applicable=source.mapId==='WM0'&&!source.origin&&[source.section,source.mesh,source.triangle].every(n=>Number.isSafeInteger(n)&&Number(n)>=0);
  const invalid:SourceEvidenceStatus|null=!applicable?'not_applicable':!sameHash(source.sourceSHA,sha)?'source_mismatch':null;
  if(invalid)return {identityKey:null,terrain:null,region:null,encounter:{status:invalid,value:null},events:rows(invalid),entrances:rows(invalid),locations:rows(invalid),atlas:rows(invalid),field:rows(invalid)};
  const identityKey=sourceIdentityKey(source),matchedEvents=eventIndex.get(identityKey)??[],entrances=entranceIndex.get(identityKey)??[];
  const locationIds=new Set(entrances.map(e=>e.location_id));
  if(eventLocationsAgree)for(const event of matchedEvents)if(event.location_id)locationIds.add(event.location_id);
  const matchedLocations=[...locationIds].map(id=>locations.get(id)).filter((l):l is Location=>!!l);
  const field=entrances.flatMap(e=>fieldsByEntrance.get(e.id)??[]);
  const atlas=[...new Set([...matchedLocations.flatMap(l=>atlasByLocation.get(l.id)??[]),...field.flatMap(f=>atlasByField.get(f.node.id)??[])])];
  const attributes=source.terrain!==null&&source.region!==null;
  const encounter=encounterStatus==='linked'&&attributes?resolveEncounter(resources.encounters!,source.region!,source.terrain!):null;
  return {identityKey,terrain:source.terrain,region:source.region,encounter:{status:!attributes?'not_applicable':encounterStatus,value:encounter},
   events:rows(eventsStatus,matchedEvents),entrances:rows(poiStatus,entrances),locations:rows(poiStatus,matchedLocations),atlas:rows(atlasStatus,atlas),field:rows(fieldStatus,field)};
 }};
}
