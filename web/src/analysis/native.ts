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
 const began=performance.now(),n=map.sourceTriangleCount,faces=Array.from({length:n},(_,i)=>{const p=nativeCorners(map,i);return {...nativeTriangle(p),bounds:[Math.min(...p.map(v=>v[0])),Math.max(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[1]))],incidence:[0,0,0],collapsed:0,repeated:0,duplicateCount:1,component:0};});
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

// Local exact arithmetic for fractional query inputs and clipped intersections.
// The broad phase scans current-map integer AABBs; only candidate faces enter
// these predicates. No epsilon, snapping, display-space or visibility tests.
type Ratio={n:bigint;d:bigint};
const gcd=(a:bigint,b:bigint):bigint=>{a=a<0n?-a:a;while(b){[a,b]=[b,a%b];}return a;};
function ratio(n:bigint,d=1n):Ratio{if(!d)throw Error('Native zero denominator');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return {n:n/g,d:d/g};}
const integer=(n:number)=>ratio(BigInt(n)),zero=integer(0),one=integer(1);
const add=(a:Ratio,b:Ratio)=>ratio(a.n*b.d+b.n*a.d,a.d*b.d);
const sub=(a:Ratio,b:Ratio)=>ratio(a.n*b.d-b.n*a.d,a.d*b.d);
const mul=(a:Ratio,b:Ratio)=>ratio(a.n*b.n,a.d*b.d);
const div=(a:Ratio,b:Ratio)=>ratio(a.n*b.d,a.d*b.n);
const compare=(a:Ratio,b:Ratio)=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;
const value=(a:Ratio)=>Number(a.n)/Number(a.d),exact=(a:Ratio)=>a.d===1n?String(a.n):`${a.n}/${a.d}`;
const minimum=(a:Ratio,b:Ratio)=>compare(a,b)<0?a:b,maximum=(a:Ratio,b:Ratio)=>compare(a,b)>0?a:b;
export type NativeXZ=readonly [number|string,number|string];
function coordinate(input:number|string):Ratio{
 const s=String(input).trim();if(s.length>80)throw Error('Native coordinate');
 let q:Ratio;
 if(/^[+-]?\d{1,20}\/\d{1,20}$/.test(s)){const [a,b]=s.split('/');q=ratio(BigInt(a),BigInt(b));}
 else{const m=/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d{1,2}))?$/i.exec(s);if(!m||!(m[2]||m[3]))throw Error('Native coordinate');const power=Number(m[4]??0)-(m[3]?.length??0);if(Math.abs(power)>40)throw Error('Native coordinate precision');const n=BigInt((m[1]==='-'?'-':'')+(m[2]||'0')+(m[3]??''));q=power>=0?ratio(n*10n**BigInt(power)):ratio(n,10n**BigInt(-power));}
 if(compare(q,integer(-1_000_000))<0||compare(q,integer(1_000_000))>0)throw Error('Native coordinate range');return q;
}
const queryXZ=(p:NativeXZ)=>{if(p.length!==2)throw Error('Native X/Z');return p.map(coordinate) as [Ratio,Ratio];};
function orient(a:NativePoint,b:NativePoint,p:readonly Ratio[]){return sub(mul(integer(b[0]-a[0]),sub(p[1],integer(a[1]))),mul(integer(b[1]-a[1]),sub(p[0],integer(a[0]))));}
function onEdge(a:NativePoint,b:NativePoint,p:readonly Ratio[]){return orient(a,b,p).n===0n&&[0,1].every(j=>compare(p[j],integer(Math.min(a[j],b[j])))>=0&&compare(p[j],integer(Math.max(a[j],b[j])))<=0);}
type SurfaceKind='surface'|'vertical'|'degenerate';
function intersection(points:NativePoint[],p:readonly Ratio[],m:ReturnType<typeof nativeTriangle>):{kind:SurfaceKind;y:[Ratio,Ratio]}|null{
 if(m.determinant){const w=points.map((_,j)=>orient(points[(j+1)%3],points[(j+2)%3],p));if(w.some(v=>m.determinant>0?v.n<0n:v.n>0n))return null;const h=div(w.reduce((s,w,j)=>add(s,mul(w,integer(points[j][2]))),zero),integer(m.determinant));return {kind:'surface',y:[h,h]};}
 const heights:Ratio[]=[];
 for(let j=0;j<3;j++){const a=points[j],b=points[(j+1)%3];if(!onEdge(a,b,p))continue;const axis=a[0]!==b[0]?0:1;if(a[axis]===b[axis])heights.push(integer(a[2]),integer(b[2]));else heights.push(add(integer(a[2]),mul(div(sub(p[axis],integer(a[axis])),integer(b[axis]-a[axis])),integer(b[2]-a[2]))));}
 return heights.length?{kind:m.degenerate3D?'degenerate':'vertical',y:[heights.reduce(minimum),heights.reduce(maximum)]}:null;
}
const lineage=(map:NativeMap,face:number)=>({mapId:map.header.mapId,sourceSHA:map.header.source_sha256,...map.attributes(face)});
export interface NativeSurfaceHit{face:number;source:ReturnType<typeof lineage>;kind:SurfaceKind;heights:[number,number];exactHeights:[string,string];}
export function queryNative(map:NativeMap,position:NativeXZ,analysis=analyzeNative(map)){
 const p=queryXZ(position),xy=p.map(value),hits:NativeSurfaceHit[]=[];const began=performance.now();
 // Two BigInt→Number conversions and one division: conservatively bound their
 // roundoff in the broad phase only. Exact predicates still decide every hit.
 const rounding=4*Number.EPSILON*Math.max(1,...xy.map(Math.abs));
 for(let i=0;i<analysis.faces.length;i++){const m=analysis.faces[i];if(xy[0]<m.bounds[0]-rounding||xy[0]>m.bounds[1]+rounding||xy[1]<m.bounds[2]-rounding||xy[1]>m.bounds[3]+rounding)continue;const h=intersection(nativeCorners(map,i),p,m);if(h)hits.push({face:i,source:lineage(map,i),kind:h.kind,heights:h.y.map(value) as [number,number],exactHeights:h.y.map(exact) as [string,string]});}
 const heights=new Set(hits.filter(h=>h.kind==='surface').map(h=>h.exactHeights[0])),outside=p.some((q,j)=>compare(q,zero)<0||compare(q,integer(map.header.extent[j]))>0);
 return {position:p.map(value),hits,heightCount:heights.size,status:outside?'outside':!hits.length?'empty':!heights.size?'diagnostics':heights.size===1?'single':'multiple',milliseconds:performance.now()-began} as const;
}

