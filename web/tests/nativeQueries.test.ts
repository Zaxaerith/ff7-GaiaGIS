// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {analyzeNative,queryNative,transectNative} from '../src/analysis/native';
import type {NativePoint} from '../src/analysis/native';
import {decodeNativeMap} from '../src/data/nativeMaps';
import type {NativeMap} from '../src/data/nativeMaps';

const sloped:NativePoint[]=[[0,0,0],[4,0,4],[0,4,8]];
function map(points:NativePoint[][]){return {positions:Float32Array.from(points.flat(2)),sourceTriangleCount:points.length,attributes:(i:number)=>({section:0,mesh:0,triangle:i,terrain:1}),header:{mapId:'WM2',extent:[100,100],source_sha256:'a'.repeat(64)}} as NativeMap;}
function point(points:NativePoint[][],q:[number|string,number|string]){return queryNative(map(points),q);}
describe('Native all-source position query',()=>{
 it('retains reversed winding, duplicates and independent height candidates',()=>{const higher=sloped.map(([x,z,h])=>[x,z,h+10] as NativePoint),r=point([sloped,sloped.slice().reverse(),higher],['1','1']);expect(r.hits.map(h=>h.exactHeights)).toEqual([['3','3'],['3','3'],['13','13']]);expect(r.heightCount).toBe(2);expect(r.status).toBe('multiple');expect(r.hits.map(h=>h.source.triangle)).toEqual([0,1,2]);});
 it('keeps both sides of a shared edge, including equal heights',()=>{const r=point([sloped,[[4,0,4],[4,4,12],[0,4,8]]],[2,2]);expect(r.hits).toHaveLength(2);expect(r.heightCount).toBe(1);});
 it('accepts exact fractional coordinates and does not snap outside points',()=>{expect(point([sloped],['1/3','1/3']).hits[0].exactHeights[0]).toBe('1');expect(point([sloped],['-0.000000000001','0']).hits).toEqual([]);expect(point([sloped],['0','4.000000000000000001']).hits).toEqual([]);expect(point([sloped],['0','3.999999999999999999']).hits).toHaveLength(1);});
 it('reports each vertical interval and independent degenerate line',()=>{const v:NativePoint[]=[[0,0,0],[4,0,0],[0,0,8]],d:NativePoint[]=[[1,0,0],[1,0,3],[1,0,9]],r=point([v,v,d],[1,0]);expect(r.hits.map(h=>[h.kind,h.exactHeights])).toEqual([['vertical',['0','6']],['vertical',['0','6']],['degenerate',['0','9']]]);expect(r.status).toBe('diagnostics');});
 it('separates outside, in-extent uncovered and valid zero height',()=>{expect(point([sloped],[-1,-1]).status).toBe('outside');expect(point([sloped],[10,10]).status).toBe('empty');expect(point([sloped],[0,0]).hits[0].heights).toEqual([0,0]);});
 it('rejects invalid coordinates without interpreting an expression',()=>{for(const x of ['','1/0','1+2','NaN','1000001'])expect(()=>point([sloped],[x,0])).toThrow();});
});
describe('Native source-preserving transect',()=>{
 it('clips exact endpoints, multiple branches and gaps without joining',()=>{const higher=sloped.map(([x,z,h])=>[x,z,h+10] as NativePoint),far=sloped.map(([x,z,h])=>[x+8,z,h] as NativePoint),r=transectNative(map([sloped,higher,far]),[-1,1],[13,1]);expect(r.traces.map(t=>t.kind)).toEqual(['surface','surface','surface']);expect(r.traces[0].exactT).toEqual(['1/14','2/7']);expect(r.gaps).toContainEqual([2/7,9/14]);expect(r.traces[1].path[0][1]-r.traces[0].path[0][1]).toBe(10);});
 it('retains a shared-vertex point contact',()=>{const r=transectNative(map([sloped]),[-1,0],[0,0]);expect(r.traces[0].kind).toBe('touch');expect(r.traces[0].exactT).toEqual(['1','1']);});
 it('represents vertical crossings and collinear bands, including raw heights',()=>{const v:NativePoint[]=[[0,0,0],[4,0,0],[0,0,8]],m=map([v]);const cross=transectNative(m,[1,-1],[1,1]);expect(cross.traces[0].kind).toBe('vertical_event');expect(cross.traces[0].exactPath).toEqual([['1/2','0'],['1/2','6']]);const along=transectNative(m,[0,0],[4,0]);expect(along.traces[0].kind).toBe('vertical_band');expect(along.traces[0].path).toHaveLength(3);expect(along.traces[0].path).toContainEqual([0,8]);});
 it('labels degenerate contacts and overlap separately from surfaces',()=>{const d:NativePoint[]=[[0,0,0],[0,0,3],[0,0,9]];expect(transectNative(map([d]),[-1,0],[1,0]).traces[0].kind).toBe('degenerate_band');expect(()=>transectNative(map([sloped]),[0,0],[0,0])).toThrow('zero-length');});
 it('negative coordinates and reversed endpoints preserve the same sources',()=>{const m=map([sloped.map(([x,z,h])=>[x-10,z-10,h] as NativePoint)]),a=transectNative(m,[-11,-9],[-5,-9]),b=transectNative(m,[-5,-9],[-11,-9]);expect(a.traces[0].face).toBe(b.traces[0].face);expect(a.traces[0].path.map(p=>p[1])).toEqual(b.traces[0].path.map(p=>p[1]).reverse());});
});

