// SPDX-License-Identifier: GPL-3.0-only
import type {GaiaProjection,ProjectionContext} from '../projections/Projection';
export function graticulePoints() {
  const points:number[]=[];
  const add=(a:number,b:number,c:number,d:number)=>points.push(a,b,10000,c,d,10000);
  for(let lat=-60;lat<=60;lat+=30) for(let lon=-180;lon<180;lon+=2) add(lon,lat,lon+2,lat);
  for(let lon=-180;lon<=180;lon+=30) for(let lat=-90;lat<90;lat+=2) add(lon,lat,lon,lat+2);
  return new Float32Array(points);
}
export function projectGraticule(geo:Float32Array,p:GaiaProjection,c:ProjectionContext) {
  const positions=new Float32Array(geo.length),mask=new Float32Array(geo.length/3);
  for(let i=0;i<geo.length;i+=3){const point=p.project(geo[i],geo[i+1],geo[i+2],c);positions.set(point,i);if(p.id!=='globe')positions[i+2]=0.0005;mask[i/3]=p.visibility(geo[i],geo[i+1],c);}
  return {positions,mask};
}
