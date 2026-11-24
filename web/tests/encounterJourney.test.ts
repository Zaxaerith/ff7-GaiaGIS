// SPDX-License-Identifier: GPL-3.0-only
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {expect,it} from 'vitest';
import {analyzeEncounterRoute,createEncounterRouteIndex,createEncounterRouteProfile,encounterJourneyRoute} from '../src/analysis/encounterJourney';
import type {EncounterRoute,EncounterRouteResult} from '../src/analysis/encounterJourney';
import {positiveEncounterReferences} from '../src/analysis/encounterGeography';
import {WM0_SOURCE_SHA} from '../src/analysis/wm0Source';
import {decodeEncounterResource,encounterKinds,terrainSlots} from '../src/data/encounters';
import type {EncounterDataset,EncounterResource} from '../src/data/encounters';
import {GameplayIndex,parseGameplay} from '../src/data/gameplay';
import type {GameplayPack,GameplayResource} from '../src/data/gameplay';
import {parseMesh} from '../src/data/mesh';
import type {GaiaMesh,TriangleAttributes} from '../src/data/mesh';
import {parsePoi,validatePoiMesh} from '../src/data/poi';
import {connectedComponents,entranceEndpoints,findRoute,parseRouting} from '../src/data/routing';
import {sourceGeographic,WM0_EXTENT} from '../src/explorer/coordinates';
import {solveJourney,validateJourneyRoute} from '../src/navigation/journey';
import type {JourneyScenario,JourneyStation} from '../src/navigation/journey';
import {exploreWorldField} from '../src/navigation/worldFieldExploration';
import {encounterRouteSegments} from '../src/viewer/route';

const hash='b'.repeat(64);
const source={wm0:WM0_SOURCE_SHA,routing:hash,poi:hash,atlas:'',generation:1};
const foot={profile:'foot',conditional:false},gold={profile:'chocobo-gold',conditional:false};
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const ab=(bytes:Buffer)=>Uint8Array.from(bytes).buffer;
const km=(meters:number|null,expected:number)=>expect(meters!/1000).toBeCloseTo(expected,3);