const workspace=process.env.GAIA_BROWSER_WORKSPACE??'../output/local-workspace';
it.skipIf(!existsSync(workspace+'/gaia-map-WM2.bin'))('real Native v1 point and short-transect regressions',async()=>{
 for(const id of ['WM2','WM3']){const bytes=readFileSync(`${workspace}/gaia-map-${id}.bin`),m=await decodeNativeMap(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),a=analyzeNative(m),query=(p:[number|string,number|string])=>queryNative(m,p,a),trace=(p:[number|string,number|string],q:[number|string,number|string])=>transectNative(m,p,q,a);
  if(id==='WM2'){
   const r=query([20932,'151699/3']);expect(r.hits.map(h=>h.exactHeights[0])).toEqual(['-10136/3','-463279721/342423','0']);expect(r.hits.map(h=>[h.source.section,h.source.mesh,h.source.triangle])).toEqual([[3,10,31],[3,10,134],[3,10,136]]);
   expect(query([4096,4096]).hits).toHaveLength(2);expect(query(['70139/3',32768]).hits.filter(h=>h.kind==='vertical').map(h=>h.exactHeights)).toEqual(Array.from({length:4},()=>['0','357191/873']));expect(query([48128,37888]).hits.filter(h=>h.kind==='degenerate').map(h=>h.source.triangle)).toEqual([98,101,103,104]);
   const cross=trace(['70139/3',32704],['70139/3',32832]);expect(cross.traces.filter(h=>h.kind==='vertical_event')).toHaveLength(4);expect(trace(['69947/3',32768],['70331/3',32768]).traces.filter(h=>h.kind==='vertical_band')).toHaveLength(4);const multi=trace([20804,'151699/3'],[21060,'151699/3']);expect(multi.traces.filter(t=>t.kind==='surface')).toHaveLength(6);expect(multi.traces.filter(t=>t.kind==='vertical_event')).toHaveLength(2);
   expect(trace([48064,37888],[48192,37888]).traces.filter(t=>t.kind.startsWith('degenerate'))).toHaveLength(4);
  }else{expect(query([512,512]).hits.map(h=>h.source.triangle)).toEqual([0,1]);expect(trace([0,512],[2048,512]).traces.map(t=>t.kind).filter(k=>k==='surface')).toHaveLength(4);}
  expect(query([-1,-1]).status).toBe('outside');console.log(JSON.stringify({map:id,queryMs:query([512,512]).milliseconds,transectMs:trace([0,512],[2048,512]).milliseconds}));
 }
});
