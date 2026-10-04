// SPDX-License-Identifier: GPL-3.0-only
import {Vector3} from 'three';
import type {Camera} from 'three';
import {projections} from '../projections';
import type {ProjectionId,ProjectionContext,GeoPoint} from '../projections/Projection';
import {chooseInterval,minorInterval,visibleGridBounds} from '../analysis/adaptive';
import type {GridMode} from '../analysis/adaptive';
/** Actual forward projection + camera transform, measured in CSS pixels in each viewport. */
export function screenGridPolicy(id:ProjectionId,c:ProjectionContext,camera:Camera,width:number,height:number,center:GeoPoint,mode:GridMode,previous:number,minor:boolean){
 const pixel=(lon:number,lat:number)=>{if(Math.abs(lat)>=89.9||projections[id].visibility(lon,lat,c)<.02)return null;const v=new Vector3(...projections[id].project(lon,lat,0,c));if(id==='globe'&&v.dot(camera.position)-v.lengthSq()<.01)return null;v.project(camera);return Number.isFinite(v.x+v.y)?[v.x*width/2,v.y*height/2]:null;};
 const spacing=(step:number)=>{const spans:number[]=[];for(const [a,b]of [[[center[0]-step/2,center[1]],[center[0]+step/2,center[1]]],[[center[0],center[1]-step/2],[center[0],center[1]+step/2]]]){if(a[0]<-180||b[0]>180)continue;const x=pixel(a[0],a[1]),y=pixel(b[0],b[1]);if(x&&y)spans.push(Math.hypot(y[0]-x[0],y[1]-x[1]));}return spans.length?spans.reduce((a,b)=>a+b,0)/spans.length:NaN;};
 const interval=typeof mode==='number'?mode:chooseInterval(spacing,previous),ppm=spacing(1),bounds=visibleGridBounds(center[0],center[1],Number.isFinite(ppm)?ppm:1,width,height,interval);return {interval,minor:minor?minorInterval(interval,spacing):null,bounds,pixels:spacing(interval)};
}
