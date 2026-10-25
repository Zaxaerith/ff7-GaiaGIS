// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect,beforeAll,vi} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createWM0Source,queryWM0,transectWM0,WM0_SOURCE_SHA} from '../src/analysis/wm0Source';
import type {WM0Source} from '../src/analysis/wm0Source';
import {nativeTriangle} from '../src/analysis/native';
import type {NativePoint} from '../src/analysis/native';
import {recoverWM0Corners} from '../src/explorer/sharedSurface';
import {WM0_EXTENT,sourceGeographic} from '../src/explorer/coordinates';
import {decodeDataset} from '../src/data/mesh';
import type {GaiaMesh,GaiaMeta,TriangleAttributes} from '../src/data/mesh';
import {createWM0Topology,releaseWM0Topology,compareTopologyRouting,topologyFilters} from '../src/analysis/wm0Topology';
import type {RoutingData} from '../src/data/routing';
import {parseRouting} from '../src/data/routing';
import {topologyCatalog} from '../src/i18n/topologyCatalog';
import {dictionaries,locales} from '../src/i18n';

const [W,H]=WM0_EXTENT;
const attrs=(i:number):TriangleAttributes=>({origin:0,map:0,terrain:1,region:2,script:4,texture:7,chocobo:false,section:0,mesh:0,triangle:i,capTriangle:null});
function source(points:NativePoint[][]):WM0Source{
 const metrics=points.map(p=>({...nativeTriangle(p),bounds:[Math.min(...p.map(v=>v[0])),Math.max(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[1]))],duplicateCount:1}));
 return {count:points.length,sourceSHA:WM0_SOURCE_SHA,corners:i=>points[i],metrics:i=>metrics[i],source:i=>({...attrs(i),mapId:'WM0',sourceSHA:WM0_SOURCE_SHA,sourceFace:i,wrapOffset:0}),summary:{faces:points.length,corners:points.length*3,zeroXZ:0,degenerate3D:0,duplicateExcess:0,milliseconds:0}};
}
function transport(points:NativePoint[]):GaiaMesh{
 return {geographic:Float32Array.from(points.flatMap(p=>sourceGeographic(...p))),indices:new Uint32Array([0,1,2]),sourceTriangleCount:1,triangleCount:2,capTriangleCount:1,vertexCount:3,attributes:i=>({...attrs(i),origin:i===0?0:1})};
}
describe('WM0 integer source recovery',()=>{
 it('shares the frozen V1 inverse without building an adjacency graph',()=>{const p:NativePoint[]=[[38269,88205,307],[W,H,462],[0,0,-100]];expect(recoverWM0Corners(transport(p),0)).toEqual(p);});
 it('excludes synthetic faces and ambiguous fractional source corners',()=>{const mesh=transport([[1,1,1],[2,2,2],[3,3,3]]);expect(()=>recoverWM0Corners(mesh,1)).toThrow('source index');expect(()=>recoverWM0Corners(transport([[.5,1,1],[2,2,2],[3,3,3]]),0)).toThrow('ambiguous');});
 it('rejects a source without the approved transport metadata',()=>expect(()=>createWM0Source(transport([[0,0,0],[1,0,0],[0,1,0]]),{} as GaiaMeta)).toThrow());
});
describe('WM0 explicit periodic all-source queries',()=>{
 const triangle:NativePoint[]=[[0,10,0],[4,10,4],[0,14,8]],east:NativePoint[]=[[W,10,20],[W-4,10,24],[W,14,28]];
 it('retains both seam identities at X=0 and X=W with raw source attributes',()=>{
  const s=source([triangle,east]);
  for(const x of [0,W]){const r=queryWM0(s,[x,11]);expect(r.hits.map(h=>h.face).sort()).toEqual([0,1]);expect(r.heightCount).toBe(2);for(const h of r.hits)expect(h.source).toMatchObject({sourceFace:h.face,terrain:1,region:2,script:4,texture:7,section:0});}
  expect(queryWM0(s,[0,11]).hits.map(h=>h.source.wrapOffset)).toEqual([-W,0]);expect(queryWM0(s,[W,11]).hits.map(h=>h.source.wrapOffset)).toEqual([0,W]);
 });
 it('does not merge duplicate, shared-edge, multilevel or vertical sources',()=>{
  const wall:NativePoint[]=[[1,10,0],[1,14,0],[1,10,12]],s=source([triangle,triangle,triangle.map(([x,z,h])=>[x,z,h+10]),wall]);
  const r=queryWM0(s,[1,11]);expect(r.hits.map(h=>h.exactHeights)).toEqual([['3','3'],['3','3'],['13','13'],['0','9']]);expect(r.heightCount).toBe(2);expect(r.hits[3].kind).toBe('vertical');
  const shared=source([triangle,[[4,10,4],[4,14,12],[0,14,8]]]);expect(queryWM0(shared,[2,12]).hits.map(h=>h.face)).toEqual([0,1]);
 });
 it('keeps exact fractional positions across the seam and distinguishes outside Z',()=>{
  const s=source([triangle]);expect(queryWM0(s,['884737/3','31/3']).hits[0].exactHeights).toEqual(['1','1']);
  expect(queryWM0(s,[1,-1]).status).toBe('outside');expect(queryWM0(s,[1,H+1]).hits).toEqual([]);expect(queryWM0(s,['589824.000000000000000001',11]).status).toBe('outside');
  expect(()=>queryWM0(s,['1/0',1])).toThrow();
 });
 it('uses the explicit whole line without silently choosing a shorter direction',()=>{
  const s=source([triangle,east]),direct=transectWM0(s,[W-2,11],[2,11]),cross=transectWM0(s,[W-2,11],[W+2,11]);
  expect(direct.length).toBe(W-4);expect(direct.traces.every(t=>t.source.wrapOffset===0)).toBe(true);expect(cross.length).toBe(4);expect(cross.traces.map(t=>t.source.wrapOffset)).toEqual([0,W]);
  expect(cross.traces.map(t=>t.exactT)).toEqual([['0','1/2'],['1/2','1']]);expect(cross.gaps).toEqual([]);
  const reverse=transectWM0(s,[W+2,11],[W-2,11]);expect(reverse.traces.map(t=>t.face)).toEqual(cross.traces.map(t=>t.face));expect(reverse.traces[0].exactT).toEqual(['1/2','1']);
  expect(transectWM0(s,[-2,11],[2,11]).traces.map(t=>t.source.wrapOffset)).toEqual([-W,0]);
 });
 it('keeps vertical events, bands and point contacts while rejecting a zero length line',()=>{
  const s=source([triangle,[[1,10,0],[1,14,0],[1,10,12]]]);expect(transectWM0(s,[0,11],[2,11]).traces.map(t=>t.kind)).toEqual(['surface','vertical_event']);expect(transectWM0(s,[1,10],[1,14]).traces.map(t=>t.kind)).toContain('vertical_band');expect(transectWM0(s,[5,10],[4,10]).traces[0].kind).toBe('touch');expect(()=>transectWM0(s,[1,11],[1,11])).toThrow('zero-length');expect(()=>transectWM0(s,[0,0],[0,H+1])).toThrow('outside');
 });
});

