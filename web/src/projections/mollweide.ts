// SPDX-License-Identifier: GPL-3.0-only
import {radians} from './Projection';
import type {GaiaProjection} from './Projection';
export function mollweideTheta(phi:number) {
  if(Math.abs(Math.abs(phi)-Math.PI/2)<1e-12) return Math.sign(phi)*Math.PI/2;
  const target=Math.PI*Math.sin(phi);
  // sin(phi) rounds to +/-1 extremely near a pole. Solve that exact
  // floating-point target analytically instead of dividing 0 by 0.
  if(Math.abs(target)===Math.PI) return Math.sign(phi)*Math.PI/2;
  let theta=phi;
  for(let i=0;i<30;i++) {
    const step=(2*theta+Math.sin(2*theta)-target)/(2+2*Math.cos(2*theta));
    theta-=step;
    if(Math.abs(step)<1e-13) break;
  }
  return theta;
}
export const mollweide:GaiaProjection={id:'mollweide',name:'Mollweide',
  project(lon,lat){const theta=mollweideTheta(radians(lat));return [2*Math.SQRT2/Math.PI*radians(lon)*Math.cos(theta),Math.SQRT2*Math.sin(theta),0];},
  visibility:()=>1,bounds:()=>({minX:-2*Math.SQRT2,maxX:2*Math.SQRT2,minY:-Math.SQRT2,maxY:Math.SQRT2})};
