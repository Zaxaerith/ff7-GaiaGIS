// SPDX-License-Identifier: GPL-3.0-only
import type {WM0Source} from './wm0Source';
import type {WM0Topology} from './wm0Topology';
import type {NativePoint} from './native';
import type {PoiDataset} from '../data/poi';
import type {AtlasContent,AtlasPack,AtlasBinding} from '../data/atlas';
import {resolveBinding,validateAtlasPoi} from '../data/atlas';

export type ConnectivityStrategy='A'|'B';
export type ConnectivityEdgeKind='confirmed'|'open'|'ambiguous'|'periodic'|'internal';
export interface ConnectivityComponent {id:number;region:number;count:number;area:number;duplicateFaces:number;zeroXZ:number;degenerate3D:number;offset:number;end:number;}
export interface ConnectivityRegion {id:number;faces:number;area:number;components:ConnectivityComponent[];largest:ConnectivityComponent;singletons:number;duplicateIsolates:number;nonDuplicateComponents:number;}
export interface ConnectivityPartition {labels:Uint32Array;components:ReadonlyMap<number,ConnectivityComponent>;regions:ReadonlyMap<number,ConnectivityRegion>;memberIDs:Uint32Array;members(id:number):Uint32Array;}
export interface ConnectivityPair {key:string;regionA:number;regionB:number;edges:number;length:number;candidates:number;periodicPairs:number;occurrences:Uint32Array;candidateOccurrences:Uint32Array;}
export interface ConnectivityEdge {id:number;occurrence:number;kind:ConnectivityEdgeKind;a:NativePoint;b:NativePoint;faces:number[];regions:number[];length:number;sourceSHA:string;incidence:number;periodic:ReturnType<WM0Topology['edge']>['periodic'];}
export interface RegionalConnectivity {
 source:WM0Source;sourceSHA:string;topology:WM0Topology;milliseconds:number;
 summary:{faces:number;regions:number;terrains:number;area:number;componentsA:number;componentsB:number;singletonsA:number;singletonsB:number;duplicateIsolatesA:number;duplicateIsolatesB:number;nonDuplicateComponentsA:number;nonDuplicateComponentsB:number;confirmedEdges:number;adjacencyPairs:number;openEdges:number;unpairedOpenEdges:number;ambiguousEdges:number;periodicPairs:number;periodicMerges:number;};
 strategies:Record<ConnectivityStrategy,ConnectivityPartition>;boundaries:Record<'confirmed'|'open'|'ambiguous'|'periodic',Uint32Array>;pairs:ConnectivityPair[];
 edge(occurrence:number):ConnectivityEdge;
}
const cache=new WeakMap<WM0Source,RegionalConnectivity>();
export function releaseRegionalConnectivity(source:WM0Source){cache.delete(source);}
const root=(parent:Int32Array,face:number)=>{while(parent[face]!==face){parent[face]=parent[parent[face]];face=parent[face];}return face;};
const union=(parent:Int32Array,a:number,b:number)=>{const x=root(parent,a),y=root(parent,b);if(x===y)return false;parent[Math.max(x,y)]=Math.min(x,y);return true;};

