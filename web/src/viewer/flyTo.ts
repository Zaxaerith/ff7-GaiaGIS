// SPDX-License-Identifier: GPL-3.0-only
import {Quaternion,Vector3} from 'three';
import {wrapLongitude} from '../projections/Projection';
export function shortestLongitude(from:number,to:number,t:number){return wrapLongitude(from+wrapLongitude(to-from)*Math.max(0,Math.min(1,t)));}
export function flyDuration(reducedMotion:boolean){return reducedMotion?0:900;}
/** Offset the existing camera into the map area left clear by its detail panel.
 * All coordinates are CSS pixels in the viewport used by the existing picker. */
export function detailViewOffset(view:{left:number;top:number;width:number;height:number},detail:{left:number;top:number;right:number;bottom:number}|null){
  if(!detail)return {x:0,y:0};
  const left=Math.max(0,detail.left-view.left),top=Math.max(0,detail.top-view.top),right=Math.min(view.width,detail.right-view.left),bottom=Math.min(view.height,detail.bottom-view.top);
  if(right<=left||bottom<=top)return {x:0,y:0};
  // A bottom sheet spans the map width; desktop details hug the right edge.
  if(right-left>view.width*.8&&top>view.height*.2)return {x:0,y:(view.height-top+12)/2};
  if(left>view.width*.2)return {x:(view.width-left+12)/2,y:0};
  return {x:0,y:0};
}
export function flyDirection(from:Vector3,to:Vector3,t:number){
  const rotation=new Quaternion().setFromUnitVectors(from.clone().normalize(),to.clone().normalize());
  return from.clone().normalize().applyQuaternion(new Quaternion().slerp(rotation,Math.max(0,Math.min(1,t))));
}
