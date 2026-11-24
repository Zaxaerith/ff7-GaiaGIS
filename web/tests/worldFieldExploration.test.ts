// SPDX-License-Identifier: GPL-3.0-only
import {expect,it,vi} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {FieldIndex,WalkmeshNetwork,openWalkmeshPack,parseFieldPack,validateFieldPoi} from '../src/data/fieldContext';
import {openFieldInteraction} from '../src/data/fieldInteraction';
import {parsePoi,validatePoiMesh} from '../src/data/poi';
import type {Entrance,PoiDataset} from '../src/data/poi';
import {parseMesh} from '../src/data/mesh';
import {connectedComponents,entranceEndpoints,findRoute,parseRouting} from '../src/data/routing';
import {solveJourney} from '../src/navigation/journey';
import type {JourneyStation} from '../src/navigation/journey';
import {exploreWorldField} from '../src/navigation/worldFieldExploration';
import type {ExplorationFields,ExplorationRequest} from '../src/navigation/worldFieldExploration';
import {routingFixture} from './fixtures/routing';

const foot={profile:'foot',conditional:false};
const sourceFor=(wm0:string)=>({wm0,routing:'b'.repeat(64),poi:'c'.repeat(64),atlas:'',generation:1});
const station=(id:string,entrances:Entrance[],graph:ReturnType<typeof parseRouting>):JourneyStation=>({
 id,target:{kind:'location',id:entrances[0].location_id},locationId:entrances[0].location_id,
 precision:'entrance_level',reason:null,endpoints:entranceEndpoints(graph,entrances),
});

it('locks the requested alternative on the same Source Node, preserving ordinary Journey behavior',async()=>{
 const graph=parseRouting(routingFixture()),labels=connectedComponents(graph,'foot').labels,source=sourceFor(graph.sourceHash);
 const entry=(id:string,location_id:string,node:number,scenario:number)=>({id,location_id,section_id:0,mesh_id:0,trigger_triangle_ids:[node],scenario}) as Entrance;
 const [origin,standard,alternative]=[entry('origin','a',0,0),entry('default','b',3,0),entry('alternate','b',3,1)];
 const stations=[station('start',[origin],graph),station('end',[standard,alternative],graph)];
 const poi:PoiDataset={schema:'gaiagis-poi',version:1,reconstruction:'v1-geometric-gaia',locations:[],entrances:[origin,standard,alternative],sources:{'wm0.map':graph.sourceHash}};
 const solve=vi.fn(async(from,to)=>findRoute(graph,labels,from,to));
 const ordinary=await solveJourney(graph,labels,stations,foot,source,solve);
 expect(ordinary.legs[0].targetEntrance).toBe('alternate');
 const request:ExplorationRequest={entranceId:'default',entranceScenario:0,targetField:8,maxTransfers:0,target:null,scenario:foot};
 const input={request,graph,labels,source,poi,stations,solve,fields:null,current:()=>true};
 const locked=await exploreWorldField({...input,journey:ordinary});
 expect(locked).toMatchObject({status:'unavailable',reason:'field_resources',reusedWorld:false,worldArrival:{node:3,triangle:3,entranceId:'default'}});
 expect(solve.mock.calls.at(-1)![1]).toEqual([{node:3,entrance:'default'}]);
 expect((await exploreWorldField({...input,journey:locked.world})).reusedWorld).toBe(true);
 expect((await exploreWorldField({...input,journey:{...locked.world!,source:{...source,generation:0}}})).reusedWorld).toBe(false);
 expect(await exploreWorldField({...input,request:{...request,entranceScenario:1}})).toMatchObject({status:'unresolved',reason:'entrance'});
});

