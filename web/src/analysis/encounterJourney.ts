// SPDX-License-Identifier: GPL-3.0-only
import {encounterKinds,resolveEncounter} from '../data/encounters';
import type {EncounterResource} from '../data/encounters';
import type {GameplayResource} from '../data/gameplay';
import type {GaiaMesh} from '../data/mesh';
import type {JourneyLeg,JourneyResult,JourneyScenario,JourneySource} from '../navigation/journey';
import {positiveEncounterReferences,referenceKey,validateEncounterRelations} from './encounterGeography';
import type {EncounterReference,GeographyFamily,GeographyRange,RelationStatus} from './encounterGeography';
import {corridorLegs,SourceCorridorError} from './spatial';
import type {RouteLeg} from './spatial';

export interface EncounterRoute {
 kind:'routing'|'journey'|'world-field';
 source:JourneySource;
 scenario:JourneyScenario;
 nodes:number[];
 legs: Pick<JourneyLeg,'nodes'|'distance'|'startEntrance'|'targetEntrance'>[];
}
export function encounterJourneyRoute(result:JourneyResult,kind:'journey'|'world-field'):EncounterRoute {
 return {kind,source:result.source,scenario:result.scenario,nodes:result.nodes,legs:result.legs};
}
export interface EncounterPiece extends RouteLeg {
 leg:number;ordinal:number;start:number;end:number;
 lineage:[number,number,number];
 lookup:ReturnType<typeof resolveEncounter>;script:number;tracks:boolean;ordinary:boolean;chocobo:boolean;
}
export interface EncounterSpan {first:number;last:number;start:number;end:number;}
export interface EncounterRow {
 id:string;distance:number;pieces:number;faces:Set<number>;spans:EncounterSpan[];records:Set<EncounterReference>;
}
type Rows=Map<string,EncounterRow>;
type Views=Record<GeographyRange,Record<GeographyFamily,{set:Rows;formation:Rows;enemy:Rows}>>;
export interface EncounterRouteResult {
 status:'complete'|'partial'|'limited'|'unavailable'|'cancelled';
 reason:'geometry'|'sources'|'route'|'budget'|null;
 relation:RelationStatus;
 pieces:EncounterPiece[];
 graphCost:number;length:number|null;analyzed:number;coverage:number|null;faces:number;
 strips:(EncounterSpan&{setId:string;ordinary:boolean;chocobo:boolean;active:boolean;script:boolean;tracks:boolean})[];
 rows:Views;
 unions:{ordinary:number;chocobo:number;intersection:number;union:number};
 usage:{pieces:number;contributions:number;intervals:number;bytes:number};
 elapsedMs:number;
}

export const encounterRouteBudget={pieces:8192,contributions:200_000,intervals:16_384,bytes:8*1024*1024};
type Budget=typeof encounterRouteBudget;
const categories=['ordinary','chocobo'] as const;
const ranges=['lookup','candidate'] as const;
const familyOf=(row:EncounterReference)=>row.kind==='chocobo'?'chocobo':'ordinary';
function byKey<T>(items:T[],key:(item:T)=>string){
 const groups=new Map<string,T[]>();
 for(const item of items){const id=key(item),group=groups.get(id);if(group)group.push(item);else groups.set(id,[item]);}
 return groups;
}
const uniqueRefs=(records:EncounterReference[])=>[...new Map(records.map(record=>[referenceKey(record),record])).values()];
const rows=()=>({set:new Map<string,EncounterRow>(),formation:new Map<string,EncounterRow>(),enemy:new Map<string,EncounterRow>()});
const families=()=>({ordinary:rows(),chocobo:rows()});
const emptyResult=():EncounterRouteResult=>({status:'unavailable',reason:null,relation:'gameplay_missing',pieces:[],graphCost:0,length:null,analyzed:0,coverage:null,faces:0,
 strips:[],rows:{lookup:families(),candidate:families()},unions:{ordinary:0,chocobo:0,intersection:0,union:0},usage:{pieces:0,contributions:0,intervals:0,bytes:0},elapsedMs:0});

