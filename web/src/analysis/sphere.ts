// SPDX-License-Identifier: GPL-3.0-only
import type {GeoPoint} from '../projections/Projection';
import {wrapLongitude} from '../projections/Projection';
export const REFERENCE_RADIUS=6371008.8;
const RAD=Math.PI/180;
type V=[number,number,number];
const dot=(a:V,b:V)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const vector=(p:GeoPoint):V=>[Math.cos(p[1]*RAD)*Math.cos(p[0]*RAD),Math.cos(p[1]*RAD)*Math.sin(p[0]*RAD),Math.sin(p[1]*RAD)];
export function validPoint(p:GeoPoint){if(!p.every(Number.isFinite)||Math.abs(p[1])>90)throw new Error('Invalid geographic measurement point');return [wrapLongitude(p[0]),p[1],0] as GeoPoint;}
export function centralAngle(a:GeoPoint,b:GeoPoint){const u=vector(validPoint(a)),v=vector(validPoint(b));return Math.atan2(Math.hypot(...cross(u,v)),Math.max(-1,Math.min(1,dot(u,v))));}
export function measureDistance(points:GeoPoint[],radius=REFERENCE_RADIUS){if(!(radius>0)||!Number.isFinite(radius))throw new Error('Invalid reference radius');points.forEach(validPoint);const segments=points.slice(1).map((p,i)=>centralAngle(points[i],p)*radius);return {segments,total:segments.reduce((a,b)=>a+b,0)};}
export function greatCircle(a:GeoPoint,b:GeoPoint,stepDegrees=1):GeoPoint[]{const u=vector(validPoint(a)),v=vector(validPoint(b)),angle=centralAngle(a,b);if(Math.PI-angle<1e-7)throw new Error('Antipodal segment has no unique minor great-circle arc');const steps=Math.max(1,Math.ceil(angle/RAD/stepDegrees));if(steps>3600||!(stepDegrees>0))throw new Error('Invalid arc sampling');return Array.from({length:steps+1},(_,i)=>{const f=i/steps,s=Math.sin(angle),x=angle<1e-12?u:u.map((x,j)=>(Math.sin((1-f)*angle)*x+Math.sin(f*angle)*v[j])/s) as V;return [wrapLongitude(Math.atan2(x[1],x[0])/RAD),Math.atan2(x[2],Math.hypot(x[0],x[1]))/RAD,1500];});}
function onArc(a:V,b:V,p:V){const angle=(u:V,v:V)=>Math.atan2(Math.hypot(...cross(u,v)),dot(u,v));return Math.abs(angle(a,p)+angle(p,b)-angle(a,b))<1e-8;}
export function measureArea(input:GeoPoint[],radius=REFERENCE_RADIUS){if(input.length<3||input.length>512||!(radius>0)||!Number.isFinite(radius))throw new Error('A simple polygon needs 3..512 points');const points=input.map(validPoint),v=points.map(vector),n=v.length;
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(centralAngle(points[i],points[j])<1e-10)throw new Error('Repeated spherical polygon vertex');
 for(let i=0;i<n;i++)if(centralAngle(points[i],points[(i+1)%n])>Math.PI-1e-7)throw new Error('Antipodal polygon edge is ambiguous');
 for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){if(i===0&&j===n-1)continue;const q=cross(cross(v[i],v[(i+1)%n]),cross(v[j],v[(j+1)%n])),norm=Math.hypot(...q);if(norm<1e-10)continue;for(const sign of [1,-1]){const p=q.map(x=>x/norm*sign) as V;if(onArc(v[i],v[(i+1)%n],p)&&onArc(v[j],v[(j+1)%n],p))throw new Error('Self-intersecting spherical polygon');}}
 // A reference direction off every edge avoids ambiguous antipodal fan diagonals.
 const sums=v.reduce((a,b)=>a.map((x,i)=>x+b[i]) as V,[0,0,0] as V),candidates:V[]=[sums,[1,.37,.61],[-.23,1,.47],[.53,-.31,1]];
 let reference:V|undefined,quality=-1;for(const raw of candidates){const length=Math.hypot(...raw);if(length<1e-12)continue;const a=raw.map(x=>x/length) as V;let margin=Infinity;for(let i=0;i<n;i++){const b=v[i],d=v[(i+1)%n],det=dot(a,cross(b,d)),den=1+dot(a,b)+dot(b,d)+dot(d,a);margin=Math.min(margin,Math.hypot(det,den),1+dot(a,b));}if(margin>quality){quality=margin;reference=a;}}
 if(!reference||quality<1e-12)throw new Error('Spherical polygon solid-angle ambiguity');let excess=0;for(let i=0;i<n;i++){const a=reference,b=v[i],d=v[(i+1)%n];excess+=2*Math.atan2(dot(a,cross(b,d)),1+dot(a,b)+dot(b,d)+dot(d,a));}const steradians=Math.abs(((excess+2*Math.PI)%(4*Math.PI)+4*Math.PI)%(4*Math.PI)-2*Math.PI);return {area:steradians*radius*radius,percent:steradians/(4*Math.PI)*100,steradians};
}
export function measurementSegments(points:GeoPoint[],closed=false){const line:GeoPoint[]=[];for(let i=1;i<points.length;i++)line.push(...greatCircle(points[i-1],points[i]).slice(line.length?1:0));if(closed&&points.length>=3)line.push(...greatCircle(points.at(-1)!,points[0]).slice(1));return line;}
export interface AnalysisScope {mapId:number;reconstruction:string;radius:number;}