export type NativeTraceKind='surface'|'touch'|'vertical_event'|'vertical_band'|'degenerate_event'|'degenerate_band';
export interface NativeTrace{face:number;source:ReturnType<typeof lineage>;kind:NativeTraceKind;t:[number,number];exactT:[string,string];path:[number,number][];exactPath:[string,string][];}
function clipBand(poly:Ratio[][],bound:Ratio,lower:boolean){const out:Ratio[][]=[];for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length],inside=(v:Ratio[])=>lower?compare(v[0],bound)>=0:compare(v[0],bound)<=0,ai=inside(a),bi=inside(b);if(ai)out.push(a);if(ai!==bi){const t=div(sub(bound,a[0]),sub(b[0],a[0]));out.push([bound,add(a[1],mul(t,sub(b[1],a[1])))]);}}return out;}
export function transectNative(map:NativeMap,start:NativeXZ,end:NativeXZ,analysis=analyzeNative(map)){
 const began=performance.now(),a=queryXZ(start),b=queryXZ(end),v=b.map((q,j)=>sub(q,a[j]));if(v.every(q=>!q.n))throw Error('Native zero-length transect');
 const traces:NativeTrace[]=[],intervals:[Ratio,Ratio][]=[];
 const at=(t:Ratio)=>a.map((q,j)=>add(q,mul(t,v[j])));
 const emit=(face:number,kind:NativeTraceKind,poly:Ratio[][])=>{const ts=poly.map(p=>p[0]),lo=ts.reduce(minimum),hi=ts.reduce(maximum);traces.push({face,source:lineage(map,face),kind,t:[value(lo),value(hi)],exactT:[exact(lo),exact(hi)],path:poly.map(p=>p.map(value) as [number,number]),exactPath:poly.map(p=>p.map(exact) as [string,string])});if(kind==='surface')intervals.push([lo,hi]);};
 for(let i=0;i<analysis.faces.length;i++){
  const m=analysis.faces[i];if([0,1].some(j=>compare(maximum(a[j],b[j]),integer(m.bounds[j*2]))<0||compare(minimum(a[j],b[j]),integer(m.bounds[j*2+1]))>0))continue;
  const p=nativeCorners(map,i);
  if(m.determinant){let lo=zero,hi=one;for(let j=0;j<3;j++){const c=orient(p[j],p[(j+1)%3],a),e=orient(p[j],p[(j+1)%3],b),sign=integer(m.determinant>0?1:-1),c0=mul(c,sign),delta=mul(sub(e,c),sign);if(!delta.n){if(c0.n<0n){lo=one;hi=zero;break;}}else{const t=div(sub(zero,c0),delta);if(delta.n>0n)lo=maximum(lo,t);else hi=minimum(hi,t);}}
   if(compare(lo,hi)<=0){const height=(t:Ratio)=>{const q=at(t),weights=p.map((_,j)=>orient(p[(j+1)%3],p[(j+2)%3],q));return div(weights.reduce((s,w,j)=>add(s,mul(w,integer(p[j][2]))),zero),integer(m.determinant));};emit(i,compare(lo,hi)===0?'touch':'surface',[[lo,height(lo)],[hi,height(hi)]]);}
  }else{
   // Pick the extreme projected endpoints; source identity/winding is untouched.
   let first=p[0],last=p[0],span=-1;for(const x of p)for(const y of p){const d=(x[0]-y[0])**2+(x[1]-y[1])**2;if(d>span){first=x;last=y;span=d;}}
   const w=[integer(last[0]-first[0]),integer(last[1]-first[1])],delta=[sub(integer(first[0]),a[0]),sub(integer(first[1]),a[1])],cross=(x:Ratio[],y:Ratio[])=>sub(mul(x[0],y[1]),mul(x[1],y[0])),den=cross(v,w);
   if(den.n){const t=div(cross(delta,w),den),s=div(cross(delta,v),den);if(compare(t,zero)<0||compare(t,one)>0||compare(s,zero)<0||compare(s,one)>0)continue;const hit=intersection(p,at(t),m);if(hit)emit(i,m.degenerate3D?'degenerate_event':'vertical_event',hit.y.map(y=>[t,y]));}
   else if(!cross(delta,v).n){const axis=v[0].n?0:1;let poly=p.map(q=>[div(sub(integer(q[axis]),a[axis]),v[axis]),integer(q[2])]);poly=clipBand(clipBand(poly,zero,true),one,false);if(poly.length)emit(i,m.degenerate3D?'degenerate_band':'vertical_band',poly);}
  }
 }
 // Gaps concern ordinary height segments. Vertical bands remain separate evidence.
 intervals.sort((a,b)=>compare(a[0],b[0]));let cursor=zero;const gaps:[number,number][]=[];for(const [lo,hi]of intervals){if(compare(lo,cursor)>0)gaps.push([value(cursor),value(lo)]);cursor=maximum(cursor,hi);}if(compare(cursor,one)<0)gaps.push([value(cursor),1]);
 return {start:a.map(value),end:b.map(value),length:Math.hypot(...v.map(value)),traces,gaps,milliseconds:performance.now()-began};
}