it('uses the locked final endpoint in the component check and discards a delayed reply',async()=>{
 const graph=parseRouting(routingFixture([0,0,0],[[0,1,1]])),labels=connectedComponents(graph,'foot').labels,source=sourceFor(graph.sourceHash);
 const [origin,near,far]=[0,1,2].map(node=>({id:String(node),location_id:node?'b':'a',section_id:0,mesh_id:0,trigger_triangle_ids:[node],scenario:0}) as Entrance);
 const stations=[station('start',[origin],graph),station('end',[near,far],graph)];
 const poi:PoiDataset={schema:'gaiagis-poi',version:1,reconstruction:'v1-geometric-gaia',locations:[],entrances:[origin,near,far],sources:{'wm0.map':graph.sourceHash}};
 const solve=vi.fn(async(from,to)=>findRoute(graph,labels,from,to));
 const request:ExplorationRequest={entranceId:far.id,entranceScenario:0,targetField:2,maxTransfers:1,target:null,scenario:foot};
 const input={request,graph,labels,source,poi,stations,solve,fields:null,current:()=>true};
 expect(await exploreWorldField(input)).toMatchObject({status:'not_connected',reason:'no_common_component'});
 expect(solve).not.toHaveBeenCalled();
 let current=true;
 expect(await exploreWorldField({...input,request:{...request,entranceId:near.id},current:()=>current,solve:async(from,to)=>{
  current=false;return findRoute(graph,labels,from,to);
 }})).toMatchObject({status:'cancelled',world:null});
});

