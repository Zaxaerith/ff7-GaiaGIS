// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect,vi} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parseRouting,connectedComponents,findRoute,entranceEndpoints} from '../src/data/routing';
import type {RoutingData,Endpoint} from '../src/data/routing';
import {parseMesh} from '../src/data/mesh';
import {parsePoi,validatePoiMesh} from '../src/data/poi';
import {solveJourney,journeyProfiles,JOURNEY_MAX_STATIONS} from '../src/navigation/journey';
import type {JourneyStation,JourneyScenario,JourneySource,JourneySolve} from '../src/navigation/journey';
import {routingFixture} from './fixtures/routing';

const scenario:JourneyScenario={profile:'foot',conditional:false};
const source:JourneySource={wm0:'aa'.repeat(32),routing:'bb'.repeat(32),poi:'cc'.repeat(32),atlas:'dd'.repeat(32),generation:0};
const station=(id:string,nodes:number[],entrance=id):JourneyStation=>({id,target:{kind:'location',id},locationId:id,precision:'entrance_level',reason:null,endpoints:nodes.map(node=>({node,entrance}))});
const run=(g:RoutingData,stations:JourneyStation[],context=scenario,solve?:JourneySolve,current=()=>true)=>{
 const labels=connectedComponents(g,context.profile,context.conditional).labels;
 return solveJourney(g,labels,stations,context,source,solve??(async(starts,targets)=>findRoute(g,labels,starts,targets)),current);
};

