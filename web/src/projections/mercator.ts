// SPDX-License-Identifier: GPL-3.0-only
import {radians} from './Projection';
import type {GaiaProjection} from './Projection';
export function mercatorY(lat:number,limit:number) {return Math.asinh(Math.tan(radians(Math.max(-limit,Math.min(limit,lat)))));}
export const mercator:GaiaProjection={id:'mercator',name:'Mercator',
  project:(lon,lat,_h,c)=>[radians(lon),mercatorY(lat,c.mercatorLimit),0],
  visibility:(_lon,lat,c)=>Math.abs(lat)<=c.mercatorLimit?1:-1,
  bounds:c=>({minX:-Math.PI,maxX:Math.PI,minY:-mercatorY(c.mercatorLimit,c.mercatorLimit),maxY:mercatorY(c.mercatorLimit,c.mercatorLimit)})};
