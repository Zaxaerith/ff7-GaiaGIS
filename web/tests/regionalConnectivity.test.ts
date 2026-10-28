// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {nativeTriangle} from '../src/analysis/native';
import type {NativePoint} from '../src/analysis/native';
import type {WM0Source} from '../src/analysis/wm0Source';
import {createWM0Source} from '../src/analysis/wm0Source';
import {createWM0Topology,prepareWM0Topology} from '../src/analysis/wm0Topology';
import {createRegionalConnectivity,prepareRegionalConnectivity,releaseRegionalConnectivity,createConnectivityEvidence} from '../src/analysis/regionalConnectivity';
import {parseMesh} from '../src/data/mesh';
import {parsePoi,validatePoiMesh} from '../src/data/poi';
import type {PoiDataset} from '../src/data/poi';
import {parseAtlasPack} from '../src/data/atlas';
import type {AtlasContent} from '../src/data/atlas';

const sha='a'.repeat(64),w=294912,z=229376;
type Points=NativePoint[];
function source(points:Points[],regions=points.map(()=>0)):WM0Source{
 const keys=points.map(p=>p.map(v=>v.join(',')).sort().join('|')),multiplicity=(i:number)=>keys.filter(k=>k===keys[i]).length;
 const metrics=points.map((p,i)=>({...nativeTriangle(p),bounds:[Math.min(...p.map(v=>v[0])),Math.max(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[1]))],duplicateCount:multiplicity(i)}));
 return {count:points.length,sourceSHA:sha,corners:i=>points[i],metrics:i=>metrics[i],source:i=>({mapId:'WM0',sourceSHA:sha,sourceFace:i,wrapOffset:0,origin:0,section:0,mesh:0,triangle:i,region:regions[i],terrain:16,script:5,map:0,texture:0,chocobo:false,capTriangle:null}),summary:{faces:points.length,corners:points.length*3,zeroXZ:metrics.filter(m=>m.zeroXZ).length,degenerate3D:metrics.filter(m=>m.degenerate3D).length,duplicateExcess:points.length-new Set(keys).size,milliseconds:0}};
}
const first:Points=[[10,10,0],[20,10,0],[10,20,0]],second:Points=[[20,10,0],[20,20,0],[10,20,0]];
const build=(s:WM0Source)=>createRegionalConnectivity(s,createWM0Topology(s));
describe('strict regional connectivity',()=>{
 it('cooperative scheduling preserves the same indices and never caches a cancelled partial graph',async()=>{
  const points:Points[]=Array.from({length:2100},(_,i)=>[[i*3,10,0],[i*3+1,10,0],[i*3,11,0]]);let pauses=0;const pause=async()=>{pauses++;};
  const cancelled=source(points);await expect(prepareWM0Topology(cancelled,pause,()=>false)).rejects.toMatchObject({name:'AbortError'});
  const s=source(points),topology=await prepareWM0Topology(s,pause,()=>true);expect(pauses).toBeGreaterThan(1);expect(createWM0Topology(s)).toBe(topology);
  await expect(prepareRegionalConnectivity(s,topology,pause,()=>false)).rejects.toMatchObject({name:'AbortError'});
  const result=await prepareRegionalConnectivity(s,topology,pause,()=>true);expect(result.summary).toMatchObject({faces:2100,componentsA:2100,componentsB:2100,area:1050});expect(createRegionalConnectivity(s,topology)).toBe(result);expect(result.strategies.A.labels[0]).toBe(0);
 });
 it('joins two same-Region faces by a unique full-XYZ edge, retaining minimum identity zero',()=>{const s=source([first,second]),index=build(s);expect(index.summary).toMatchObject({faces:2,regions:1,terrains:1,area:100,componentsA:1,componentsB:1,singletonsA:0});expect([...index.strategies.A.labels]).toEqual([0,0]);expect([...index.strategies.A.members(0)]).toEqual([0,1]);expect(index.strategies.A.components.get(0)).toMatchObject({id:0,count:2,area:100});expect(()=>index.strategies.A.members(9)).toThrow();});
 it('records different original Regions as a boundary and preserves Region16/17 and raw terrain',()=>{const index=build(source([first,second],[16,17]));expect(index.summary).toMatchObject({componentsA:2,componentsB:2,regions:2,confirmedEdges:1,adjacencyPairs:1});expect([...index.strategies.A.regions.keys()]).toEqual([16,17]);const p=index.pairs[0];expect(p).toMatchObject({key:'16/17',edges:1,candidates:0});expect(p.length).toBeCloseTo(Math.sqrt(200));const e=index.edge(p.occurrences[0]);expect(e).toMatchObject({kind:'confirmed',faces:[0,1],regions:[16,17],sourceSHA:sha,incidence:2});expect(e.a).toHaveLength(3);});
 it('does not join faces sharing only a vertex or only projected X/Z',()=>{const vertex=build(source([first,[[10,10,0],[0,10,0],[10,0,0]]]));expect(vertex.summary.componentsA).toBe(2);const elevated=build(source([first,second.map(([x,z,y])=>[x,z,y+7] as NativePoint)]));expect(elevated.summary.componentsA).toBe(2);expect(elevated.summary.confirmedEdges).toBe(0);});
 it('isolates every duplicate member while preserving both face/area contributions',()=>{const index=build(source([first,first]));expect(index.summary).toMatchObject({faces:2,area:100,componentsA:2,singletonsA:2,duplicateIsolatesA:2,nonDuplicateComponentsA:0});expect(index.strategies.A.regions.get(0)?.faces).toBe(2);expect(index.boundaries.ambiguous).toHaveLength(3);});
 it('rejects four-owner nonmanifold edges without choosing a neighbour',()=>{const a:NativePoint=[100,100,0],b:NativePoint=[110,100,0],index=build(source([[[...a],[...b],[100,110,0]],[[...b],[...a],[100,90,0]],[[...a],[...b],[100,110,10]],[[...b],[...a],[100,90,10]]],[0,0,1,1]));expect(index.summary.componentsA).toBe(4);expect(index.summary.confirmedEdges).toBe(0);expect(index.pairs[0]).toMatchObject({edges:0,candidates:1});expect(index.edge(index.boundaries.ambiguous[0]).faces).toHaveLength(4);});
 it('retains truly degenerate and repeated-edge nodes but disallows their connections',()=>{const index=build(source([[[10,10,0],[20,10,0],[30,10,0]],first]));expect(index.summary).toMatchObject({faces:2,componentsA:2});expect([...index.strategies.A.components.values()].filter(c=>c.degenerate3D)).toHaveLength(1);const repeated=build(source([[[10,10,0],[20,10,0],[10,10,0]],first]));expect(repeated.summary.componentsA).toBe(2);expect(repeated.summary.ambiguousEdges).toBeGreaterThan(0);});
 it('allows a vertical three-dimensionally valid face with zero projected area',()=>{const index=build(source([[[100,100,0],[100,110,0],[100,100,10]],[[100,100,0],[100,110,0],[110,100,0]]]));expect(index.summary).toMatchObject({faces:2,componentsA:1,area:50});expect(index.strategies.A.components.get(0)).toMatchObject({zeroXZ:1,degenerate3D:0,count:2});});
 it('adds confirmed X seams only in B even though their raw incidence is one',()=>{const index=build(source([[[0,10,3],[0,20,7],[10,10,0]],[[w,20,7],[w,10,3],[w-10,10,0]]]));expect(index.summary).toMatchObject({componentsA:2,componentsB:1,periodicPairs:1,periodicMerges:1,openEdges:6,unpairedOpenEdges:4});expect([...index.strategies.A.labels]).toEqual([0,1]);expect([...index.strategies.B.labels]).toEqual([0,0]);const e=index.edge(index.boundaries.periodic[0]);expect(e).toMatchObject({kind:'periodic',incidence:1,periodic:{side:'west',status:'paired'}});expect(e.periodic.references[0].face).toBe(1);});
 it('never joins a mismatched seam or Z boundaries',()=>{const diffHeight=build(source([[[0,10,3],[0,20,7],[10,10,0]],[[w,20,8],[w,10,4],[w-10,10,0]]]));expect(diffHeight.summary.componentsB).toBe(2);expect(diffHeight.summary.periodicPairs).toBe(0);const differentRegion=build(source([[[0,10,3],[0,20,7],[10,10,0]],[[w,20,7],[w,10,3],[w-10,10,0]]],[0,1]));expect(differentRegion.summary.componentsB).toBe(2);expect(differentRegion.pairs[0].periodicPairs).toBe(1);const poles=build(source([[[10,0,0],[20,0,0],[10,10,0]],[[20,z,0],[10,z,0],[10,z-10,0]]]));expect(poles.summary).toMatchObject({componentsA:2,componentsB:2,periodicPairs:0});});
 it('shares the original topology index and releases only its own source-keyed aggregation',()=>{const s=source([first,second]),topology=createWM0Topology(s),a=createRegionalConnectivity(s,topology);expect(createRegionalConnectivity(s,topology)).toBe(a);releaseRegionalConnectivity(s);expect(createRegionalConnectivity(s,topology)).not.toBe(a);expect(createWM0Topology(s)).toBe(topology);expect(()=>createRegionalConnectivity(source([first]),topology)).toThrow('identity');expect([...topology.uniqueEdges()]).toHaveLength(topology.summary.edgeKeys);expect(topology.edge(0).id).toBe(0);expect(()=>topology.edge(-1)).toThrow();});
});