/** Cache only the source-verified Profile geometry for the active route. */
export function createEncounterRouteProfile(mesh:GaiaMesh,route:EncounterRoute){
 const cache=new Map<number,RouteLeg[]>();let cachedPieces=0;
 return {mesh,route,async leg(index:number,current:()=>boolean,pause:()=>Promise<void>,limit:number){
  const nodes=route.legs[index].nodes;
  if(nodes.length>mesh.sourceTriangleCount||Math.max(1,2*(nodes.length-1))>limit)return null;
  const memo=cache.get(index);if(memo)return memo;
  const pieces:RouteLeg[]=[];
  for(let first=0;first<Math.max(1,nodes.length-1);first+=128){
   if(first)await pause();if(!current())return null;
   pieces.push(...corridorLegs(mesh,nodes.slice(first,first+129)));
  }
  // Only keep a bounded number of reusable pieces even when all legs are queried separately.
  if(cachedPieces+pieces.length<=encounterRouteBudget.pieces){cache.set(index,pieces);cachedPieces+=pieces.length;}
  return pieces;
 }};
}

export function createEncounterRouteIndex(resource:EncounterResource,gameplay:GameplayResource|null,generation:number){
 const relations=validateEncounterRelations(resource,gameplay?.generation===generation?gameplay.index:null);
 const positives=byKey(uniqueRefs(positiveEncounterReferences(resource.data)),row=>row.setId);
 const memo=new Map<string,ReturnType<typeof references>>();
 function references(set:EncounterPiece['lookup']['set']){
  const all=encounterKinds.flatMap(kind=>set.records[kind].map(record=>({setId:set.id,kind,record})));
  const positive=positives.get(set.id)??[];
  return Object.fromEntries(categories.map(family=>{
   const records=uniqueRefs(all.filter(row=>familyOf(row)===family));
   const refs=positive.filter(row=>familyOf(row)===family);
   const formation=byKey(refs,row=>String(row.record.scene_id)),enemy=new Map<string,EncounterReference[]>();
   if(relations.status==='available')for(const [id,group] of formation){
    const f=relations.index!.formations.get(Number(id))!;
    for(const enemyId of new Set(f.enemyIds)){
     const key=`${f.sceneId}/${enemyId}`,previous=enemy.get(key)??[];
     previous.push(...group);enemy.set(key,previous);
    }
   }
   return [family,{records,refs,formation,enemy}];
  })) as Record<GeographyFamily,{records:EncounterReference[];refs:EncounterReference[];formation:Map<string,EncounterReference[]>;enemy:Map<string,EncounterReference[]>}>;
 }
 return {resource,gameplay,relations,forSet(set:EncounterPiece['lookup']['set']){
  let entry=memo.get(set.id);if(!entry){entry=references(set);memo.set(set.id,entry);}return entry;
 }};
}

