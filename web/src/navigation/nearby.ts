// SPDX-License-Identifier: GPL-3.0-only
import {REFERENCE_RADIUS,validPoint} from '../analysis/sphere';
import type {GeoPoint} from '../projections/Projection';
import type {IdentityTarget} from '../app/userState';
export interface NearbyAnchor {target:IdentityTarget;name:string;point:GeoPoint;group:'places'|'secrets'|'transitions'|'user';precision:'entrance_level'|'verified_anchor'|'exact_source'|'user_created';}
const vector=([lon,lat]:GeoPoint)=>{const l=lon*Math.PI/180,p=lat*Math.PI/180;return [Math.cos(p)*Math.cos(l),Math.cos(p)*Math.sin(l),Math.sin(p)] as const;};
export class NearbyIndex {
 private rows:{anchor:NearbyAnchor;vector:ReturnType<typeof vector>}[]=[];
 constructor(anchors:NearbyAnchor[]){const ids=new Set<string>();this.rows=anchors.filter(a=>a.target.mapId==='WM0'&&(['entrance_level','verified_anchor','exact_source'].includes(a.precision)||a.precision==='user_created'&&a.target.kind==='user-feature'&&a.group==='user')&&!ids.has(a.target.kind+':'+a.target.id)&&!!ids.add(a.target.kind+':'+a.target.id)).map(anchor=>({anchor,vector:vector(validPoint(anchor.point))}));}
 query(point:GeoPoint,radius=Infinity,limit=20){if(!(radius>=0)||!Number.isFinite(limit)||limit<1)return [];const u=vector(validPoint(point));return this.rows.map(({anchor,vector:v})=>{const dot=u[0]*v[0]+u[1]*v[1]+u[2]*v[2],cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],distance=REFERENCE_RADIUS*Math.atan2(Math.hypot(...cross),Math.min(1,Math.max(-1,dot)));return {...anchor,distance};}).filter(r=>r.distance<=radius).sort((a,b)=>a.distance-b.distance||a.target.id.localeCompare(b.target.id)).slice(0,Math.min(50,limit));}
 get size(){return this.rows.length;}
}
