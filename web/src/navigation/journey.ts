// SPDX-License-Identifier: GPL-3.0-only
import {routeProfiles,routeState} from '../data/routing';
import type {Endpoint,RoutingData,findRoute} from '../data/routing';

export const JOURNEY_MAX_STATIONS=6;
export const journeyProfiles=routeProfiles.filter(profile=>profile.id!=='submarine-surface');
export type JourneyReason='workspace_missing'|'routing_missing'|'unverified_entrance'|'no_eligible_nodes'|'different_components'|'no_common_component'|'field_only'|'source_stale'|'superseded'|'unsupported_space'|'invalid_plan'|'invalid_scenario'|'invalid_route'|'route_failed';
export interface JourneySource {wm0:string;routing:string;poi:string;atlas:string;generation:number;}
export interface JourneyScenario {profile:string;conditional:boolean;}
export interface JourneyStation {
 id:string;target:{kind:'location'|'entrance'|'atlas';id:string};locationId:string|null;
 precision:'entrance_level'|'parent_place'|'field_only'|'unresolved';reason:JourneyReason|null;endpoints:Endpoint[];
}
export type JourneyRoute=NonNullable<ReturnType<typeof findRoute>>;
export type JourneySolve=(starts:Endpoint[],targets:Endpoint[])=>Promise<JourneyRoute|null>;
export interface JourneyLeg extends JourneyRoute {
 from:string;to:string;startNode:number;endNode:number;scenario:JourneyScenario;source:JourneySource;
}
export interface JourneyResult {
 status:'success'|'failed'|'cancelled';reason:JourneyReason|null;failedStation:string|null;
 legs:JourneyLeg[];nodes:number[];totalDistance:number|null;commonComponents:number[];component:number|null;
 scenario:JourneyScenario;source:JourneySource;
}
const hash=(value:string)=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
const endpointValid=(g:RoutingData,e:Endpoint)=>Number.isInteger(e.node)&&e.node>=0&&e.node<g.count&&typeof e.entrance==='string'&&e.entrance.length>0;
const allowed=(g:RoutingData,node:number,scenario:JourneyScenario)=>{const state=routeState(scenario.profile,g.terrain[node],g.script[node]);return state==='allowed'||scenario.conditional&&state==='conditional';};

/** Validate the existing solver's response, without creating or changing a graph. */
export function validateJourneyRoute(g:RoutingData,labels:Int32Array,route:JourneyRoute,starts:Endpoint[],targets:Endpoint[],component:number,scenario:JourneyScenario){
 if(!route.nodes.length||route.nodes.length>g.count||!Number.isFinite(route.distance)||route.distance<0||route.component!==component)return false;
 const first=route.nodes[0],last=route.nodes.at(-1)!;
 if(!starts.some(e=>e.node===first&&e.entrance===route.startEntrance)||!targets.some(e=>e.node===last&&e.entrance===route.targetEntrance))return false;
 let distance=0;
 for(let i=0;i<route.nodes.length;i++){
  const node=route.nodes[i];if(!Number.isInteger(node)||node<0||node>=g.count||labels[node]!==component||!allowed(g,node,scenario))return false;
  if(!i)continue;const previous=route.nodes[i-1];let found=false;
  for(let j=g.offsets[previous];j<g.offsets[previous+1];j++)if(g.neighbors[j]===node){distance+=g.weights[j];found=true;break;}
  if(!found)return false;
 }
 // Both sums use the same ordered Float64 weights; no geographic estimate enters.
 return distance===route.distance;
}

/** One source-bound, ordered scenario. Dijkstra remains owned by the caller's Worker.
 * Lowest shared routing-component ID is the stable policy, not a global optimum.
 */