const workspace=process.env.GAIA_BROWSER_WORKSPACE??fileURLToPath(new URL('../../output/local-workspace',import.meta.url));
function csr(s:WM0Source,links:number[][]):RoutingData{
 const offsets=new Uint32Array(s.count+1);links.forEach((r,i)=>offsets[i+1]=offsets[i]+r.length);
 return {count:s.count,arcs:offsets[s.count],seamEdges:0,offsets,neighbors:Uint32Array.from(links.flat()),weights:new Float64Array(offsets[s.count]),terrain:new Uint8Array(s.count),script:new Uint8Array(s.count),area:new Float64Array(s.count),sourceHash:s.sourceSHA,lineage:new Map(Array.from({length:s.count},(_,i)=>{const a=s.source(i);return [`${a.section}/${a.mesh}/${a.triangle}`,i];}))};
}
describe('WM0 original edge evidence',()=>{
 const a:NativePoint=[10,20,1],b:NativePoint=[20,20,2],c:NativePoint=[10,30,3],d:NativePoint=[10,10,4];
 it('counts ordered occurrences and retains endpoints, identities and reversed orientation',()=>{
  const s=source([[a,b,c],[b,a,d]]),t=createWM0Topology(s),e=t.face(0)[0];
  expect(t.summary).toMatchObject({faces:2,vertexRecords:6,edgeRecords:6,edgeKeys:5,boundaryEdges:4,regularEdges:1,nonmanifoldEdges:0,incidence:{1:4,2:1}});
  expect(e).toMatchObject({slot:0,a,b,incidence:2,references:[{face:0,slot:0},{face:1,slot:0}],uniqueRaw:true});expect(t.face(1)[0]).toMatchObject({a:b,b:a,key:e.key});
  expect(t.faces('boundary')).toEqual([0,1]);expect(t.faces('nonmanifold')).toEqual([]);
 });
 it('isolated face has three boundary edges',()=>{const t=createWM0Topology(source([[a,b,c]]));expect(t.summary.boundaryEdges).toBe(3);expect(t.face(0).every(e=>e.incidence===1)).toBe(true);});
 it('retains all three owners without choosing a neighbor',()=>{
  const t=createWM0Topology(source([[a,b,c],[b,a,d],[a,b,[12,22,9]]]));expect(t.summary.nonmanifoldEdges).toBe(1);expect(t.face(0)[0]).toMatchObject({incidence:3,nonmanifold:true,ambiguous:true,uniqueRaw:false});expect(t.face(0)[0].references.map(r=>r.face)).toEqual([0,1,2]);expect(t.faces('nonmanifold')).toEqual([0,1,2]);
 });
 it('collapsed and same-face repeated edges count records before any deduplication',()=>{
  const t=createWM0Topology(source([[a,a,b]]));expect(t.summary).toMatchObject({edgeKeys:2,collapsedKeys:1,collapsedOccurrences:1,repeatedKeys:1,repeatedOccurrences:2,incidence:{1:1,2:1}});
  expect(t.face(0)[1]).toMatchObject({references:[{face:0,slot:1},{face:0,slot:2}],repeated:true,uniqueRaw:false});expect(t.faces('collapsed')).toEqual([0]);
 });
 it('duplicate geometry retains every face and its related edges',()=>{
  const t=createWM0Topology(source([[a,b,c],[c,b,a],[a,c,b]]));expect(t.summary).toMatchObject({duplicateGroups:1,duplicateFaces:3,duplicateExcess:2,duplicateEdges:3,multiplicity:{3:1},incidence:{3:3}});expect(t.duplicates(2)).toEqual([0,1,2]);expect(t.faces('duplicate')).toEqual([0,1,2]);expect(t.face(1).every(e=>e.duplicate&&!e.uniqueRaw)).toBe(true);
 });
 const west:NativePoint[]=[[0,10,7],[0,20,9],[10,15,8]],east:NativePoint[]=[[W,20,9],[W,10,7],[W-10,15,8]];
 it('X pairing is exact Z/Y evidence and does not change either raw incidence',()=>{
  const s=source([west,east]),t=createWM0Topology(s);expect(t.summary).toMatchObject({edgeKeys:6,boundaryEdges:6,periodicEdges:2,periodicPairs:1,periodicUnresolved:0});expect(t.face(0)[0]).toMatchObject({incidence:1,periodic:{side:'west',status:'paired',references:[{face:1,slot:0}]}});expect(t.face(1)[0].incidence).toBe(1);
  expect(compareTopologyRouting(t,0,csr(s,[[1],[0]]))).toMatchObject({reason:null,raw:[],periodic:[1],routing:[1],shared:[1],geometryOnly:[]});
 });
 it('different Z or Y on the other X boundary remains unresolved',()=>{
  for(const axis of [1,2]){const changed=east.map(p=>p.slice()) as number[][];changed[0][axis]++;const t=createWM0Topology(source([west,changed as unknown as NativePoint[]]));expect(t.summary.periodicPairs).toBe(0);expect(t.face(0)[0]).toMatchObject({geometricAmbiguous:false,periodic:{status:'unmatched'}});expect(t.faces('ambiguous')).toEqual([0,1]);}
 });
 it('an exact X counterpart with multiple occurrences remains a candidate, not a chosen pair',()=>{
  const t=createWM0Topology(source([west,east,west]));expect(t.summary.periodicPairs).toBe(0);expect(t.face(1)[0].periodic).toMatchObject({status:'ambiguous',references:[{face:0,slot:0},{face:2,slot:0}]});expect(t.face(0)[0].incidence).toBe(2);
 });
 it('Z limits never become periodic and equal X/Z at different heights never merge',()=>{
  const lower:NativePoint[]=[[10,0,7],[20,0,9],[15,10,8]],upper=lower.map(([x,z,h])=>[x,H-z,h] as NativePoint),t=createWM0Topology(source([lower,upper]));expect(t.summary).toMatchObject({edgeKeys:6,periodicEdges:0,periodicPairs:0});expect(t.face(0).flatMap(e=>e.references).every(r=>r.face===0)).toBe(true);
  const heights=createWM0Topology(source([[a,b,c],[a,b,c].map(([x,z,h])=>[x,z,h+1])]));expect(heights.summary.edgeKeys).toBe(6);expect(heights.summary.duplicateExcess).toBe(0);
 });
 it('compares real CSR presence independently of geometric co-references and movement modes',()=>{
  const s=source([[a,b,c],[b,a,d]]),t=createWM0Topology(s);expect(compareTopologyRouting(t,0,null)).toMatchObject({reason:'unavailable',raw:[1],routing:[]});expect(compareTopologyRouting(t,0,csr(s,[[],[]]))).toMatchObject({reason:null,geometryOnly:[1]});expect(compareTopologyRouting(t,0,{...csr(s,[[1],[0]]),sourceHash:'f'.repeat(64)}).reason).toBe('source_mismatch');
  const bad=csr(s,[[1],[0]]);bad.lineage.delete('0/0/1');expect(compareTopologyRouting(t,0,bad).reason).toBe('identity_mismatch');
  const missing=csr(s,[[],[]]);missing.lineage.delete('0/0/1');expect(compareTopologyRouting(t,0,missing).reason).toBe('identity_mismatch');
  const disconnected=source([[a,b,c],[[100,20,1],[110,20,2],[100,30,3]]]);expect(compareTopologyRouting(createWM0Topology(disconnected),0,csr(disconnected,[[1],[0]]))).toMatchObject({raw:[],routing:[1],routingOnly:[1]});
 });
 it('source cache and filter results are reused until explicit release or owner replacement',()=>{
  const s=source([[a,b,c]]);s.corners=vi.fn(s.corners);const first=createWM0Topology(s);expect(createWM0Topology(s)).toBe(first);expect(first.faces('all')).toBe(first.faces('all'));for(const filter of topologyFilters)first.faces(filter);expect(s.corners).toHaveBeenCalledTimes(1);
  expect(createWM0Topology(source([[a,b,c]]))).not.toBe(first);releaseWM0Topology(s);expect(createWM0Topology(s)).not.toBe(first);expect(s.corners).toHaveBeenCalledTimes(2);expect(()=>first.face(-1)).toThrow();expect(()=>first.face(1)).toThrow();
 });
 for(const lang of locales)it('topology labels in '+lang,()=>{for(const [key]of topologyCatalog)expect(dictionaries[lang][key]?.length).toBeGreaterThan(0);});
});
describe.skipIf(!existsSync(workspace+'/gaia-mesh.bin')||!existsSync(workspace+'/gaia-meta.json'))('existing private WM0 Workspace source regression',()=>{
 let source:WM0Source,mesh:GaiaMesh,meta:GaiaMeta;
 beforeAll(async()=>{const bytes=readFileSync(workspace+'/gaia-mesh.bin'),dataset=await decodeDataset(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),JSON.parse(readFileSync(workspace+'/gaia-meta.json','utf8')));mesh=dataset.mesh;meta=dataset.meta;source=createWM0Source(mesh,meta);});
 it('indexes the actual complete BASE topology without any polar-cap or GIS regeneration',()=>{
  const t=createWM0Topology(source),s=t.summary;expect(s).toMatchObject({faces:142586,vertexRecords:427758,uniqueVertices:71765,edgeKeys:214270,incidence:{1:1030,2:213116,4:124},collapsedKeys:0,repeatedKeys:0,duplicateGroups:84,duplicateFaces:168,duplicateExcess:84,periodicPairs:224,periodicUnresolved:0});expect(Object.entries(s.incidence).reduce((sum,[count,keys])=>sum+Number(count)*keys,0)).toBe(427758);expect(t.faces('all')).toHaveLength(142586);expect(createWM0Topology(source)).toBe(t);
  console.log(JSON.stringify({wm0Topology:s,filterFaces:Object.fromEntries(topologyFilters.map(f=>[f,t.faces(f).length]))}));
 });
 it.skipIf(!existsSync(workspace+'/gaia-routing.bin'))('compares bounded actual seam and anomaly samples with the existing CSR',()=>{
  const bytes=readFileSync(workspace+'/gaia-routing.bin'),g=parseRouting(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),meta,mesh),topology=createWM0Topology(source),samples=[...new Set([0,...(['periodic','duplicate','nonmanifold','boundary'] as const).flatMap(f=>topology.faces(f).slice(0,2))])];
  const rows=samples.map(face=>{const r=compareTopologyRouting(topology,face,g);expect(r.reason).toBeNull();return {source:source.source(face),raw:r.raw.length,periodic:r.periodic.length,csr:r.routing.length,geometryOnly:r.geometryOnly.length,routingOnly:r.routingOnly.length};});
  console.log(JSON.stringify({wm0TopologyRoutingSamples:rows.map(r=>({identity:`${r.source.section}/${r.source.mesh}/${r.source.triangle}`,raw:r.raw,periodic:r.periodic,csr:r.csr,geometryOnly:r.geometryOnly,routingOnly:r.routingOnly}))}));
 });
 it('recovers every source identity and all 427758 corners against the independent original MAP digest',()=>{
  expect(source.summary).toMatchObject({faces:142586,corners:427758,zeroXZ:246,degenerate3D:0,duplicateExcess:84});expect(createWM0Source(mesh,meta)).toBe(source);expect(()=>source.corners(source.count)).toThrow();
  // Original MAP oracle: section/mesh/triangle as 3 little-endian uint16,
  // then three ordered (X,Z,Y) corners as little-endian int32. No geometry fixture.
  const hash=createHash('sha256'),record=Buffer.alloc(42);
  for(let i=0;i<source.count;i++){const a=source.source(i);[a.section!,a.mesh!,a.triangle!].forEach((v,j)=>record.writeUInt16LE(v,j*2));source.corners(i).flat().forEach((v,j)=>record.writeInt32LE(v,6+j*4));hash.update(record);}
  expect(hash.digest('hex')).toBe('586cd15819e882d818eefc6527b12947f2f234a92670f5f48331b32d4d9467b4');
 });
 it('retains the real multivalue/vertical point and the v4.9 Section 50 sample',()=>{
  const r=queryWM0(source,[38269,88205]);expect(r.hits).toHaveLength(9);expect(r.heightCount).toBe(2);expect(r.hits.filter(h=>h.kind==='vertical').map(h=>h.exactHeights)).toContainEqual(['307','462']);
  const sample=queryWM0(source,['510089/3','547085/3']);expect(sample.hits.map(h=>[h.source.section,h.source.mesh,h.source.triangle,h.exactHeights[0]])).toContainEqual([50,8,15,'1814']);
 });
 it('covers short, long and periodic transects independently of the optional Variant pack',()=>{
  const short=transectWM0(source,[38000,88000],[39000,89000]);expect(short.traces.filter(t=>t.kind==='surface')).toHaveLength(14);expect(short.traces.filter(t=>t.kind==='vertical_event')).toHaveLength(4);
  const long=transectWM0(source,[160000,180000],[180000,180000]);expect(long.traces.filter(t=>t.kind==='surface')).toHaveLength(49);expect(long.gaps).toEqual([]);
  const full=transectWM0(source,[100,100000],[294800,100000]);expect(full.traces.filter(t=>t.kind==='surface')).toHaveLength(631);expect(full.gaps).toEqual([]);
  const seam=transectWM0(source,[W-100,100000],[W+100,100000]);expect(seam.traces.some(t=>t.source.wrapOffset===W)).toBe(true);expect(seam.traces.some(t=>t.source.wrapOffset===0)).toBe(true);expect(seam.gaps).toEqual([]);
  console.log(JSON.stringify({wm0PrepareMs:source.summary.milliseconds,pointMs:queryWM0(source,[38269,88205]).milliseconds,shortMs:short.milliseconds,longMs:long.milliseconds,fullMs:full.milliseconds,seamMs:seam.milliseconds}));
 });
});
