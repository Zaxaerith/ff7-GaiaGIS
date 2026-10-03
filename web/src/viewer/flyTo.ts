// SPDX-License-Identifier: GPL-3.0-only
import {Quaternion,Vector3} from 'three';
import {wrapLongitude} from '../projections/Projection';
export function shortestLongitude(from:number,to:number,t:number){return wrapLongitude(from+wrapLongitude(to-from)*Math.max(0,Math.min(1,t)));}
export function flyDuration(reducedMotion:boolean){return reducedMotion?0:900;}
export function flyDirection(from:Vector3,to:Vector3,t:number){
  const rotation=new Quaternion().setFromUnitVectors(from.clone().normalize(),to.clone().normalize());
  return from.clone().normalize().applyQuaternion(new Quaternion().slerp(rotation,Math.max(0,Math.min(1,t))));
}