class RouteBudgetLimit extends Error{}
export async function analyzeEncounterRoute(profile:ReturnType<typeof createEncounterRouteProfile>,index:ReturnType<typeof createEncounterRouteIndex>,options:{
 leg?:number;limits?:Partial<Budget>;current?:()=>boolean;pause?:()=>Promise<void>;
}={}):Promise<EncounterRouteResult>{
 const {mesh,route}=profile,result=emptyResult(),began=performance.now();
 const data=index.resource.data,current=options.current??(()=>true),pause=options.pause??(()=>Promise.resolve());
 result.relation=index.relations.status;
 const end=(status:EncounterRouteResult['status'],reason:EncounterRouteResult['reason']=null)=>({...result,status,reason,elapsedMs:performance.now()-began});
 const stop=(status:EncounterRouteResult['status'],reason:EncounterRouteResult['reason']=null)=>({...emptyResult(),relation:result.relation,graphCost:result.graphCost,
  usage:result.usage,status,reason,elapsedMs:performance.now()-began});
 if(!current())return stop('cancelled');
 if(route.source.wm0!==data.sources['wm0.map'])return stop('unavailable','sources');
 const legIndices=options.leg===undefined?route.legs.map((_,i)=>i):[options.leg];
 if(!legIndices.length||legIndices.some(i=>!route.legs[i]?.nodes.length))return stop('unavailable','route');
 result.graphCost=legIndices.reduce((cost,i)=>cost+route.legs[i].distance,0);
 const spend=(key:keyof Budget,count:number)=>{
  if(result.usage[key]+count>Math.min(encounterRouteBudget[key],options.limits?.[key]??Infinity))throw new RouteBudgetLimit(key);
  result.usage[key]+=count;
 };
 const maxPieces=Math.min(encounterRouteBudget.pieces,options.limits?.pieces??Infinity);
 if(legIndices.reduce((count,i)=>count+Math.max(1,2*(route.legs[i].nodes.length-1)),0)>maxPieces)return stop('limited','budget');
 let offset=0;
 for(const [i,leg] of route.legs.entries()){
  const first=i?1:0;
  if(i&&leg.nodes[0]!==route.legs[i-1].nodes.at(-1))return stop('unavailable','route');
  if(legIndices.includes(i)&&leg.nodes.some((node,j)=>node!==route.nodes[offset+j-first]))return stop('unavailable','route');
  offset+=leg.nodes.length-first;
 }
 if(offset!==route.nodes.length)return stop('unavailable','route');
 const rawFaces=new Set<number>(),lookupByFace=new Map<number,EncounterPiece['lookup']>();
 function span(piece:EncounterPiece):EncounterSpan{
  spend('intervals',1);spend('bytes',32);
  return {first:piece.ordinal,last:piece.ordinal,start:piece.start,end:piece.end};
 }
 function append(value:EncounterSpan|undefined,piece:EncounterPiece){
  if(value?.last===piece.ordinal-1){value.last=piece.ordinal;value.end=piece.end;return true;}return false;
 }
 function add(map:Rows,id:string,piece:EncounterPiece,records:EncounterReference[]){
  spend('contributions',1);
  let row=map.get(id);
  if(!row){spend('bytes',160);row={id,distance:0,pieces:0,faces:new Set(),spans:[],records:new Set()};map.set(id,row);}
  row.distance+=piece.distance;row.pieces++;
  if(!row.faces.has(piece.triangle)){spend('bytes',24);row.faces.add(piece.triangle);}
  if(!append(row.spans.at(-1),piece))row.spans.push(span(piece));
  for(const record of records)if(!row.records.has(record)){spend('bytes',32);row.records.add(record);}
 }
 let distance=0,lastYield=performance.now();
 try{
  for(const leg of legIndices){
   let geometry:RouteLeg[]|null;
   try{geometry=await profile.leg(leg,current,pause,maxPieces);}catch(error){
    if(error instanceof SourceCorridorError)return stop(options.leg===undefined&&legIndices.length>1?'partial':'unavailable','geometry');
    throw error;
   }
   if(!current())return stop('cancelled');
   if(!geometry)return stop('limited','budget');
   for(const segment of geometry){
    if(result.usage.pieces%256===0&&result.usage.pieces||performance.now()-lastYield>=8){await pause();lastYield=performance.now();}
    if(!current())return stop('cancelled');
    const a=mesh.attributes(segment.triangle);
    if(a.origin||a.section===null||a.mesh===null||a.triangle===null||a.region===null||a.terrain===null||a.script===null||a.chocobo===null)return stop(options.leg===undefined&&legIndices.length>1?'partial':'unavailable','geometry');
    spend('pieces',1);spend('bytes',192);rawFaces.add(segment.triangle);
    let lookup=lookupByFace.get(segment.triangle);
    if(!lookup){lookup=resolveEncounter(data,a.region,a.terrain);lookupByFace.set(segment.triangle,lookup);}
    const set=lookup.set,families=index.forSet(set),eligible=set.active&&a.script===0;
    const ordinary=eligible&&families.ordinary.refs.length>0,chocobo=eligible&&a.chocobo&&families.chocobo.refs.length>0;
    const piece:EncounterPiece={...segment,leg,ordinal:result.pieces.length,start:distance,end:distance+=segment.distance,
     lineage:[a.section,a.mesh,a.triangle],lookup,script:a.script,tracks:a.chocobo,ordinary,chocobo};
    result.pieces.push(piece);
    const last=result.strips.at(-1);
    if(last?.setId!==set.id||last.ordinary!==ordinary||last.chocobo!==chocobo||last.script!==(a.script!==0)||last.tracks!==a.chocobo||!append(last,piece)){
     result.strips.push({...span(piece),setId:set.id,ordinary,chocobo,active:set.active,script:a.script!==0,tracks:a.chocobo});
    }
    if(ordinary)result.unions.ordinary+=segment.distance;
    if(chocobo)result.unions.chocobo+=segment.distance;
    if(ordinary&&chocobo)result.unions.intersection+=segment.distance;
    if(ordinary||chocobo)result.unions.union+=segment.distance;
    for(const range of ranges)for(const family of categories){
     if(range==='candidate'&&!(family==='ordinary'?ordinary:chocobo))continue;
     const view=result.rows[range][family],group=families[family];
     add(view.set,set.id,piece,range==='lookup'?group.records:group.refs);
     for(const [id,refs] of group.formation)add(view.formation,id,piece,refs);
     for(const [id,refs] of group.enemy)add(view.enemy,id,piece,refs);
    }
   }
  }
 }catch(error){if(error instanceof RouteBudgetLimit)return stop('limited','budget');throw error;}
 result.length=result.analyzed=distance;result.coverage=distance?1:null;result.faces=rawFaces.size;
 return end('complete');
}
