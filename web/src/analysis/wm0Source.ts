// SPDX-License-Identifier: GPL-3.0-only
import {validateCanonicalMetadata} from '../data/canonical';
import type {GaiaMesh,GaiaMeta,TriangleAttributes} from '../data/mesh';
import {recoverWM0Corners} from '../explorer/sharedSurface';
import {WM0_EXTENT} from '../explorer/coordinates';
import {nativeTriangle,querySurfaces,transectSurfaces,resourceCoverage} from './native';
import type {NativePoint,NativeXZ,SurfaceSource} from './native';

export const WM0_SOURCE_SHA='43e72295212311fcec3a513051a96ca4475185a72211ebc3a5e4f89a50eca78c';
export interface WM0SourceLineage extends TriangleAttributes{
 mapId:'WM0';sourceSHA:string;sourceFace:number;wrapOffset:number;
}
export type WM0Metric=ReturnType<typeof nativeTriangle>&{bounds:number[];duplicateCount:number};
export interface WM0Source extends SurfaceSource<WM0SourceLineage>{
 sourceSHA:string;
 metrics(i:number):WM0Metric;
 summary:{faces:number;corners:number;zeroXZ:number;degenerate3D:number;duplicateExcess:number;milliseconds:number};
}
const cache=new WeakMap<GaiaMesh,WM0Source>();

/** Borrow the V1 owner; retain raw integer corners and light per-face metrics only. */
export function createWM0Source(mesh:GaiaMesh,meta:GaiaMeta):WM0Source{
 validateCanonicalMetadata(meta);
 const sourceSHA=(meta as GaiaMeta&{stage1?:{source_wm0_sha256?:string}}).stage1?.source_wm0_sha256?.toLowerCase();
 if(sourceSHA!==WM0_SOURCE_SHA||mesh.sourceTriangleCount!==142586||mesh.sourceTriangleCount!==meta.ff7_triangle_count||mesh.triangleCount!==meta.triangle_count)throw Error('WM0 source recovery requires the supported V1 source identity');
 const previous=cache.get(mesh);if(previous)return previous;
 const began=performance.now(),count=mesh.sourceTriangleCount,points=new Int32Array(count*9),metrics:WM0Metric[]=[],duplicates=new Map<string,number[]>();
 let zeroXZ=0,degenerate3D=0,duplicateExcess=0;
 for(let i=0;i<count;i++){
  const p=recoverWM0Corners(mesh,i);points.set(p.flat(),i*9);
  const m=nativeTriangle(p);zeroXZ+=Number(m.zeroXZ);degenerate3D+=Number(m.degenerate3D);
  metrics.push({...m,bounds:[Math.min(...p.map(v=>v[0])),Math.max(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[1]))],duplicateCount:1});
  const key=p.map(v=>v.join(',')).sort().join('|'),group=duplicates.get(key);if(group)group.push(i);else duplicates.set(key,[i]);
 }
 for(const group of duplicates.values()){duplicateExcess+=group.length-1;if(group.length>1)for(const i of group)metrics[i].duplicateCount=group.length;}
 const valid=(i:number)=>{if(!Number.isInteger(i)||i<0||i>=count)throw Error('WM0 source index');};
 const source:WM0Source={count,sourceSHA,summary:{faces:count,corners:count*3,zeroXZ,degenerate3D,duplicateExcess,milliseconds:performance.now()-began},
  corners(i){valid(i);return [0,1,2].map(j=>Array.from(points.subarray(i*9+j*3,i*9+j*3+3)) as [number,number,number]);},
  metrics(i){valid(i);return metrics[i];},
  source(i){valid(i);return {mapId:'WM0',sourceSHA,sourceFace:i,wrapOffset:0,...mesh.attributes(i)};}};
 cache.set(mesh,source);return source;
}

// Explicit unwrapped X permits eastward/westward seam crossings. Z never wraps;
// V1 polar caps and display projections do not participate in source queries.
export const WM0_QUERY_DOMAIN=[-WM0_EXTENT[0],2*WM0_EXTENT[0],0,WM0_EXTENT[1]] as const;
const empty:SurfaceSource<WM0SourceLineage>={count:0,corners:()=>[],metrics:()=>{throw Error('Empty source');},source:()=>{throw Error('Empty source');}};
function periodicSource(source:WM0Source,min:number,max:number):SurfaceSource<WM0SourceLineage>{
 const width=WM0_EXTENT[0],rounding=4*Number.EPSILON*Math.max(1,Math.abs(min),Math.abs(max));
 const offsets=[-2,-1,0,1,2].map(k=>k*width).filter(offset=>offset<=max+rounding&&offset+width>=min-rounding),count=source.count;
 const index=(i:number)=>i%count,offset=(i:number)=>offsets[Math.floor(i/count)];
 return {count:count*offsets.length,
  corners:i=>source.corners(index(i)).map(([x,z,h])=>[x+offset(i),z,h] as NativePoint),
  metrics(i){const m=source.metrics(index(i)),dx=offset(i);return {...m,bounds:[m.bounds[0]+dx,m.bounds[1]+dx,m.bounds[2],m.bounds[3]]};},
  source:i=>({...source.source(index(i)),wrapOffset:offset(i)})};
}
export function queryWM0(source:WM0Source,position:NativeXZ){
 const parsed=querySurfaces(empty,position),outside=resourceCoverage([WM0_QUERY_DOMAIN],position)==='outside';
 if(outside)return {...parsed,status:'outside' as const};
 const result=querySurfaces(periodicSource(source,parsed.position[0],parsed.position[0]),position);
 return {...result,hits:result.hits.map(h=>({...h,face:h.source.sourceFace}))};
}
export function transectWM0(source:WM0Source,start:NativeXZ,end:NativeXZ){
 if([start,end].some(p=>resourceCoverage([WM0_QUERY_DOMAIN],p)==='outside'))throw Error('WM0 raw transect endpoints outside the explicit unwrapped domain');
 const a=querySurfaces(empty,start).position,b=querySurfaces(empty,end).position;
 const result=transectSurfaces(periodicSource(source,Math.min(a[0],b[0]),Math.max(a[0],b[0])),start,end);
 return {...result,traces:result.traces.map(row=>({...row,face:row.source.sourceFace}))};
}