/** Same raw edges as WM0Topology; no new edge map, nearest lookup or routing graph. */
export function createRegionalConnectivity(source:WM0Source,topology:WM0Topology):RegionalConnectivity {
 const steps=connectivitySteps(source,topology);let step=steps.next();while(!step.done)step=steps.next();return step.value;
}
/** Interactive scheduling uses exactly the synchronous algorithm and cache. */
export async function prepareRegionalConnectivity(source:WM0Source,topology:WM0Topology,pause:()=>Promise<void>,current:()=>boolean){
 const steps=connectivitySteps(source,topology);
 try {let step=steps.next();while(!step.done){await pause();if(!current())throw new DOMException('Connectivity superseded','AbortError');step=steps.next();}return step.value;}
 finally {steps.return(undefined as never);}
}
function* connectivitySteps(source:WM0Source,topology:WM0Topology):Generator<void,RegionalConnectivity>{
 if(topology.source!==source||topology.summary.faces!==source.count)throw Error('Regional connectivity source identity');
 const previous=cache.get(source);if(previous&&previous.topology===topology)return previous;
 const began=performance.now(),n=source.count,region=new Uint8Array(n),invalid=new Uint8Array(n),duplicate=new Uint8Array(n),area=new Float64Array(n),zero=new Uint8Array(n),terrain=new Set<number>();
 const A=Int32Array.from({length:n},(_,i)=>i),B=new Int32Array(n),confirmed:number[]=[],open:number[]=[],ambiguous:number[]=[],periodic:number[]=[],seams:[number,number][]=[];
 const pairs=new Map<string,ConnectivityPair&{raw:number[];uncertain:number[]}>();
 const pair=(a:number,b:number)=>{const regionA=Math.min(a,b),regionB=Math.max(a,b),key=`${regionA}/${regionB}`;let p=pairs.get(key);if(!p){p={key,regionA,regionB,edges:0,length:0,candidates:0,periodicPairs:0,occurrences:new Uint32Array(),candidateOccurrences:new Uint32Array(),raw:[],uncertain:[]};pairs.set(key,p);}return p;};
 for(let f=0;f<n;f++){if(f&&f%4096===0)yield;const s=source.source(f),m=source.metrics(f);if(s.origin||s.mapId!=='WM0'||s.sourceSHA.toLowerCase()!==source.sourceSHA.toLowerCase()||s.sourceFace!==f||s.region===null||s.terrain===null)throw Error('Regional connectivity BASE identity');region[f]=s.region;terrain.add(s.terrain);invalid[f]=Number(m.degenerate3D);duplicate[f]=Number(m.duplicateCount>1);zero[f]=Number(m.zeroXZ);area[f]=m.area;}
 let unpairedOpenEdges=0,periodicMerges=0;
 let visitedEdges=0;for(const e of topology.uniqueEdges()){
  if(visitedEdges++%4096===4095)yield;
  const owners=[...new Set(e.references.map(r=>r.face))],validOwners=owners.every(f=>!invalid[f]);
  const strict=e.uniqueRaw&&owners.length===2&&validOwners;
  if(strict){if(region[owners[0]]===region[owners[1]])union(A,owners[0],owners[1]);else{
   const detail=topology.edge(e.id),p=pair(region[owners[0]],region[owners[1]]),length=Math.hypot(detail.b[0]-detail.a[0],detail.b[1]-detail.a[1]);p.edges++;p.length+=length;p.raw.push(e.occurrence);confirmed.push(e.occurrence);
  }}
  if(e.incidence===1){open.push(e.occurrence);if(e.periodic.status!=='paired')unpairedOpenEdges++;}
  if(e.geometricAmbiguous||!validOwners){ambiguous.push(e.occurrence);const regions=[...new Set(owners.map(f=>region[f]))];for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++){const p=pair(regions[i],regions[j]);p.candidates++;p.uncertain.push(e.occurrence);}}
  // Paired seam edges are single-owner raw edges, not uniqueRaw two-owner edges.
  if(e.periodic.side==='west'&&e.periodic.status==='paired'){
   periodic.push(e.occurrence);const other=e.periodic.references[0]?.face,a=owners[0];
   if(owners.length===1&&other!==undefined&&other!==a&&!e.geometricAmbiguous&&!invalid[a]&&!invalid[other]&&!duplicate[a]&&!duplicate[other]){
    if(region[a]===region[other])seams.push([a,other]);else pair(region[a],region[other]).periodicPairs++;
   }
  }
 }
 B.set(A);for(const [a,b]of seams)periodicMerges+=Number(union(B,a,b));
 function* partition(parent:Int32Array):Generator<void,ConnectivityPartition>{
  const labels=new Uint32Array(n),components=new Map<number,ConnectivityComponent>(),regions=new Map<number,ConnectivityRegion>();
  for(let f=0;f<n;f++){if(f&&f%8192===0)yield;const id=root(parent,f);labels[f]=id;let c=components.get(id);if(!c){c={id,region:region[f],count:0,area:0,duplicateFaces:0,zeroXZ:0,degenerate3D:0,offset:0,end:0};components.set(id,c);}c.count++;c.area+=area[f];c.duplicateFaces+=duplicate[f];c.zeroXZ+=zero[f];c.degenerate3D+=invalid[f];}
  let offset=0;for(const c of components.values()){c.offset=offset;offset+=c.count;c.end=offset;let r=regions.get(c.region);if(!r){r={id:c.region,faces:0,area:0,components:[],largest:c,singletons:0,duplicateIsolates:0,nonDuplicateComponents:0};regions.set(c.region,r);}r.faces+=c.count;r.area+=c.area;r.components.push(c);if(c.count>r.largest.count||c.count===r.largest.count&&c.id<r.largest.id)r.largest=c;r.singletons+=Number(c.count===1);r.duplicateIsolates+=Number(c.count===1&&c.duplicateFaces===1);r.nonDuplicateComponents+=Number(c.duplicateFaces<c.count);}
  const memberIDs=new Uint32Array(n),cursor=new Map([...components].map(([id,c])=>[id,c.offset]));for(let f=0;f<n;f++){if(f&&f%8192===0)yield;const id=labels[f],at=cursor.get(id)!;memberIDs[at]=f;cursor.set(id,at+1);}
  return {labels,components,regions,memberIDs,members(id){const c=components.get(id);if(!c)throw Error('Regional component identity');return memberIDs.subarray(c.offset,c.end);}};
 }
 const strategies={A:yield* partition(A),B:yield* partition(B)},sum=(s:ConnectivityStrategy,key:'singletons'|'duplicateIsolates'|'nonDuplicateComponents')=>[...strategies[s].regions.values()].reduce((v,r)=>v+r[key],0);
 const finalPairs=[...pairs.values()].map(({raw,uncertain,...p})=>({...p,occurrences:Uint32Array.from(raw),candidateOccurrences:Uint32Array.from(uncertain)})).sort((a,b)=>a.regionA-b.regionA||a.regionB-b.regionB);
 const result:RegionalConnectivity={source,sourceSHA:source.sourceSHA,topology,milliseconds:performance.now()-began,
  summary:{faces:n,regions:strategies.A.regions.size,terrains:terrain.size,area:area.reduce((s,n)=>s+n,0),componentsA:strategies.A.components.size,componentsB:strategies.B.components.size,singletonsA:sum('A','singletons'),singletonsB:sum('B','singletons'),duplicateIsolatesA:sum('A','duplicateIsolates'),duplicateIsolatesB:sum('B','duplicateIsolates'),nonDuplicateComponentsA:sum('A','nonDuplicateComponents'),nonDuplicateComponentsB:sum('B','nonDuplicateComponents'),confirmedEdges:confirmed.length,adjacencyPairs:finalPairs.filter(p=>p.edges>0).length,openEdges:open.length,unpairedOpenEdges,ambiguousEdges:ambiguous.length,periodicPairs:periodic.length,periodicMerges},
  strategies,boundaries:{confirmed:Uint32Array.from(confirmed),open:Uint32Array.from(open),ambiguous:Uint32Array.from(ambiguous),periodic:Uint32Array.from(periodic)},pairs:finalPairs,
  edge(occurrence){if(!Number.isInteger(occurrence)||occurrence<0||occurrence>=n*3)throw Error('Regional boundary occurrence');const e=topology.face(Math.floor(occurrence/3))[occurrence%3],faces=[...new Set(e.references.map(r=>r.face))],regions=[...new Set(faces.map(f=>region[f]))].sort((a,b)=>a-b),bad=e.geometricAmbiguous||faces.some(f=>invalid[f]);
   const kind:ConnectivityEdgeKind=bad?'ambiguous':e.periodic.status==='paired'?'periodic':e.incidence===1?'open':e.uniqueRaw&&regions.length===2?'confirmed':'internal';
   return {id:e.id,occurrence,kind,a:e.a,b:e.b,faces,regions,length:Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1]),sourceSHA:source.sourceSHA,incidence:e.incidence,periodic:e.periodic};}
 };
 cache.set(source,result);return result;
}