function contentFixture(){
 const index=build(source([first,second],[1,2])),entry=(id:string,face:number,triggers=[face])=>({id,world_map:0,location_id:'place',section_id:0,mesh_id:0,triangle_id:face,trigger_triangle_ids:triggers,region_id:face+1,source_script:2,source_kind:'derived_from_entry_trigger',field_name:'scene'});
 const poi={sources:{'wm0.map':sha},entrances:[entry('one',0),entry('two',1)],locations:[{id:'place',primary_entrance:'one',entrance_ids:['one','two'],field_names:['scene']}]} as unknown as PoiDataset;
 const entity=(id:string,kind:string)=>({id,spatialBinding:{kind,...(['location','parent_location','field_parent'].includes(kind)?{locationId:'place'}:{}),...(['field_parent','field_identity'].includes(kind)?{fieldNames:['scene']}:{})}});
 const atlas={schema:'gaiagis-atlas-content',entities:[entity('direct','location'),entity('reward','parent_location'),entity('field-parent','field_parent'),entity('field-only','field_identity')]} as unknown as AtlasContent;
 return {index,poi,atlas};
}
describe('regional content identity',()=>{
 it('leaves a place with no verified entrances unresolved instead of assigning its Atlas reward',()=>{const {index,poi,atlas}=contentFixture();for(const e of poi.entrances)e.source_script=0;const result=createConnectivityEvidence(index,poi,atlas);expect(result.locations.get('place')).toMatchObject({missing:2,A:[],B:[],regions:[]});expect(result.atlas.get('reward')).toMatchObject({status:'no_source',location:null});});
 it('retains multiple entrances and Regions instead of replacing them with a representative anchor',()=>{const {index,poi,atlas}=contentFixture(),e=createConnectivityEvidence(index,poi,atlas);expect(e.status).toBe('linked');expect(e.entrances.get('one')?.representative).toEqual({face:0,region:1,A:0,B:0});expect(e.locations.get('place')).toMatchObject({regions:[1,2],A:[0,1],B:[0,1],entranceIds:['one','two']});expect(e.atlas.get('direct')?.status).toBe('direct');expect(e.atlas.get('reward')?.status).toBe('parent_context');expect(e.atlas.get('field-parent')?.status).toBe('parent_context');expect(e.atlas.get('field-only')).toMatchObject({status:'no_source',location:null});});
 it('shows full trigger membership and unresolved missing sources, never a nearest replacement',()=>{const {index,poi}=contentFixture();poi.entrances[0].trigger_triangle_ids=[0,1];let e=createConnectivityEvidence(index,poi);expect(e.entrances.get('one')).toMatchObject({A:[0,1],regions:[1,2],status:'linked'});poi.entrances[0].trigger_triangle_ids=[0,999];e=createConnectivityEvidence(index,poi);expect(e.entrances.get('one')).toMatchObject({missing:1,status:'unresolved'});expect(e.locations.get('place')?.entranceIds).toEqual(['two']);});
 it('does not link missing, wrong-fingerprint or wrong-script POIs',()=>{const {index,poi}=contentFixture();expect(createConnectivityEvidence(index,null).status).toBe('unavailable');poi.sources['wm0.map']='b'.repeat(64);expect(createConnectivityEvidence(index,poi).entrances.size).toBe(0);poi.sources['wm0.map']=sha;poi.entrances[0].source_script=0;expect(createConnectivityEvidence(index,poi).entrances.get('one')?.status).toBe('unresolved');});
});

