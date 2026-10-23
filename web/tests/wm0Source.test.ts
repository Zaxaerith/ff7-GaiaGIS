// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect,beforeAll} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createWM0Source,queryWM0,transectWM0,WM0_SOURCE_SHA} from '../src/analysis/wm0Source';
import type {WM0Source} from '../src/analysis/wm0Source';
import {nativeTriangle} from '../src/analysis/native';
import type {NativePoint} from '../src/analysis/native';
import {recoverWM0Corners} from '../src/explorer/sharedSurface';
import {WM0_EXTENT,sourceGeographic} from '../src/explorer/coordinates';
import {decodeDataset} from '../src/data/mesh';
import type {GaiaMesh,GaiaMeta,TriangleAttributes} from '../src/data/mesh';

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

const workspace=process.env.GAIA_BROWSER_WORKSPACE??'../output/local-workspace';
describe.skipIf(!existsSync(workspace+'/gaia-mesh.bin')||!existsSync(workspace+'/gaia-meta.json'))('existing private WM0 Workspace source regression',()=>{
 let source:WM0Source,mesh:GaiaMesh,meta:GaiaMeta;
 beforeAll(async()=>{const bytes=readFileSync(workspace+'/gaia-mesh.bin'),dataset=await decodeDataset(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),JSON.parse(readFileSync(workspace+'/gaia-meta.json','utf8')));mesh=dataset.mesh;meta=dataset.meta;source=createWM0Source(mesh,meta);});
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