const workspace=process.env.GAIA_BROWSER_WORKSPACE??fileURLToPath(new URL('../../output/local-workspace/',import.meta.url));
const files=['gaia-meta.json','gaia-mesh.bin','gaia-poi.json','gaia-routing.bin','gaia-field-context.json','gaia-field-walkmesh.bin','gaia-field-interaction.bin'];
it.skipIf(!files.every(name=>existsSync(resolve(workspace,name))))('composes real Kalm, Midgar, Mine and explicit alternative entrances with local evidence',async()=>{
 const read=(name:string)=>readFileSync(resolve(workspace,name)),sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
 const ab=(bytes:Buffer)=>Uint8Array.from(bytes).buffer;
 const meta=JSON.parse(read(files[0]).toString()),mesh=parseMesh(ab(read(files[1])),meta),poi=parsePoi(JSON.parse(read(files[2]).toString()),meta);
 validatePoiMesh(poi,mesh);
 const routing=read(files[3]),graph=parseRouting(ab(routing),meta,mesh),context=read(files[4]),contextSHA256=sha(context),fieldPack=parseFieldPack(JSON.parse(context.toString()));
 validateFieldPoi(fieldPack,poi);
 const walkmesh=read(files[5]),interactionBytes=read(files[6]);
 const pack=await openWalkmeshPack(new File([walkmesh],files[5]),fieldPack),interaction=await openFieldInteraction(new File([interactionBytes],files[6]),fieldPack,contextSHA256);
 const source={...sourceFor(graph.sourceHash),routing:sha(routing),poi:sha(read(files[2]))};
 const gateway={index:new FieldIndex(fieldPack),poi,pack,identity:{contextSHA256,walkmeshSHA256:sha(walkmesh),generation:1,archive:fieldPack.archive,sources:fieldPack.sources},current:()=>true};
 const fields={gateway,interaction,interactionSHA256:sha(interactionBytes),current:()=>true};
 const from=(locationId:string)=>poi.entrances.filter(row=>row.location_id===locationId);
 const gold={profile:'chocobo-gold',conditional:false};
 const labelSets=new Map([foot,gold].map(scenario=>[scenario.profile,connectedComponents(graph,scenario.profile).labels]));
 const measures:unknown[]=[];
 async function run(origin:string,destination:Entrance,targetField:number,maxTransfers:number,target:ExplorationRequest['target']=null,scenario=foot,resources:ExplorationFields=fields){
  const labels=labelSets.get(scenario.profile)!;
  const result=await exploreWorldField({request:{entranceId:destination.id,entranceScenario:destination.scenario as 0|1,targetField,maxTransfers,target,scenario},
   graph,labels,source,poi,stations:[station('start',from(origin),graph),station('end',from(destination.location_id),graph)],fields:resources,current:()=>true,
   solve:async(starts,ends)=>findRoute(graph,labels,starts,ends)});
  measures.push({origin,entrance:destination.id,targetField,maxTransfers,target,status:result.status,used:result.usage,milliseconds:result.timings});
  return result;
 }
 const kalm=await run('midgar',from('kalm')[0],335,0,{kind:'line',offset:2058});
 expect(kalm).toMatchObject({status:'complete',worldArrival:{node:74117,triangle:106},start:{fieldId:335,triangle:119},legs:[],final:{candidates:[97,98],path:{ids:[119,98],steps:[{offset:3672}]}}});
 expect(new WalkmeshNetwork(await pack.decode(335)).reach(119).ids).toHaveLength(121);
 expect((await run('midgar',from('kalm')[0],335,0,{kind:'triangle',triangle:53})).final?.path.steps).toHaveLength(25);
 expect((await run('midgar',from('kalm')[0],342,2)).legs.map(leg=>[leg.startTriangle,leg.arrival.triangle])).toEqual([[119,33],[33,29]]);
 const midgar=await run('kalm',from('midgar')[0],184,3);
 expect(midgar).toMatchObject({status:'complete',worldArrival:{node:72702},start:{fieldId:170,triangle:16},arrival:{fieldId:184,triangle:129}});
 expect(midgar.legs.map(leg=>[leg.startTriangle,leg.endTriangle,leg.access.length,leg.gateway.gateway,leg.arrival.triangle])).toEqual([[16,50,12,0,30],[30,82,11,2,47],[47,0,37,1,129]]);
 expect(await run('kalm',from('midgar')[0],184,2)).toMatchObject({status:'limited'});
 const [west,east]=from('mythril-mine');
 expect((await run('kalm',west,352,3)).legs.map(leg=>leg.arrival.triangle)).toEqual([17,6]);
 expect(await run('junon',east,352,3)).toMatchObject({status:'not_connected',start:{fieldId:349,triangle:23}});
 expect((await run('junon',east,349,0,{kind:'line',offset:1041})).final?.path.steps).toHaveLength(9);
 expect((await run('kalm',west,349,1,{kind:'line',offset:1078})).final?.path.steps).toHaveLength(11);
 expect(await run('junon',east,349,0,{kind:'line',offset:1078})).toMatchObject({status:'not_connected'});
 expect(await run('midgar',from('kalm')[0],335,0,{kind:'line',offset:2058},foot,{...fields,interaction:null})).toMatchObject({status:'unresolved',reason:'interaction_missing'});
 const altered={...interaction,contextSHA256:'0'.repeat(64)};
 expect(await run('midgar',from('kalm')[0],335,0,{kind:'line',offset:2058},foot,{...fields,interaction:altered})).toMatchObject({status:'unresolved',reason:'source_mismatch'});
 const xyOnly={...interaction,decode:async(id:number,mesh:Parameters<typeof interaction.decode>[1])=>{
  const scene=await interaction.decode(id,mesh);
  return {...scene,records:scene.records.map(r=>r.kind==='line'&&r.offset===2058?{...r,geometry:{...r.geometry!,relation:'xy_only' as const,candidates:[]}}:r)};
 }};
 expect(await run('midgar',from('kalm')[0],335,0,{kind:'line',offset:2058},foot,{...fields,interaction:xyOnly})).toMatchObject({status:'unresolved',reason:'xy_only'});
 expect(await run('midgar',from('kalm')[0],335,0,{kind:'triangle',triangle:53},foot,{...fields,interaction:null})).toMatchObject({status:'complete'});
 expect(await run('kalm',from('junon')[0],349,1)).toMatchObject({status:'not_connected',reason:'no_common_component'});
 for(const [place,expected] of [['chocobo-farm',[[4,343,10],[5,343,79]]],['wutai',[[44,579,122],[45,574,262]]]] as const){
  const entries=from(place);
  expect(entranceEndpoints(graph,[entries[0]]).map(e=>e.node)).toEqual(entranceEndpoints(graph,[entries[1]]).map(e=>e.node));
  for(const [i,entry] of entries.entries()){
   const result=await run('kalm',entry,entry.field_id,0,null,gold);
   expect(result.status).toBe('complete');
   expect([result.transfer?.record?.field_table_record,result.start?.fieldId,result.start?.triangle]).toEqual(expected[i]);
  }
 }
 console.info(JSON.stringify({worldField:measures}));
},20000);
