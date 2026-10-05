// SPDX-License-Identifier: GPL-3.0-only
import type {SourcePoint,Surface} from '../data/explorer';
import {evaluateTraversal} from '../data/traversal';
export type Barycentric=[number,number,number];
export interface WalkerState {sourceTriangleId:number;barycentricPosition:Barycentric;nativeX:number;nativeZ:number;rawInterpolatedHeight:number;}
export function barycentric(points:SourcePoint[],x:number,z:number):Barycentric|null{
 const [a,b,c]=points,d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-8)return null;
 const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(z-c[1]))/d,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(z-c[1]))/d;return [u,v,1-u-v];
}
export function locate(surface:Surface,triangle:number,b:Barycentric):WalkerState{
 if(b.some(v=>!Number.isFinite(v)||v< -1e-6||v>1+1e-6)||Math.abs(b.reduce((a,c)=>a+c,0)-1)>1e-6)throw Error('Invalid source barycentric placement');
 const p=surface.points(triangle),position=[0,1,2].map(axis=>p.reduce((sum,v,i)=>sum+v[axis]*b[i],0));if(!barycentric(p,position[0],position[1]))throw Error('Degenerate source triangle');
 return {sourceTriangleId:triangle,barycentricPosition:b,nativeX:position[0],nativeZ:position[1],rawInterpolatedHeight:position[2]};
}
export function compatible(surface:Surface,triangle:number,profile:string){
 if(surface.header.mapId!=='WM0')return true;const a=surface.attrs(triangle);return evaluateTraversal(profile,a.terrain,a.script).state==='allowed';
}
export function advance(surface:Surface,state:WalkerState,dx:number,dz:number,profile:string,guard=128):{state:WalkerState;blocked:boolean;reason:string}{
 if(!Number.isFinite(dx)||!Number.isFinite(dz)||Math.hypot(dx,dz)>100000)throw Error('Invalid source displacement');
 let s={...state},tx=state.nativeX+dx,tz=state.nativeZ+dz;
 for(let step=0;step<guard;step++){
  const points=surface.points(s.sourceTriangleId),end=barycentric(points,tx,tz);if(!end)return {state:s,blocked:true,reason:'degenerate'};
  if(end.every(v=>v>=-1e-8))return {state:locate(surface,s.sourceTriangleId,end.map(v=>Math.max(0,v)) as Barycentric),blocked:false,reason:''};
  const ratios=end.map((v,i)=>v< -1e-8?s.barycentricPosition[i]/(s.barycentricPosition[i]-v):Infinity),fraction=Math.min(...ratios),slot=ratios.indexOf(fraction);
  if(ratios.filter(r=>Math.abs(r-fraction)<1e-9).length>1)return {state:s,blocked:true,reason:'ambiguous_vertex'};
  const edge=s.barycentricPosition.map((v,i)=>Math.max(0,v+(end[i]-v)*fraction)) as Barycentric;s=locate(surface,s.sourceTriangleId,edge);
  const next=surface.neighbors(s.sourceTriangleId)[slot];if(next<0||!compatible(surface,next,profile))return {state:s,blocked:true,reason:next<0?'boundary_or_ambiguous':'static_compatibility'};
  const center=surface.points(next).reduce((sum,p)=>sum+p[0]/3,0),width=surface.header.extent[0];let x=s.nativeX;
  if(surface.header.mapId==='WM0'&&Math.abs(center-x)>width/2){const shift=center>x?width:-width;x+=shift;tx+=shift;}
  const b=barycentric(surface.points(next),x,s.nativeZ);if(!b||b.some(v=>v< -1e-5))return {state:s,blocked:true,reason:'unresolved_edge'};
  s=locate(surface,next,b.map(v=>Math.max(0,v)) as Barycentric);
 }
 return {state:s,blocked:true,reason:'crossing_guard'};
}
