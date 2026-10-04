// SPDX-License-Identifier: GPL-3.0-only
import {projections} from '../projections';
import {rotatesCenter} from '../projections/registry';
import type {ProjectionId,ProjectionContext,GeoPoint} from '../projections/Projection';
import {wrapLongitude} from '../projections/Projection';
const RAD=Math.PI/180,STEP=1e-5;
export function distortion(id:ProjectionId,lon:number,lat:number,c:ProjectionContext){if(id==='globe'||Math.abs(lat)>=89.8||Math.abs(wrapLongitude(lon))>179.99)return null;const p=projections[id],h=STEP/RAD;
 const samples=[[lon-h,lat],[lon+h,lat],[lon,lat-h],[lon,lat+h]];if(samples.some(([l,f])=>p.visibility(l,f,c)<.03))return null;
 const [w,e,s,n]=samples.map(([l,f])=>p.project(l,f,0,c)),cos=Math.cos(lat*RAD),j=[(e[0]-w[0])/(2*STEP*cos),(n[0]-s[0])/(2*STEP),(e[1]-w[1])/(2*STEP*cos),(n[1]-s[1])/(2*STEP)];
 if(j.some(x=>!Number.isFinite(x)||Math.abs(x)>1e5))return null;const [a,b,d,e2]=j,area=Math.abs(a*e2-b*d),trace=a*a+b*b+d*d+e2*e2,disc=Math.sqrt(Math.max(0,trace*trace-4*area*area)),max=Math.sqrt(Math.max(0,(trace+disc)/2)),min=max>0?area/max:0;
 return {jacobian:j,areaScale:area,maxScale:max,minScale:min,parallelScale:Math.hypot(a,d),meridionalScale:Math.hypot(b,e2),angularDeformation:2*Math.asin(Math.min(1,Math.max(0,(max-min)/(max+min||1))))/RAD};
}
// Bounded display inversion; never a second coordinate authority or a source-topology operation.
export function inverseDisplay(id:ProjectionId,x:number,y:number,c:ProjectionContext,seed:GeoPoint=[0,0,0]):GeoPoint|null{if(id==='globe'||!Number.isFinite(x+y))return null;const p=projections[id];let best=seed,bestError=Infinity;for(const s of [seed,[c.centerLon,c.centerLat,0] as GeoPoint,...Array.from({length:72},(_,i)=>[-180+(i%12)*30,-75+Math.floor(i/12)*30,0] as GeoPoint)]){const q=p.project(s[0],s[1],0,c),err=Math.hypot(q[0]-x,q[1]-y);if(p.visibility(s[0],s[1],c)>.01&&err<bestError){bestError=err;best=s;}}
 let [lon,lat]=best;for(let i=0;i<24;i++){const q=p.project(lon,lat,0,c),dx=x-q[0],dy=y-q[1];if(Math.hypot(dx,dy)<1e-7)return p.visibility(lon,lat,c)>.01?[wrapLongitude(lon),lat,0]:null;const h=.0001,e=p.project(lon+h,lat,0,c),n=p.project(lon,lat+h,0,c),a=(e[0]-q[0])/h,b=(n[0]-q[0])/h,d=(e[1]-q[1])/h,f=(n[1]-q[1])/h,det=a*f-b*d;if(Math.abs(det)<1e-12)break;lon=wrapLongitude(lon+Math.max(-20,Math.min(20,(dx*f-dy*b)/det)));lat=Math.max(-89.9,Math.min(89.9,lat+Math.max(-15,Math.min(15,(dy*a-dx*d)/det))));}return null;
}
export function tissotFrame(id:ProjectionId,c:ProjectionContext){const positions:number[]=[],mask:number[]=[],radius=2*RAD,steps=32;for(let lat=-60;lat<=60;lat+=30)for(let lon=-150;lon<=150;lon+=30){const metric=distortion(id,lon,lat,c),valid=!!metric&&metric.maxScale<20,center=valid?projections[id].project(lon,lat,0,c):[0,0,0],j=metric?.jacobian??[0,0,0,0];for(let k=0;k<steps;k++)for(const index of [k,k+1]){const t=index*2*Math.PI/steps,e=radius*Math.cos(t),n=radius*Math.sin(t),x=center[0]+j[0]*e+j[1]*n,y=center[1]+j[2]*e+j[3]*n,limit=id==='laea'?2:id==='aeqd'?Math.PI:id==='orthographic'?1:Infinity;positions.push(valid?x:0,valid?y:0,.001);mask.push(valid&&Math.hypot(x,y)<=limit?1:-1);}}return {positions:new Float32Array(positions),mask:new Float32Array(mask)};}
export function linkedContext(id:ProjectionId,c:ProjectionContext,center:GeoPoint){return rotatesCenter(id)?{...c,centerLon:center[0],centerLat:center[1]}:{...c};}