describe('source-bound ordered Journey composition',()=>{
 it('keeps the actual arrival node even when independent legs share an entrance ID',async()=>{
  const g=parseRouting(routingFixture([0,0,0,0],[[0,1,2],[1,2,3],[2,3,4]])),labels=connectedComponents(g,'foot').labels;
  const calls=vi.fn(async(starts:Endpoint[],targets:Endpoint[])=>findRoute(g,labels,starts,targets));
  const result=await run(g,[station('start',[0]),station('via',[1,2],'shared-door'),station('end',[3])],scenario,calls);
  expect(result.status).toBe('success');expect(result.nodes).toEqual([0,1,2,3]);expect(result.totalDistance).toBe(9);
  expect(result.legs[0].endNode).toBe(1);expect(result.legs[1].startNode).toBe(1);expect(calls.mock.calls[1][0]).toEqual([{node:1,entrance:'shared-door'}]);
  expect(result.legs[0].targetEntrance).toBe(result.legs[1].startEntrance);
 });
 it('rejects an empty all-station component intersection before dispatching a route',async()=>{
  const g=parseRouting(routingFixture([0,0,0,0],[[0,1,1],[2,3,1]])),solve=vi.fn();
  const result=await run(g,[station('start',[0]),station('mine',[1,2],'same-place'),station('end',[3])],scenario,solve);
  expect(result.reason).toBe('no_common_component');expect(result.totalDistance).toBeNull();expect(result.nodes).toEqual([]);expect(solve).not.toHaveBeenCalled();
 });
 it('chooses the smallest common routing component independent of endpoint order',async()=>{
  const g=parseRouting(routingFixture([0,0,0,0],[[0,1,1],[2,3,1]]));
  const result=await run(g,[station('a',[2,0]),station('b',[3,1])]);
  expect(result.commonComponents).toEqual([0,1]);expect(result.component).toBe(0);expect(result.nodes).toEqual([0,1]);
 });
 it('filters first-station candidates using all stations, rather than choosing its primary candidate',async()=>{
  const g=parseRouting(routingFixture([0,0,0,0],[[2,3,1]]));const result=await run(g,[station('a',[0,2]),station('b',[3])]);
  expect(result.status).toBe('success');expect(result.legs[0].startNode).toBe(2);expect(result.nodes).toEqual([2,3]);
 });
 it('accepts node zero and repeated stations on the same node without a fake edge',async()=>{
  const g=parseRouting(routingFixture([0,0],[[0,1,1]]));const result=await run(g,[station('a',[0]),station('b',[0],'other-door'),station('c',[0])]);
  expect(result.status).toBe('success');expect(result.nodes).toEqual([0]);expect(result.totalDistance).toBe(0);expect(result.legs).toHaveLength(2);
  expect(result.legs.every(l=>l.startNode===0&&l.endNode===0)).toBe(true);
 });
 it('retains real return visits and their distance, removing only joint duplicates',async()=>{
  const g=parseRouting(routingFixture([0,0,0],[[0,1,1],[1,2,1]])),a=station('first',[0]),again={...station('return',[0]),target:a.target,locationId:a.locationId};
  const result=await run(g,[a,station('b',[2]),again]);expect(result.nodes).toEqual([0,1,2,1,0]);expect(result.totalDistance).toBe(4);
 });
 it('rejects total-distance overflow even when each verified leg has a finite distance',async()=>{
  const g=parseRouting(routingFixture([0,0,0],[[0,1,1e308],[1,2,1e308]])),result=await run(g,[station('a',[0]),station('b',[1]),station('c',[2])]);
  expect(result.legs).toHaveLength(2);expect(result.legs.every(leg=>Number.isFinite(leg.distance))).toBe(true);
  expect(result.status).toBe('failed');expect(result.reason).toBe('invalid_route');expect(result.totalDistance).toBeNull();expect(result.nodes).toEqual([]);
 });
 it('bounds plans to two through six occurrence IDs without deduplicating target identities',async()=>{
  const g=parseRouting(routingFixture([0,0],[[0,1,1]])),stops=Array.from({length:6},(_,i)=>station('occurrence-'+i,[i%2]));
  expect(JOURNEY_MAX_STATIONS).toBe(6);expect((await run(g,stops)).status).toBe('success');
  expect((await run(g,[...stops,station('seventh',[0])])).reason).toBe('invalid_plan');expect((await run(g,[stops[0]])).reason).toBe('invalid_plan');
  expect((await run(g,[stops[0],stops[0]])).reason).toBe('invalid_plan');
 });
 it('reports source-missing or Field-only target evidence without inventing endpoints',async()=>{
  const g=parseRouting(routingFixture());
  expect((await run(g,[station('a',[0]),{...station('unknown',[]),locationId:null,precision:'unresolved'}])).reason).toBe('unverified_entrance');
  expect((await run(g,[station('a',[0]),{...station('field',[]),locationId:null,precision:'field_only',reason:'field_only'}])).reason).toBe('field_only');
  expect((await run(g,[station('a',[0]),station('bad',[g.count])])).reason).toBe('unverified_entrance');
 });
 it('reports endpoints ineligible for Tiny Bronco instead of creating boarding links',async()=>{
  const g=parseRouting(routingFixture());const result=await run(g,[station('a',[0]),station('b',[3])],{profile:'tiny-bronco',conditional:false});
  expect(result.reason).toBe('no_eligible_nodes');expect(result.totalDistance).toBeNull();
 });
 it('supports only the eight explicit Journey scenarios',async()=>{
  const g=parseRouting(routingFixture()),labels=connectedComponents(g,'foot').labels,stops=[station('a',[0]),station('b',[3])];
  expect(journeyProfiles).toHaveLength(8);expect(journeyProfiles.map(p=>p.id)).not.toContain('highwind-landing');expect(journeyProfiles.map(p=>p.id)).not.toContain('submarine-surface');
  for(const profile of ['highwind-landing','submarine-surface','unknown'])expect((await solveJourney(g,labels,stops,{profile,conditional:false},source,async()=>null)).reason).toBe('invalid_scenario');
  expect((await solveJourney(g,labels,stops,{profile:'foot',conditional:1 as never},source,async()=>null)).reason).toBe('invalid_scenario');
 });
 it.each(['wm0','routing','poi','atlas'] as const)('requires complete source identity for %s',async key=>{
  const g=parseRouting(routingFixture()),labels=connectedComponents(g,'foot').labels;
  expect((await solveJourney(g,labels,[station('a',[0]),station('b',[3])],scenario,{...source,[key]:'changed'},async()=>null)).reason).toBe('source_stale');
 });
 it('allows a POI-only journey without an optional Atlas pack, but rejects wrong WM0/count/generation',async()=>{
  const g=parseRouting(routingFixture()),labels=connectedComponents(g,'foot').labels,stops=[station('a',[0]),station('b',[3])],solve=async(s:Endpoint[],t:Endpoint[])=>findRoute(g,labels,s,t);
  expect((await solveJourney(g,labels,stops,scenario,{...source,atlas:''},solve)).status).toBe('success');
  for(const changed of [{...source,wm0:'ee'.repeat(32)},{...source,generation:-1}])expect((await solveJourney(g,labels,stops,scenario,changed,solve)).reason).toBe('source_stale');
  expect((await solveJourney(g,new Int32Array(1),stops,scenario,source,solve)).reason).toBe('source_stale');
 });
 it('never mixes a profile or conditional policy into later legs',async()=>{
  for(const [terrain,other]of [[13,'foot'],[4,'buggy']] as const){
   const g=parseRouting(routingFixture([0,0,terrain,0],[[0,1,1],[1,2,1],[2,3,1]])),wrong=connectedComponents(g,other,true).labels;
   const result=await solveJourney(g,wrong,[station('a',[0]),station('b',[1]),station('c',[3])],scenario,source,async(s,t)=>findRoute(g,wrong,s,t));
   expect(result.reason).toBe('invalid_route');expect(result.legs).toHaveLength(1);expect(result.nodes).toEqual([]);expect(result.totalDistance).toBeNull();
  }
 });
 it('includes conditional nodes only in the explicitly selected scenario',async()=>{
  const g=parseRouting(routingFixture([0,13,0],[[0,1,1],[1,2,1]])),stops=[station('a',[0]),station('b',[2])];
  expect((await run(g,stops)).reason).toBe('no_common_component');const yes=await run(g,stops,{profile:'foot',conditional:true});
  expect(yes.status).toBe('success');expect(yes.legs[0].scenario).toEqual({profile:'foot',conditional:true});
 });
 it('rejects non-CSR paths and inaccurate distances instead of drawing a straight join',async()=>{
  const g=parseRouting(routingFixture([0,0,0],[[0,1,1],[1,2,1]])),labels=connectedComponents(g,'foot').labels;
  for(const route of [{nodes:[0,2],distance:1},{nodes:[0,1,2],distance:0}]){
   const result=await run(g,[station('a',[0]),station('b',[2])],scenario,async()=>({...route,startEntrance:'a',targetEntrance:'b',component:labels[0]}));
   expect(result.reason).toBe('invalid_route');expect(result.totalDistance).toBeNull();expect(result.nodes).toEqual([]);
  }
 });
 it('rejects an incorrect entrance, component or next seed even if nodes otherwise exist',async()=>{
  const g=parseRouting(routingFixture()),labels=connectedComponents(g,'foot').labels,r=findRoute(g,labels,[{node:0,entrance:'a'}],[{node:3,entrance:'b'}])!;
  for(const change of [{startEntrance:'not-the-source'},{component:99},{nodes:[1,2,3],distance:7}])expect((await run(g,[station('a',[0]),station('b',[3])],scenario,async()=>({...r,...change}))).reason).toBe('invalid_route');
 });
 it('keeps partial diagnostic legs but never a continuous total when a later request fails',async()=>{
  const g=parseRouting(routingFixture()),labels=connectedComponents(g,'foot').labels;let calls=0;
  const result=await run(g,[station('a',[0]),station('b',[1]),station('c',[3])],scenario,async(s,t)=>++calls===1?findRoute(g,labels,s,t):null);
  expect(result.reason).toBe('route_failed');expect(result.failedStation).toBe('c');expect(result.legs).toHaveLength(1);expect(result.totalDistance).toBeNull();expect(result.nodes).toEqual([]);
 });
 it('stops dispatching after source replacement or a newer task supersedes an awaited request',async()=>{
  const g=parseRouting(routingFixture()),labels=connectedComponents(g,'foot').labels;let current=true,calls=0;
  const result=await run(g,[station('a',[0]),station('b',[1]),station('c',[3])],scenario,async(s,t)=>{calls++;current=false;return findRoute(g,labels,s,t);},()=>current);
  expect(result.status).toBe('cancelled');expect(result.reason).toBe('superseded');expect(calls).toBe(1);expect(result.legs).toEqual([]);expect(result.totalDistance).toBeNull();
  const never=vi.fn();expect((await run(g,[station('a',[0]),station('b',[3])],scenario,never,()=>false)).reason).toBe('superseded');expect(never).not.toHaveBeenCalled();
 });
 it('snapshots the selected scenario, source and stop endpoints across async boundaries',async()=>{
  const g=parseRouting(routingFixture()),labels=connectedComponents(g,'foot').labels,mode={...scenario},identity={...source},stops=[station('a',[0]),station('b',[1]),station('c',[3])];let calls=0;
  const result=await solveJourney(g,labels,stops,mode,identity,async(s,t)=>{if(++calls===1){mode.profile='buggy';mode.conditional=true;identity.generation=50;stops[1].endpoints[0].node=99;}return findRoute(g,labels,s,t);});
  expect(result.status).toBe('success');expect(result.scenario).toEqual(scenario);expect(result.source.generation).toBe(0);expect(result.legs.every(l=>l.scenario.profile==='foot'&&!l.scenario.conditional)).toBe(true);
 });
});