const workspace=process.env.GAIA_CONNECTIVITY_WORKSPACE,hasReal=!!workspace&&['gaia-meta.json','gaia-mesh.bin','gaia-poi.json','gaia-atlas.json'].every(name=>existsSync(workspace+'/'+name));
it.skipIf(!hasReal)('real WM0 connectivity matches the reviewed source once',()=>{
 const meta=JSON.parse(readFileSync(workspace+'/gaia-meta.json','utf8')),raw=readFileSync(workspace+'/gaia-mesh.bin'),mesh=parseMesh(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),meta),source=createWM0Source(mesh,meta),topology=createWM0Topology(source),index=createRegionalConnectivity(source,topology),poi=parsePoi(JSON.parse(readFileSync(workspace+'/gaia-poi.json','utf8')),meta),atlas=parseAtlasPack(JSON.parse(readFileSync(workspace+'/gaia-atlas.json','utf8')));
 validatePoiMesh(poi,mesh);const evidence=createConnectivityEvidence(index,poi,atlas);
 expect(index.summary).toMatchObject({faces:142586,regions:18,terrains:29,area:67692515599,componentsA:210,componentsB:210,duplicateIsolatesA:168,singletonsA:172,confirmedEdges:3198,adjacencyPairs:40,periodicPairs:224,periodicMerges:0});
 expect(index.strategies.A.labels).toEqual(index.strategies.B.labels);
 const regionBaseline=[
  [0,4649,2041873529.5,1,4649],[1,4394,2086915153,1,4394],[2,5371,2253048175.5,1,5371],
  [3,1657,632719923,3,1655],[4,2707,1191128033.5,2,2705],[5,3822,1485771661,32,3787],
  [6,2115,823567957.5,1,2115],[7,2194,813537039,1,2194],[8,3396,1382751105.5,1,3396],
  [9,6323,2435267178,134,6187],[10,1846,701812581.5,1,1846],[11,8509,3150352654.5,7,8407],
  [12,5330,1974131609.5,5,5252],[13,1531,658892376,8,1512],[14,76,16485229.5,2,66],
  [15,998,330696979.5,2,666],[16,307,105535789.5,1,307],[17,87361,45608028623.5,7,82806]
 ];
 for(const [id,faces,area,components,largest]of regionBaseline)for(const rule of ['A','B'] as const){const r=index.strategies[rule].regions.get(id)!;expect([r.faces,r.area,r.components.length,r.largest.count]).toEqual([faces,area,components,largest]);}
 expect(index.pairs.reduce((sum,p)=>sum+p.length,0)).toBeCloseTo(3304377.6649498106,5);
 expect(index.pairs.filter(p=>p.candidates>0).map(p=>[p.key,p.candidates])).toEqual([['3/4',2]]);
 expect(index.strategies.A.components.get(0)?.region).toBe(17);
 for(const [region,count]of [[9,134],[11,7],[12,5],[15,2],[17,7]])expect(index.strategies.A.regions.get(region)?.components.length).toBe(count);
 expect(index.strategies.A.regions.get(9)?.duplicateIsolates).toBe(132);expect(index.strategies.A.regions.get(11)?.singletons).toBe(0);
 expect(evidence.entrances.size).toBe(43);expect([...evidence.entrances.values()].every(e=>e.status==='linked')).toBe(true);
 expect(evidence.locations.get('gongaga')?.A).toHaveLength(30);expect(evidence.locations.get('hp-mp-cave')?.A).toHaveLength(8);expect(evidence.locations.get('mythril-mine')?.regions).toEqual([1,2]);
 console.log(JSON.stringify({regionalConnectivity:{summary:index.summary,regions:[...index.strategies.A.regions.values()].map(r=>({id:r.id,faces:r.faces,area:r.area,components:r.components.length,largest:r.largest.count,singletons:r.singletons,duplicateIsolates:r.duplicateIsolates})),pairs:index.pairs.map(p=>({key:p.key,edges:p.edges,length:p.length,candidates:p.candidates})),entrances:evidence.entrances.size,linked:[...evidence.entrances.values()].filter(e=>e.status==='linked').length,milliseconds:index.milliseconds,associationMs:evidence.milliseconds}}));
});
