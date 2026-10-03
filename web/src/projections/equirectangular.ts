// SPDX-License-Identifier: GPL-3.0-only
import {radians} from './Projection';
import type {GaiaProjection} from './Projection';
export const equirectangular:GaiaProjection={id:'equirectangular',name:'Equirectangular',
  project:(lon,lat)=>[radians(lon),radians(lat),0],visibility:()=>1,
  bounds:()=>({minX:-Math.PI,maxX:Math.PI,minY:-Math.PI/2,maxY:Math.PI/2})};
