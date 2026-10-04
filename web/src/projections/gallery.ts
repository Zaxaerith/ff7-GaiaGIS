// SPDX-License-Identifier: GPL-3.0-only
// Independent spherical forward formulas; references in docs/v1.5/projections.md.
import {radians,wrapLongitude} from './Projection';
import type {GaiaProjection,ProjectionContext,ProjectionId} from './Projection';
type Formula=(lambda:number,phi:number)=>[number,number];
const clamp=(v:number)=>Math.min(1,Math.max(-1,v));
const global=(id:ProjectionId,name:string,forward:Formula):GaiaProjection=>{
  let x=0,y=0;for(let lat=-90;lat<=90;lat++){const p=forward(Math.PI,radians(lat));x=Math.max(x,Math.abs(p[0]));y=Math.max(y,Math.abs(p[1]));}
  return {id,name,project:(lon,lat)=>[...forward(radians(lon),radians(lat)),0],visibility:()=>1,bounds:()=>({minX:-x,maxX:x,minY:-y,maxY:y})};
};
export const equalEarth=global('equal-earth','Equal Earth',(l,p)=>{
  const a=Math.asin(Math.sqrt(3)/2*Math.sin(p)),v=a*a;
  return [2*l*Math.cos(a)/(Math.sqrt(3)*(1.340264-3*.081106*v+7*.000893*v**3+9*.003796*v**4)),a*(1.340264-.081106*v+.000893*v**3+.003796*v**4)];
});
export const winkelTripel=global('winkel-tripel','Winkel Tripel',(l,p)=>{
  const a=Math.acos(clamp(Math.cos(p)*Math.cos(l/2))),s=a<1e-12?1:Math.sin(a)/a;
  return [(2*Math.cos(p)*Math.sin(l/2)/s+l*2/Math.PI)/2,(Math.sin(p)/s+p)/2];
});
// Published 5-degree Robinson control table. Four-point Lagrange interpolation
// is explicit (interpolation variants differ slightly between libraries).
const rx=[1,.9986,.9954,.99,.9822,.973,.96,.9427,.9216,.8962,.8679,.835,.7986,.7597,.7186,.6732,.6213,.5722,.5322];
const ry=[0,.062,.124,.186,.248,.31,.372,.434,.4958,.5571,.6176,.6769,.7346,.7903,.8435,.8936,.9394,.9761,1];
function table(values:number[],at:number){const start=Math.max(0,Math.min(15,Math.floor(at)-1));let value=0;for(let j=start;j<start+4;j++){let basis=1;for(let k=start;k<start+4;k++)if(k!==j)basis*=(at-k)/(j-k);value+=values[j]*basis;}return value;}
export const robinson=global('robinson','Robinson',(l,p)=>{const at=Math.min(18,Math.abs(p)*36/Math.PI);return [.8487*l*table(rx,at),Math.sign(p)*1.3523*table(ry,at)];});
export const naturalEarth=global('natural-earth','Natural Earth I',(l,p)=>{const v=p*p;return [l*(.8707-.131979*v-.013791*v**2+.003971*v**5-.001529*v**6),p*(1.007226+.015085*v-.044475*v**3+.028874*v**4-.005916*v**5)];});
export const sinusoidal=global('sinusoidal','Sinusoidal',(l,p)=>[l*Math.cos(p),p]);
export const gallPeters=global('gall-peters','Gall–Peters',(l,p)=>[l/Math.sqrt(2),Math.sqrt(2)*Math.sin(p)]);
export function azimuthalAngular(lon:number,lat:number,c:ProjectionContext){const l=radians(wrapLongitude(lon-c.centerLon)),p=radians(lat),p0=radians(c.centerLat);const cosine=clamp(Math.sin(p0)*Math.sin(p)+Math.cos(p0)*Math.cos(p)*Math.cos(l));return {cosine,x:Math.cos(p)*Math.sin(l),y:Math.cos(p0)*Math.sin(p)-Math.sin(p0)*Math.cos(p)*Math.cos(l)};}
const azimuthal=(id:ProjectionId,name:string,equalArea:boolean):GaiaProjection=>({id,name,
  project(lon,lat,_h,c){const a=azimuthalAngular(lon,lat,c);if(a.cosine<-1+1e-10)return [0,0,0];const angle=Math.acos(a.cosine),k=equalArea?Math.sqrt(2/(1+a.cosine)):angle<1e-10?1:angle/Math.sin(angle);return [k*a.x,k*a.y,0];},
  visibility(lon,lat,c){return azimuthalAngular(lon,lat,c).cosine<-1+1e-5?-1:1;},
  bounds:()=>{const r=equalArea?2:Math.PI;return {minX:-r,maxX:r,minY:-r,maxY:r};}});
export const laea=azimuthal('laea','Lambert Azimuthal Equal-Area',true);
export const aeqd=azimuthal('aeqd','Azimuthal Equidistant',false);
