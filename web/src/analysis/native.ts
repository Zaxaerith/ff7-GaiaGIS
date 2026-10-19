// SPDX-License-Identifier: GPL-3.0-only
import type {NativeMap} from '../data/nativeMaps';
export type NativePoint=readonly [number,number,number];
export function nativePoint(p:readonly number[]):asserts p is NativePoint{if(p.length!==3||p.some(x=>!Number.isSafeInteger(x)||Math.abs(x)>1_000_000))throw Error('Native integer point');}
export function rawDistance(p:NativePoint,q:NativePoint){nativePoint(p);nativePoint(q);return Math.hypot(q[0]-p[0],q[1]-p[1]);}
export function nativeTriangle(p:readonly NativePoint[]){
 if(p.length!==3)throw Error('Native source triangle');p.forEach(nativePoint);
 const [o,q,r]=p,u=q.map((x,i)=>x-o[i]),v=r.map((x,i)=>x-o[i]);
 const c=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],d=c[2]||0;
 return {determinant:d,area:Math.abs(d)/2,zeroXZ:d===0,degenerate3D:c.every(x=>x===0),a:d===0?null:(-c[0]/d||0),b:d===0?null:(-c[1]/d||0)};
}
export function nativeCorners(map:NativeMap,i:number):NativePoint[]{map.attributes(i);return [0,1,2].map(j=>Array.from(map.positions.subarray(i*9+j*3,i*9+j*3+3)) as [number,number,number]);}
export function nativeNormals(map:NativeMap,i:number){map.attributes(i);return [0,1,2].map(j=>[0,1,2].map(k=>map.records.getInt16(i*72+36+j*6+k*2,true)));}
export function analyzeNative(map:NativeMap){
 const began=performance.now(),n=map.sourceTriangleCount,faces=Array.from({length:n},(_,i)=>({...nativeTriangle(nativeCorners(map,i)),incidence:[0,0,0],collapsed:0,repeated:0,duplicateCount:1,component:0}));
 const edges=new Map<string,{collapsed:boolean;owners:[number,number][]}>(),duplicates=new Map<string,number[]>(),parent=new Int32Array(n);
 const root=(x:number):number=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;};
 for(let i=0;i<n;i++){parent[i]=i;const keys=nativeCorners(map,i).map(p=>p.join(',')),duplicate=keys.slice().sort().join('|'),group=duplicates.get(duplicate)??[];group.push(i);duplicates.set(duplicate,group);
  for(let slot=0;slot<3;slot++){const p=keys[slot],q=keys[(slot+1)%3],key=[p,q].sort().join('|'),edge=edges.get(key)??{collapsed:p===q,owners:[]};edge.owners.push([i,slot]);edges.set(key,edge);}
 }
 let duplicateExcess=0;for(const group of duplicates.values()){duplicateExcess+=group.length-1;for(const i of group)faces[i].duplicateCount=group.length;}
 let incidence1=0,incidence2=0,incidenceGT2=0,collapsedKeys=0,collapsedOccurrences=0;
 for(const e of edges.values()){const count=e.owners.length,owners=new Map<number,number>();for(const [i]of e.owners)owners.set(i,(owners.get(i)??0)+1);
  if(count===1)incidence1++;else if(count===2)incidence2++;else incidenceGT2++;
  if(e.collapsed){collapsedKeys++;collapsedOccurrences+=count;}
  for(const [i,slot]of e.owners){faces[i].incidence[slot]=count;faces[i].collapsed+=Number(e.collapsed);faces[i].repeated+=Number(owners.get(i)!>1);}
  if(!e.collapsed&&count===2&&owners.size===2){const a=root(e.owners[0][0]),b=root(e.owners[1][0]);parent[Math.max(a,b)]=Math.min(a,b);}
 }
 const groups=new Map<number,number>(),sizes:number[]=[],terrain=new Map<number,{faces:number;nonzero:number;zero:number;area:number}>();
 for(let i=0;i<n;i++){const r=root(i);if(!groups.has(r))groups.set(r,groups.size);const id=groups.get(r)!;faces[i].component=id;sizes[id]=(sizes[id]??0)+1;const code=map.attributes(i).terrain!,row=terrain.get(code)??{faces:0,nonzero:0,zero:0,area:0};row.faces++;row.nonzero+=Number(!faces[i].zeroXZ);row.zero+=Number(faces[i].zeroXZ);row.area+=faces[i].area;terrain.set(code,row);}
 return {faces,terrain,summary:{faces:n,zeroXZ:faces.filter(m=>m.zeroXZ).length,degenerate3D:faces.filter(m=>m.degenerate3D).length,duplicateExcess,edgeKeys:edges.size,incidence1,incidence2,incidenceGT2,collapsedKeys,collapsedOccurrences,components:groups.size,largestComponent:Math.max(...sizes),area:faces.reduce((s,m)=>s+m.area,0)},milliseconds:performance.now()-began};
}
export type NativeAnalysis=ReturnType<typeof analyzeNative>;
export type NativeDiagnostic='all'|'zero'|'degenerate'|'duplicate'|'boundary'|'nonmanifold';
export function matchesDiagnostic(m:NativeAnalysis['faces'][number],filter:NativeDiagnostic){return filter==='all'||filter==='zero'&&m.zeroXZ||filter==='degenerate'&&m.degenerate3D||filter==='duplicate'&&m.duplicateCount>1||filter==='boundary'&&m.incidence.includes(1)||filter==='nonmanifold'&&m.incidence.some(n=>n>2);}
