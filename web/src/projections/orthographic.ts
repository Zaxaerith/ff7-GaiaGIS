// SPDX-License-Identifier: GPL-3.0-only
import {radians} from './Projection';
import type {GaiaProjection} from './Projection';
export const orthographic:GaiaProjection={id:'orthographic',name:'Orthographic',
  project(lon,lat,_h,c){const l=radians(lon-c.centerLon),p=radians(lat),p0=radians(c.centerLat);
    return [Math.cos(p)*Math.sin(l),Math.cos(p0)*Math.sin(p)-Math.sin(p0)*Math.cos(p)*Math.cos(l),0];},
  visibility(lon,lat,c){const p=radians(lat),p0=radians(c.centerLat);const v=Math.sin(p0)*Math.sin(p)+Math.cos(p0)*Math.cos(p)*Math.cos(radians(lon-c.centerLon));return Math.abs(v)<1e-14?0:v;},
  bounds:()=>({minX:-1,maxX:1,minY:-1,maxY:1})};