function fixture(){
 const points=[[0,1024],[128,1024],[0,1152],[128,1152],[1024,1024],[1152,1024],[1024,1152]];
 const indices=new Uint32Array([0,1,2,1,3,2,4,5,6]);
 const attrs=[{region:0,terrain:0,script:0,chocobo:true},{region:0,terrain:0,script:0,chocobo:false},{region:1,terrain:0,script:0,chocobo:false}];
 const mesh={sourceTriangleCount:3,indices,geographic:new Float64Array(points.flatMap(([x,z])=>sourceGeographic(x,z,0))),
  attributes:(node:number)=>({...attrs[node],origin:0,section:0,mesh:0,triangle:node} as TriangleAttributes)} as unknown as GaiaMesh;
 const sets=Array.from({length:64},(_,i)=>({id:`${i>>2}:${i%4}`,active:i!==4,records:Object.fromEntries(encounterKinds.map(kind=>[kind,[] as unknown[]]))}));
 const records=sets[0].records;
 const row=(kind:string,id:number,weight:number,byte_offset:number)=>({encounter_type:kind,scene_id:id,weight,byte_offset});
 records.normal.push(row('normal',0,1,160),row('normal',0,2,162),row('normal',1,1,164),row('normal',4,1,166),row('normal',8,0,168));
 records.chocobo.push(row('chocobo',1,1,170));
 const data={sources:{'wm0.map':WM0_SOURCE_SHA,'world_us.lgp':hash,'enc_w.bin':hash},regions:terrainSlots.map((terrain_slots,id)=>({id,terrain_slots})),encounter_sets:sets} as unknown as EncounterDataset;
 const resource={sha256:hash,data} satisfies EncounterResource;
 const formations=[0,1,4].map(id=>({id,battleId:id,sceneId:id>>2,slot:id%4,status:'parsed',enemyIds:id===0?[9,9]:[9]}));
 const enemies=[0,1].map(sceneId=>({id:9,sceneId,name:'Example',hp:1,mp:1,level:1,slot:0,sourceOffset:0,nameStatus:'decoded'}));
 const links=positiveEncounterReferences(data).map(ref=>({setId:ref.setId,byteOffset:ref.record.byte_offset,encounterType:ref.kind,weight:ref.record.weight,
  battleId:ref.record.scene_id,formationId:ref.record.scene_id,sourceKind:'world_encounter',status:'matched'}));
 const index=new GameplayIndex({sources:{...data.sources,'scene.bin':hash},field:{scenes:[]},battle:{scenes:[],formations,enemies,names:{items:[],materia:[]}},
  links:{encounters:links,assets:{'gaia-encounters.json':{sha256:hash,status:'matched'}}},atlasLinks:[],bossMappings:[]} as unknown as GameplayPack);
 const gameplay={index,contextSHA256:hash,sha256:hash,generation:1};
 return {mesh,attrs,resource,gameplay};
}
function route(legs:number[][],kind:EncounterRoute['kind']='journey'):EncounterRoute{
 return {kind,source,scenario:foot,nodes:legs.flatMap((nodes,i)=>i?nodes.slice(1):nodes),
  legs:legs.map(nodes=>({nodes,distance:nodes.length-1,startEntrance:'example-start',targetEntrance:'example-end'}))};
}
it('counts each Formation and composite Enemy once per traversed half-edge, including across repeated visits',async()=>{
 const {mesh,resource,gameplay}=fixture();
 const profile=createEncounterRouteProfile(mesh,route([[0,1],[1,0]])),index=createEncounterRouteIndex(resource,gameplay,1);
 const result=await analyzeEncounterRoute(profile,index),first=await analyzeEncounterRoute(profile,index,{leg:0}),last=await analyzeEncounterRoute(profile,index,{leg:1});
 expect(result).toMatchObject({status:'complete',relation:'available',faces:2,coverage:1,graphCost:2});
 expect(result.pieces.map(p=>[p.leg,p.ordinal,p.triangle])).toEqual([[0,0,0],[0,1,1],[1,2,1],[1,3,0]]);
 expect(result.length).toBeCloseTo(first.length!+last.length!,8);
 const ordinary=result.rows.candidate.ordinary;
 expect([...ordinary.formation.keys()]).toEqual(['0','1','4']);
 expect(ordinary.formation.get('0')).toMatchObject({distance:result.length,pieces:4,faces:new Set([0,1])});
 expect(ordinary.formation.get('0')!.records.size).toBe(2);
 expect([...ordinary.enemy.keys()]).toEqual(['0/9','1/9']);
 expect(ordinary.enemy.get('0/9')).toMatchObject({distance:result.length,pieces:4,faces:new Set([0,1])});
 expect(ordinary.enemy.get('1/9')!.distance).toBe(result.length);
 expect(result.rows.candidate.chocobo.formation.get('1')!.spans).toHaveLength(2);
 const {ordinary:normal,chocobo,intersection,union}=result.unions;
 expect(chocobo).toBeGreaterThan(0);
 expect(normal+chocobo).toBe(intersection+union);
 expect(union).toBe(normal);
 expect(result.rows.lookup.ordinary.set.get('0:0')!.records.size).toBe(5);
});

it('keeps inactive, zero-weight and scripted lookup evidence separate and degrades when Gameplay cannot be verified',async()=>{
 const {mesh,attrs,resource,gameplay}=fixture();
 attrs[0].script=1;
 attrs[1].region=1;
 const profile=createEncounterRouteProfile(mesh,route([[0,1]]));
 const analyze=(game:GameplayResource|null,r=resource)=>analyzeEncounterRoute(profile,createEncounterRouteIndex(r,game,1));
 const missing=await analyze(null);
 expect(missing).toMatchObject({status:'complete',relation:'gameplay_missing',unions:{ordinary:0,chocobo:0,intersection:0,union:0}});
 expect([...missing.rows.lookup.ordinary.set.keys()]).toEqual(['0:0','1:0']);
 expect(missing.rows.lookup.ordinary.formation.get('0')!.distance).toBeGreaterThan(0);
 expect(missing.rows.lookup.ordinary.formation.has('8')).toBe(false);
 expect(missing.rows.lookup.ordinary.enemy.size).toBe(0);
 expect((await analyze(gameplay,{...resource,sha256:'e'.repeat(64)})).relation).toBe('source_mismatch');
 expect((await analyze({...gameplay,generation:2})).relation).toBe('gameplay_missing');
 gameplay.index.pack.links.encounters.push(gameplay.index.pack.links.encounters[0]);
 expect((await analyze(gameplay)).relation).toBe('invalid_links');
 const stale={...resource,data:{...resource.data,sources:{...resource.data.sources,'wm0.map':hash}}};
 expect(await analyze(gameplay,stale)).toMatchObject({status:'unavailable',reason:'sources',length:null,coverage:null});
});

