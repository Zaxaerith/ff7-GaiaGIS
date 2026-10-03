// SPDX-License-Identifier: GPL-3.0-only
import {radians} from './Projection';
import type {GaiaProjection} from './Projection';
export const globe:GaiaProjection={id:'globe',name:'Globe',
  project(lon,lat,h,c){const l=radians(lon),p=radians(lat),r=1+h/c.radius;return [r*Math.cos(p)*Math.sin(l),r*Math.sin(p),r*Math.cos(p)*Math.cos(l)];},
  visibility:()=>1,bounds:()=>({minX:-1,maxX:1,minY:-1,maxY:1})};