const workspace=fileURLToPath(new URL('../../output/local-workspace',import.meta.url));
const files=['gaia-workspace.json','gaia-meta.json','gaia-mesh.bin','gaia-poi.json','gaia-routing.bin'];
describe('optional existing private Workspace Journey checks',()=>{
 it.skipIf(!files.every(file=>existsSync(`${workspace}/${file}`)))('matches continuous and unavailable real-source cases without rebuilding assets',async()=>{
  const json=(file:string)=>JSON.parse(readFileSync(`${workspace}/${file}`,'utf8')),binary=(file:string)=>{const b=readFileSync(`${workspace}/${file}`);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
  const meta=json('gaia-meta.json'),mesh=parseMesh(binary('gaia-mesh.bin'),meta),g=parseRouting(binary('gaia-routing.bin'),meta,mesh),poi=parsePoi(json('gaia-poi.json'),meta),manifest=json('gaia-workspace.json');validatePoiMesh(poi,mesh);
  const provenance:JourneySource={wm0:g.sourceHash,routing:manifest.assets.find((a:{filename:string})=>a.filename==='gaia-routing.bin').sha256,poi:manifest.assets.find((a:{filename:string})=>a.filename==='gaia-poi.json').sha256,atlas:'',generation:0};
  const stop=(id:string,i:number):JourneyStation=>({...station(`${i}:${id}`,[]),target:{kind:'location',id},locationId:id,endpoints:entranceEndpoints(g,poi.entrances.filter(e=>e.location_id===id))});
  const checks:{profile:string;status:string;distance:number|null;legs:number}[]=[];
  const plan=async(ids:string[],profile:string)=>{const c=connectedComponents(g,profile),result=await solveJourney(g,c.labels,ids.map(stop),{profile,conditional:false},provenance,async(s,t)=>findRoute(g,c.labels,s,t));return result;};
  expect(g.count).toBe(142586);expect(g.seamEdges).toBe(224);expect(entranceEndpoints(g,poi.entrances)).toHaveLength(1316);
  for(const [profile,expectedKm]of [['chocobo-green',12404.110],['chocobo-black',9247.792],['chocobo-gold',9000.636]] as const){const r=await plan(['midgar','kalm','junon'],profile);expect(r.status).toBe('success');expect(r.legs[0].endNode).toBe(r.legs[1].startNode);expect(r.totalDistance!/1000).toBeCloseTo(expectedKm,3);checks.push({profile,status:r.status,distance:r.totalDistance,legs:r.legs.length});}
  expect((await plan(['midgar','kalm','junon'],'foot')).reason).toBe('no_common_component');expect((await plan(['midgar','kalm','junon'],'tiny-bronco')).reason).toBe('no_eligible_nodes');
  expect((await plan(['kalm','mythril-mine','junon'],'foot')).reason).toBe('no_common_component');
  const gongaga=stop('gongaga',0),foot=connectedComponents(g,'foot').labels;expect(gongaga.endpoints).toHaveLength(64);expect(new Set(gongaga.endpoints.map(e=>foot[e.node])).size).toBe(30);
  expect((await plan(['costa-del-sol','gongaga'],'buggy')).status).toBe('success');expect((await plan(['costa-del-sol','gongaga'],'foot')).reason).toBe('no_common_component');
  expect((await plan(['kalm','wutai'],'foot')).reason).toBe('no_common_component');expect((await plan(['kalm','wutai'],'chocobo-blue')).status).toBe('success');
  const knights=await plan(['kalm','round-island-cave'],'chocobo-gold');expect(knights.status).toBe('success');expect(knights.totalDistance).toBeCloseTo(10894428.058174929,5);
  expect((await plan(['kalm','round-island-cave'],'chocobo-black')).reason).toBe('no_common_component');
  console.info('Journey real-source summary',JSON.stringify({source:g.sourceHash,checks,knights:knights.totalDistance,gongagaTriggerFaces:gongaga.endpoints.length}));
 });
});