it('keeps zero-length identity, withholds unknown full denominators, bounds work and refuses cancelled batches',async()=>{
 const {mesh,resource,gameplay}=fixture(),index=createEncounterRouteIndex(resource,gameplay,1);
 const zero=await analyzeEncounterRoute(createEncounterRouteProfile(mesh,route([[0]])),index);
 expect(zero).toMatchObject({length:0,faces:1,coverage:null,pieces:[{triangle:0,distance:0,start:0,end:0}]});
 const partial=createEncounterRouteProfile(mesh,route([[0,1],[1,2]]));
 expect(await analyzeEncounterRoute(partial,index)).toMatchObject({status:'partial',reason:'geometry',length:null,coverage:null,pieces:[]});
 expect((await analyzeEncounterRoute(partial,index,{leg:0})).status).toBe('complete');
 expect((await analyzeEncounterRoute(partial,index,{leg:1})).reason).toBe('geometry');
 const repeated=createEncounterRouteProfile(mesh,route([[0,1],[1,0]]));
 expect(await analyzeEncounterRoute(repeated,index,{limits:{pieces:2}})).toMatchObject({status:'limited',length:null,coverage:null});
 expect((await analyzeEncounterRoute(repeated,index,{leg:0,limits:{pieces:2}})).status).toBe('complete');
 expect((await analyzeEncounterRoute(repeated,index,{limits:{intervals:1}})).status).toBe('limited');
 expect((await analyzeEncounterRoute(repeated,index,{limits:{bytes:191}})).status).toBe('limited');
 let active=true;
 const delay=async(index:number,...args:Parameters<typeof repeated.leg> extends [number,...infer Rest]?Rest:never)=>{
  const pieces=await repeated.leg(index,...args);active=false;return pieces;
 };
 expect(await analyzeEncounterRoute({...repeated,leg:delay},index,{current:()=>active})).toMatchObject({status:'cancelled',pieces:[],length:null});
 const broken=route([[0,1],[2]]);
 expect(await analyzeEncounterRoute(createEncounterRouteProfile(mesh,broken),index)).toMatchObject({status:'unavailable',reason:'route'});
});

it('projects only selected raw half-edges and splits the antimeridian without bridging gaps',()=>{
 const segments=encounterRouteSegments([
  {triangle:0,from:[WM0_EXTENT[0]-128,1024,0],to:[WM0_EXTENT[0]+128,1024,0],distance:1},
  {triangle:1,from:[12000,2048,0],to:[12128,2048,0],distance:1},
  {triangle:2,from:[0,1024,0],to:[0,1024,0],distance:0},
 ]);
 expect(segments).toHaveLength(18);
 expect(segments[3]).toBe(180);
 expect(segments[6]).toBe(-180);
 for(let i=0;i<segments.length;i+=6)expect(Math.abs(segments[i+3]-segments[i])).toBeLessThan(1);
});

