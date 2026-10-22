// SPDX-License-Identifier: GPL-3.0-only
import {querySurfaces,transectSurfaces,resourceCoverage,singleSurfaceDelta} from './native';
import type {SurfaceSource,NativeXZ,RawRectangle} from './native';
import {visibleVariantFaces} from '../data/worldVariants';
import type {WorldVariants,VariantFace} from '../data/worldVariants';

/** Owned by one imported research resource; no canonical World/Native data changes. */
export function createVariantComparison(data:WorldVariants){
 const bounds=new WeakMap<VariantFace,ReturnType<SurfaceSource<VariantFace>['metrics']>>();
 const rectangles:RawRectangle[]=[...new Set(data.meshes.map(m=>m[1]))].map(s=>[s%9*32768,s%9*32768+32768,Math.floor(s/9)*32768,Math.floor(s/9)*32768+32768]);
 function source(state:number):SurfaceSource<VariantFace>{
  const rows=visibleVariantFaces(data,state);
  return {count:rows.length,corners:i=>rows[i].points,source:i=>rows[i],metrics(i){const f=rows[i];let m=bounds.get(f);if(!m){m={...f.metrics,bounds:[Math.min(...f.points.map(p=>p[0])),Math.max(...f.points.map(p=>p[0])),Math.min(...f.points.map(p=>p[1])),Math.max(...f.points.map(p=>p[1]))]};bounds.set(f,m);}return m;}};
 }
 return {
  point(leftState:number,rightState:number,position:NativeXZ){const coverage=resourceCoverage(rectangles,position),left={state:leftState,...querySurfaces(source(leftState),position)},right={state:rightState,...querySurfaces(source(rightState),position)};return {coverage,left,right,delta:singleSurfaceDelta(left.hits,right.hits)};},
  transect(leftState:number,rightState:number,start:NativeXZ,end:NativeXZ){return {left:{state:leftState,...transectSurfaces(source(leftState),start,end,rectangles)},right:{state:rightState,...transectSurfaces(source(rightState),start,end,rectangles)}};}
 };
}
export type VariantComparisonQueries=ReturnType<typeof createVariantComparison>;
