// SPDX-License-Identifier: GPL-3.0-only
import type {Surface} from './explorer';
import type {SaveBinding} from './save';
import {barycentric} from '../explorer/walker';
/** Exact source triangle containment. Never nearest-centroid snapping. */
export function saveSurfacePoint(surface:Surface,binding:SaveBinding){
 if(surface.header.mapId!=='WM0'||surface.header.extent[0]!==294912||surface.header.extent[1]!==229376)return null;
 const {x,z}=binding.raw;
 for(const triangle of surface.candidates(x,z)){const points=surface.points(triangle),b=barycentric(points,x,z);if(b&&b.every(v=>v>=-1e-6&&v<=1+1e-6))return {triangle,b};}
 return null;
}