const workspace=process.env.GAIA_BROWSER_WORKSPACE??fileURLToPath(new URL('../../output/local-workspace/',import.meta.url));
const files=['gaia-meta.json','gaia-mesh.bin','gaia-poi.json','gaia-routing.bin','gaia-encounters.json','gaia-gameplay.json','gaia-field-context.json'];
it.skipIf(!files.every(name=>existsSync(resolve(workspace,name))))('reproduces the v5.15 cases with the existing private WM0 route and encounter readers',async()=>{
 const read=(name:string)=>readFileSync(resolve(workspace,name)),json=(name:string)=>JSON.parse(read(name).toString());
 const meta=json(files[0]),mesh=parseMesh(ab(read(files[1])),meta),poi=parsePoi(json(files[2]),meta);
 validatePoiMesh(poi,mesh);
 const routing=read(files[3]),graph=parseRouting(ab(routing),meta,mesh),context=read(files[6]);
 const encounter=await decodeEncounterResource(ab(read(files[4])),meta);
 const atlas=readFileSync(new URL('../../src/gaiagis/atlas_data/content.json',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 const gp=read(files[5]),gameplay=new GameplayIndex(parseGameplay(JSON.parse(gp.toString()),JSON.parse(context.toString()),sha(context),sha(Buffer.from(atlas))));
 const sourceId={...source,wm0:graph.sourceHash,routing:sha(routing),poi:sha(read(files[2]))};
 const index=createEncounterRouteIndex(encounter,{index:gameplay,contextSHA256:sha(context),sha256:sha(gp),generation:1},1);
 const labels=new Map([foot,gold].map(s=>[s.profile,connectedComponents(graph,s.profile).labels]));
 const station=(id:string,n:number):JourneyStation=>({id:String(n),target:{kind:'location',id},locationId:id,precision:'entrance_level',reason:null,
  endpoints:entranceEndpoints(graph,poi.entrances.filter(row=>row.location_id===id))});
 const summaries:unknown[]=[];
 async function analyze(name:string,route:EncounterRoute,leg?:number){
  const r=await analyzeEncounterRoute(createEncounterRouteProfile(mesh,route),index,{leg});
  expect(r.status).toBe('complete');
  expect(r.relation).toBe('available');
  summaries.push({name,legs:route.legs.length,leg,cost:r.graphCost,length:r.length,faces:r.faces,sets:r.rows.lookup.ordinary.set.size,strips:r.strips.map(s=>[s.setId,s.start,s.end,s.ordinary,s.chocobo]),unions:r.unions,
   candidateCounts:[...(['ordinary','chocobo'] as const).map(kind=>[r.rows.candidate[kind].formation.size,r.rows.candidate[kind].enemy.size])],usage:r.usage,ms:r.elapsedMs});
  return r;
 }
 async function walk(ids:string[],scenario:JourneyScenario){
  const components=labels.get(scenario.profile)!;
  return solveJourney(graph,components,ids.map(station),scenario,sourceId,async(from,to)=>findRoute(graph,components,from,to));
 }
 function basic(r:EncounterRouteResult,length:number,n:number,faces:number){km(r.length,length);expect([r.pieces.length,r.faces]).toEqual([n,faces]);}
 const forward=await walk(['midgar','kalm'],foot),back=await walk(['kalm','midgar'],foot);
 expect(back.nodes).toEqual([...forward.nodes].reverse());
 const r=await analyze('Midgar-Kalm',encounterJourneyRoute(forward,'journey')),reverse=await analyze('Kalm-Midgar',encounterJourneyRoute(back,'journey'));
 basic(r,2643.448,58,30);basic(reverse,2643.448,58,30);km(r.graphCost,2582.952);km(reverse.graphCost,2582.952);
 expect(r.rows.lookup.ordinary.set.size).toBe(2);
 expect(r.strips.map(s=>[s.setId,s.script,s.ordinary])).toEqual([['0:0',true,false],['0:1',false,true],['0:0',false,true],['0:0',true,false]]);
 expect(reverse.strips.map(s=>s.setId)).toEqual(r.strips.map(s=>s.setId).reverse());
 r.strips.forEach((s,i)=>{km(s.end,[65.450,2048.335,2636.043,2643.448][i]);expect(reverse.strips[3-i].start).toBeCloseTo(r.length!-s.end,7);});
 expect([r.rows.candidate.ordinary.formation.size,r.rows.candidate.ordinary.enemy.size]).toEqual([12,9]);
 km(r.unions.ordinary,2570.593);expect(r.unions.chocobo).toBe(0);
 const f32=r.rows.candidate.ordinary.formation.get('32')!,e74=r.rows.candidate.ordinary.enemy.get('9/74')!;
 expect([f32.pieces,f32.faces.size,f32.spans.length,e74.pieces,e74.faces.size,e74.spans.length]).toEqual([44,22,1,56,28,1]);
 km(f32.distance,1982.885);km(e74.distance,2570.593);
 const roundTrip=await walk(['midgar','kalm','midgar'],foot),roundRoute=encounterJourneyRoute(roundTrip,'journey');
 expect(roundTrip.nodes).toHaveLength(59);expect(roundTrip.legs.map(l=>[l.startNode,l.endNode])).toEqual([[72702,74117],[74117,72702]]);
 const trip=await analyze('Round trip',roundRoute);
 basic(trip,5286.896,116,30);expect(trip.strips).toHaveLength(7);km(trip.unions.ordinary,5141.185);
 const returnF=trip.rows.candidate.ordinary.formation.get('32')!;
 expect([returnF.pieces,returnF.faces.size]).toEqual([88,22]);km(returnF.distance,3965.770);
 const left=await analyze('Round trip leg 1',roundRoute,0),right=await analyze('Round trip leg 2',roundRoute,1);
 expect(trip.length).toBeCloseTo(left.length!+right.length!,7);
 const farm=await analyze('Kalm-Farm',encounterJourneyRoute(await walk(['kalm','chocobo-farm'],gold),'journey'));
 basic(farm,8150.829,212,107);km(farm.unions.ordinary,5932.887);km(farm.unions.chocobo,419.055);
 expect(farm.unions.intersection).toBe(farm.unions.chocobo);expect(farm.unions.union).toBe(farm.unions.ordinary);
 expect([farm.rows.candidate.ordinary.formation.size,farm.rows.candidate.ordinary.enemy.size,farm.rows.candidate.chocobo.formation.size,farm.rows.candidate.chocobo.enemy.size]).toEqual([20,15,4,6]);
 for(const [from,entranceId,node,length,ordinary] of [['kalm','wm0-aa24-4-0-114',96340,9354.388,6684.396],['junon','wm0-ac54-5-0-123',96737,5562.364,5538.580]] as const){
  const entrance=poi.entrances.find(e=>e.id===entranceId)!,components=labels.get(foot.profile)!;
  const result=await exploreWorldField({request:{entranceId,entranceScenario:entrance.scenario as 0|1,targetField:entrance.field_id,maxTransfers:0,target:null,scenario:foot},
   graph,labels:components,source:sourceId,poi,stations:[station(from,0),station('mythril-mine',1)],solve:async(a,b)=>findRoute(graph,components,a,b),fields:null,current:()=>true});
  expect(result).toMatchObject({status:'unavailable',reason:'field_resources',world:{status:'success'},worldArrival:{node}});
  const r=await analyze(`${from}-Mine`,encounterJourneyRoute(result.world!,'world-field'));
  km(r.length,length);km(r.unions.ordinary,ordinary);
 }
 const wutai=await analyze('Kalm-Wutai',encounterJourneyRoute(await walk(['kalm','wutai'],gold),'journey'));
 basic(wutai,19551.958,728,365);
 expect(wutai.pieces.filter(p=>p.lookup.sourceRegion!==p.lookup.effectiveRegion)).toHaveLength(612);
 expect(wutai.pieces.filter(p=>p.lookup.fallback)).toHaveLength(690);
 expect([wutai.rows.lookup.ordinary.formation.size,wutai.rows.candidate.ordinary.formation.size]).toEqual([13,10]);
 async function arc(name:string,from:number,to:number,scenario:JourneyScenario){
  const components=labels.get(scenario.profile)!,starts=[{node:from,entrance:'start'}],targets=[{node:to,entrance:'target'}];
  const path=findRoute(graph,components,starts,targets)!;
  expect(path.nodes).toEqual(from===to?[from]:[from,to]);
  expect(validateJourneyRoute(graph,components,path,starts,targets,components[from],scenario)).toBe(true);
  return analyze(name,{kind:'routing',nodes:path.nodes,legs:[path],source:sourceId,scenario});
 }
 const inactive=await arc('North Corel',65988,65934,gold);km(inactive.length,48.682);
 expect(inactive.strips).toMatchObject([{setId:'13:0',active:false,ordinary:false}]);
 expect(inactive.rows.lookup.ordinary.set.get('13:0')!.records.size+inactive.rows.lookup.chocobo.set.get('13:0')!.records.size).toBe(14);
 expect(inactive.unions.union).toBe(0);
 const seam=await arc('X seam',0,16991,gold);
 expect(seam.pieces.map(p=>[p.lineage,p.script])).toEqual([[[0,0,0],1],[[8,3,15],1]]);
 expect(seam.rows.lookup.ordinary.formation.size).toBe(3);
 expect(seam.unions.union).toBe(0);
 expect((await arc('Zero route',74117,74117,foot)).coverage).toBeNull();
 expect(await walk(['kalm','junon'],foot)).toMatchObject({status:'failed',reason:'no_common_component',nodes:[]});
 console.info(JSON.stringify({encounterJourney:summaries}));
},20000);