export async function solveJourney(g:RoutingData,labels:Int32Array,stations:JourneyStation[],inputScenario:JourneyScenario,inputSource:JourneySource,solve:JourneySolve,isCurrent:()=>boolean=()=>true):Promise<JourneyResult>{
 const scenario={...inputScenario},source={...inputSource},legs:JourneyLeg[]=[],nodes:number[]=[];
 let commonComponents:number[]=[],component:number|null=null;
 const finish=(reason:JourneyReason|null,failedStation:string|null=null):JourneyResult=>{
  const total=reason?null:legs.reduce((sum,leg)=>sum+leg.distance,0);if(total!==null&&!Number.isFinite(total))reason='invalid_route';
  return {status:reason==='superseded'?'cancelled':reason?'failed':'success',reason,failedStation,legs:[...legs],nodes:reason?[]:nodes,totalDistance:reason?null:total,commonComponents,component,scenario,source};
 };
 if(!isCurrent())return finish('superseded');
 if(!hash(source.wm0)||source.wm0.toLowerCase()!==g.sourceHash.toLowerCase()||!hash(source.routing)||!hash(source.poi)||source.atlas!==''&&!hash(source.atlas)||!Number.isSafeInteger(source.generation)||source.generation<0||labels.length!==g.count)return finish('source_stale');
 if(!journeyProfiles.some(profile=>profile.id===scenario.profile)||typeof scenario.conditional!=='boolean')return finish('invalid_scenario');
 if(stations.length<2||stations.length>JOURNEY_MAX_STATIONS||stations.some(s=>!s.id)||new Set(stations.map(s=>s.id)).size!==stations.length)return finish('invalid_plan');
 // Copy the small station endpoint lists; graph buffers and component labels stay shared.
 const stops=stations.map(s=>({...s,target:{...s.target},endpoints:s.endpoints.map(e=>({...e})).sort((a,b)=>a.node-b.node||a.entrance.localeCompare(b.entrance,'en'))}));
 const candidates:Endpoint[][]=[];
 for(const stop of stops){
  if(stop.reason)return finish(stop.reason,stop.id);
  if(!stop.locationId||stop.precision==='unresolved'||!stop.endpoints.length||stop.endpoints.some(e=>!endpointValid(g,e)))return finish(stop.precision==='field_only'?'field_only':'unverified_entrance',stop.id);
  const eligible=stop.endpoints.filter(e=>Number.isInteger(labels[e.node])&&labels[e.node]>=0&&allowed(g,e.node,scenario));
  if(!eligible.length)return finish('no_eligible_nodes',stop.id);
  candidates.push(eligible);
  const ids=new Set(eligible.map(e=>labels[e.node]));commonComponents=candidates.length===1?[...ids]:commonComponents.filter(id=>ids.has(id));
 }
 commonComponents.sort((a,b)=>a-b);
 if(!commonComponents.length)return finish('no_common_component');
 component=commonComponents[0];
 let starts=candidates[0].filter(e=>labels[e.node]===component);
 for(let i=1;i<stops.length;i++){
  if(!isCurrent())return finish('superseded');
  const targets=candidates[i].filter(e=>labels[e.node]===component);let route:JourneyRoute|null;
  try{route=await solve(starts,targets);}catch{return finish(isCurrent()?'route_failed':'superseded',stops[i].id);}
  if(!isCurrent())return finish('superseded');
  if(!route)return finish('route_failed',stops[i].id);
  if(!validateJourneyRoute(g,labels,route,starts,targets,component,scenario))return finish('invalid_route',stops[i].id);
  const startNode=route.nodes[0],endNode=route.nodes.at(-1)!;
  if(legs.length&&legs.at(-1)!.endNode!==startNode)return finish('invalid_route',stops[i].id);
  const leg:JourneyLeg={...route,nodes:[...route.nodes],from:stops[i-1].id,to:stops[i].id,startNode,endNode,scenario:{...scenario},source:{...source}};
  legs.push(leg);for(let j=i===1?0:1;j<leg.nodes.length;j++)nodes.push(leg.nodes[j]);
  // The actual arrival is the only next seed, even within the same entrance ID.
  starts=[{node:endNode,entrance:leg.targetEntrance}];
 }
 return finish(null);
}