export interface ConnectivityMembership {face:number;region:number;A:number;B:number;}
export interface ConnectivityEntrance {id:string;locationId:string;representative:ConnectivityMembership|null;triggerFaces:Uint32Array;regions:number[];A:number[];B:number[];missing:number;status:'linked'|'source_mismatch'|'unresolved';}
export interface ConnectivityLocation {id:string;entranceIds:string[];missing:number;regions:number[];A:number[];B:number[];}
export interface ConnectivityAtlas {id:string;binding:AtlasBinding;location:ConnectivityLocation|null;status:'direct'|'parent_context'|'no_source'|'source_mismatch';}
export interface ConnectivityEvidence {status:'linked'|'unavailable'|'source_mismatch';entrances:ReadonlyMap<string,ConnectivityEntrance>;locations:ReadonlyMap<string,ConnectivityLocation>;atlas:ReadonlyMap<string,ConnectivityAtlas>;milliseconds:number;}
const set=(values:number[])=>[...new Set(values)].sort((a,b)=>a-b);
/** Only the source key binds content; parent/Field context never gains a reward position. */
export function createConnectivityEvidence(index:RegionalConnectivity,poi:PoiDataset|null,atlas:AtlasContent|AtlasPack|null=null):ConnectivityEvidence{
 const began=performance.now(),entrances=new Map<string,ConnectivityEntrance>(),locations=new Map<string,ConnectivityLocation>(),atlasRows=new Map<string,ConnectivityAtlas>();
 const status=!poi?'unavailable':poi.sources['wm0.map']?.toLowerCase()===index.sourceSHA.toLowerCase()?'linked':'source_mismatch';
 if(status!=='linked')return {status,entrances,locations,atlas:atlasRows,milliseconds:performance.now()-began};
 const wanted=new Set<string>();for(const e of poi!.entrances)if(e.world_map===0){wanted.add(`${e.section_id}/${e.mesh_id}/${e.triangle_id}`);for(const t of e.trigger_triangle_ids)wanted.add(`${e.section_id}/${e.mesh_id}/${t}`);}
 const identities=new Map<string,number>();for(let f=0;f<index.source.count;f++){const s=index.source.source(f),key=`${s.section}/${s.mesh}/${s.triangle}`;if(wanted.has(key))identities.set(key,f);}
 const membership=(face:number):ConnectivityMembership=>({face,region:index.source.source(face).region!,A:index.strategies.A.labels[face],B:index.strategies.B.labels[face]});
 for(const e of poi!.entrances){const key=(t:number)=>`${e.section_id}/${e.mesh_id}/${t}`,representative=identities.get(key(e.triangle_id)),all=e.world_map===0?e.trigger_triangle_ids.map(t=>identities.get(key(t))):[],missing=e.world_map!==0?e.trigger_triangle_ids.length:all.filter(f=>f===undefined).length,faces=all.filter((f):f is number=>f!==undefined),rows=faces.map(membership);
  const valid=e.world_map===0&&e.source_kind==='derived_from_entry_trigger'&&representative!==undefined&&index.source.source(representative).region===e.region_id&&faces.every(f=>index.source.source(f).script===e.source_script+3);
  entrances.set(e.id,{id:e.id,locationId:e.location_id,representative:valid?membership(representative!):null,triggerFaces:Uint32Array.from(faces),regions:set(rows.map(r=>r.region)),A:set(rows.map(r=>r.A)),B:set(rows.map(r=>r.B)),missing,status:valid&&!missing?'linked':'unresolved'});
 }
 for(const l of poi!.locations){const rows=l.entrance_ids.map(id=>entrances.get(id)).filter((e):e is ConnectivityEntrance=>!!e&&e.status==='linked');locations.set(l.id,{id:l.id,entranceIds:rows.map(e=>e.id),missing:l.entrance_ids.length-rows.length,regions:set(rows.flatMap(e=>e.regions)),A:set(rows.flatMap(e=>e.A)),B:set(rows.flatMap(e=>e.B))});}
 if(atlas){let valid=true;if(atlas.schema==='gaiagis-atlas')try{validateAtlasPoi(atlas,poi!);}catch{valid=false;}
  for(const e of (atlas.schema==='gaiagis-atlas'?atlas.content:atlas).entities){const binding=valid?resolveBinding(e,poi!):resolveBinding(e,null),candidate=valid&&binding.locationId?locations.get(binding.locationId):null,location=candidate?.entranceIds.length?candidate:null;atlasRows.set(e.id,{id:e.id,binding,location,status:!valid?'source_mismatch':location?binding.kind==='location'?'direct':'parent_context':'no_source'});}
 }
 return {status,entrances,locations,atlas:atlasRows,milliseconds:performance.now()-began};
}
