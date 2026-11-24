// SPDX-License-Identifier: GPL-3.0-only
import {FieldGatewayNetwork,GatewayBudget} from '../analysis/fieldGateway';
import type {GatewayIdentity,GatewayLeg,GatewayPoint,GatewayResources,GatewayResult} from '../analysis/fieldGateway';
import {gatewayRelation} from '../data/fieldContext';
import type {WorldEntranceValidation,WalkmeshPath} from '../data/fieldContext';
import type {FieldGateway} from '../data/fieldContext';
import type {openFieldInteraction} from '../data/fieldInteraction';
import type {Entrance,PoiDataset} from '../data/poi';
import {entranceEndpoints} from '../data/routing';
import type {RoutingData} from '../data/routing';
import {solveJourney,validateJourneyRoute} from './journey';
import type {JourneyResult,JourneyScenario,JourneySolve,JourneySource,JourneyStation} from './journey';

export type ExplorationTarget={kind:'triangle';triangle:number}|{kind:'line';offset:number};
export interface ExplorationRequest {
 entranceId:string;
 entranceScenario:0|1;
 targetField:number;
 maxTransfers:number;
 target:ExplorationTarget|null;
 scenario:JourneyScenario;
}
export interface ExplorationFields {
 gateway:GatewayResources;
 interaction:Awaited<ReturnType<typeof openFieldInteraction>>|null;
 interactionSHA256:string;
 current:()=>boolean;
}
export interface LocalWitness {
 target:ExplorationTarget;
 start:GatewayPoint;
 candidates:number[];
 endTriangle:number;
 path:WalkmeshPath;
 line?:{key:string;offset:number;section1SHA256:string;section5SHA256:string;interactionSHA256:string};
}
export interface ExplorationFieldView {
 point:GatewayPoint;
 anchor:string|null;
 gateway?:FieldGateway;
 path?:WalkmeshPath;
 lineKey?:string;
 evidence:unknown;
}
export interface ExplorationResult {
 status:'complete'|'limited'|'unavailable'|'unresolved'|'not_connected'|'cancelled';
 reason:string|null;
 world:JourneyResult|null;
 worldArrival:{entranceId:string;node:number;section:number;mesh:number;triangle:number}|null;
 transfer:WorldEntranceValidation|null;
 start:GatewayPoint|null;
 arrival:GatewayPoint|null;
 legs:GatewayLeg[];
 final:LocalWitness|null;
 fieldSource:GatewayIdentity|null;
 usage:GatewayBudget['used'];
 timings:{world:number;entrance:number;gateway:number;local:number};
 reusedWorld:boolean;
}

export function lockExplorationEntrance(station:JourneyStation,graph:RoutingData,entrance:Entrance):JourneyStation {
 const eligible=entranceEndpoints(graph,[entrance]);
 const endpoints=eligible.filter(candidate=>station.endpoints.some(endpoint=>endpoint.node===candidate.node&&endpoint.entrance===candidate.entrance));
 return {...station,target:{kind:'entrance',id:entrance.id},endpoints};
}

export function sameJourneySource(a:JourneySource,b:JourneySource){
 return a.wm0===b.wm0&&a.routing===b.routing&&a.poi===b.poi&&a.atlas===b.atlas&&a.generation===b.generation;
}

function matchesJourney(result:JourneyResult,graph:RoutingData,labels:Int32Array,stations:JourneyStation[],scenario:JourneyScenario,source:JourneySource){
 if(result.status!=='success'||result.legs.length!==stations.length-1||result.component===null||!sameJourneySource(result.source,source)||
    result.scenario.profile!==scenario.profile||result.scenario.conditional!==scenario.conditional)return false;
 const joined:number[]=[];
 let total=0;
 for(const [index,leg] of result.legs.entries()){
  const [from,to]=[stations[index],stations[index+1]], previous=result.legs[index-1];
  const starts=previous?[{node:previous.endNode,entrance:previous.targetEntrance}]:from.endpoints;
  if(leg.from!==from.id||leg.to!==to.id||leg.startNode!==leg.nodes[0]||leg.endNode!==leg.nodes.at(-1)||
     !sameJourneySource(leg.source,source)||leg.scenario.profile!==scenario.profile||leg.scenario.conditional!==scenario.conditional||
     !validateJourneyRoute(graph,labels,leg,starts,to.endpoints,result.component,scenario))return false;
  for(let i=previous?1:0;i<leg.nodes.length;i++)joined.push(leg.nodes[i]);
  total+=leg.distance;
 }
 return total===result.totalDistance&&joined.length===result.nodes.length&&joined.every((node,i)=>node===result.nodes[i]);
}

type Scene=Awaited<ReturnType<FieldGatewayNetwork['scene']>>;

/** Gear, route and Field resources are borrowed from their existing owners. The result retains witnesses only. */
export async function exploreWorldField(input:{
 request:ExplorationRequest; graph:RoutingData; labels:Int32Array; source:JourneySource; poi:PoiDataset;
 stations:JourneyStation[]; solve:JourneySolve; journey?:JourneyResult|null; fields:ExplorationFields|null;
 current:()=>boolean; signal?:AbortSignal; budget?:GatewayBudget; yield?:()=>Promise<void>;
}):Promise<ExplorationResult>{
 const {request,graph,labels,source,poi,stations,fields}=input;
 const budget=input.budget??new GatewayBudget();
 const answer:ExplorationResult={status:'unavailable',reason:null,world:null,worldArrival:null,transfer:null,start:null,arrival:null,legs:[],final:null,
  fieldSource:null,usage:budget.used,timings:{world:0,entrance:0,gateway:0,local:0},reusedWorld:false};
 const finish=(status:ExplorationResult['status'],reason:string|null=null)=>({...answer,status,reason});
 const current=()=>input.current()&&(!fields||fields.current())&&!input.signal?.aborted;
 if(!current())return finish('cancelled');
 const entrance=poi.entrances.find(row=>row.id===request.entranceId&&row.scenario===request.entranceScenario);
 const last=stations.at(-1);
 if(!entrance||!last||entrance.location_id!==last.locationId)return finish('unresolved','entrance');
 if(poi.sources['wm0.map']!==source.wm0||source.wm0!==graph.sourceHash)return finish('unresolved','source_mismatch');
 const locked=[...stations.slice(0,-1),lockExplorationEntrance(last,graph,entrance)];
 if(locked.some(station=>station.reason||!station.endpoints.length)||locked.length<2)return finish('unresolved','entrance');
 const worldStarted=performance.now();
 answer.reusedWorld=!!input.journey&&matchesJourney(input.journey,graph,labels,locked,request.scenario,source);
 const world=answer.reusedWorld?input.journey!:await solveJourney(graph,labels,locked,request.scenario,source,input.solve,current);
 answer.timings.world=performance.now()-worldStarted;
 if(!current()||world.status==='cancelled')return finish('cancelled');
 answer.world=world;
 if(world.status!=='success')return finish(world.reason==='no_common_component'||world.reason==='no_eligible_nodes'?'not_connected':'unavailable',world.reason);
 const end=world.legs.at(-1)!;
 const worldTriangle=entrance.trigger_triangle_ids.find(triangle=>graph.lineage.get(`${entrance.section_id}/${entrance.mesh_id}/${triangle}`)===end.endNode);
 if(end.targetEntrance!==entrance.id||worldTriangle===undefined)return finish('unresolved','entrance');
 answer.worldArrival={entranceId:entrance.id,node:end.endNode,section:entrance.section_id,mesh:entrance.mesh_id,triangle:worldTriangle};
 if(!fields)return finish('unavailable','field_resources');
 const resources=fields.gateway;
 if(resources.identity.generation!==source.generation||resources.poi!==poi||resources.identity.sources['wm0.map']!==source.wm0)return finish('unresolved','source_mismatch');
 if(!resources.pack.scenes.has(request.targetField))return finish('unavailable','mesh_unavailable');
 let engine:FieldGatewayNetwork;
 try{engine=new FieldGatewayNetwork(resources);}catch{return finish('unresolved','source_mismatch');}
 let prepared:Promise<{candidates:number[];line?:LocalWitness['line']}>|undefined;
 let localFailure:string|null=null;

 async function prepare(target:ExplorationTarget,mesh:Scene['mesh']){
  if(target.kind==='triangle'){
   if(Number.isInteger(target.triangle)&&target.triangle>=0&&target.triangle<mesh.triangles)return {candidates:[target.triangle]};
   localFailure='invalid_triangle';return {candidates:[]};
  }
  const pack=fields!.interaction;
  if(!pack){localFailure='interaction_missing';return {candidates:[]};}
  const source=resources.identity;
  if(pack.contextSHA256&&pack.contextSHA256!==source.contextSHA256||[source.archive,'maplist'].some(key=>pack.sources[key]!==source.sources[key])){
   localFailure='source_mismatch';return {candidates:[]};
  }
  // The reader verifies Context/decoder at open and hashes the actual Section 5 and scene payload at decode.
  const scene=await pack.decode(request.targetField,mesh,input.signal);
  if(!current())return {candidates:[]};
  const line=scene.records.find(r=>r.kind==='line'&&r.offset===target.offset);
  if(!line||line.static!==true||line.geometry?.relation!=='surface'){
   localFailure=line?.geometry?.relation??'line_unavailable';return {candidates:[]};
  }
  const candidates:number[]=[];
  budget.spend('checks',mesh.triangles);
  const relation=gatewayRelation(mesh,line.a!,line.b!,candidates);
  if(relation!=='surface'||candidates.join()!==line.geometry.candidates.join()){
   localFailure='source_mismatch';return {candidates:[]};
  }
  return {candidates,line:{key:line.key,offset:line.offset,section1SHA256:scene.section1SHA256,section5SHA256:scene.section5SHA256!,interactionSHA256:fields!.interactionSHA256}};
 }

 async function accept(point:GatewayPoint,{mesh,network}:Scene){
  const target=request.target!;
  const began=performance.now();
  try{
   const {candidates,line}=await (prepared??=prepare(target,mesh));
   if(!current()||!candidates.length)return false;
   budget.spend('checks',3*mesh.triangles);
   const distance=network.reach(point.triangle).distance;
   const reachable=candidates.filter(id=>distance[id]>=0).sort((a,b)=>distance[a]-distance[b]||a-b);
   for(const id of reachable){
    budget.spend('checks',distance[id]);
    const path=network.path(point.triangle,id);
    if(path.steps.some(step=>step.mismatch)){localFailure='access_mismatch';continue;}
    const start:GatewayPoint={fieldId:point.fieldId,triangle:point.triangle,xy:point.xy,derivedZ:point.derivedZ};
    answer.final={target,start,candidates,endTriangle:id,path,line};
    return true;
   }
   return false;
  }finally{answer.timings.local+=performance.now()-began;}
 }

 let field:GatewayResult;
 try{
  field=await engine.solve({kind:'world',entranceId:entrance.id},request.targetField,request.maxTransfers,current,
   {budget,accept:request.target?accept:undefined,yield:input.yield});
 }finally{engine.dispose();}
 if(!current()||field.status==='superseded')return finish('cancelled');
 answer.transfer=field.entrance??null;
 const root=field.states[0];
 if(root)answer.start={fieldId:root.fieldId,triangle:root.triangle,xy:root.xy,derivedZ:root.derivedZ};
 answer.fieldSource=field.identity;
 answer.timings.entrance=field.entranceMs??0;
 answer.timings.gateway=Math.max(0,field.milliseconds-answer.timings.entrance-answer.timings.local);
 if(field.status==='success'){
  answer.legs=field.legs;
  answer.arrival=field.legs.at(-1)?.arrival??answer.start;
  return finish('complete');
 }
 if(field.status==='limit')return finish('limited',field.limitReason??'transfers');
 const uncertain=(['access_mismatch','mesh_unavailable','field_unavailable','source_mismatch','target_invalid','unknown'] as const).find(reason=>field.counts[reason]);
 if(field.status==='unreachable')return localFailure||uncertain?finish('unresolved',localFailure??uncertain!):finish('not_connected','unreachable');
 return finish(field.status==='mesh_unavailable'?'unavailable':'unresolved',field.entrance?.reason??field.status);
}
