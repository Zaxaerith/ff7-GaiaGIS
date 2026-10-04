// SPDX-License-Identifier: GPL-3.0-only
import type {GaiaMesh,GaiaMeta} from './mesh';
import type {Entrance} from './poi';
import {evaluateTraversal,movementProfiles} from './traversal';
export const routeProfiles=movementProfiles.filter(p=>p.id!=='highwind-landing');
export interface RoutingData {count:number;arcs:number;seamEdges:number;offsets:Uint32Array;neighbors:Uint32Array;weights:Float64Array;terrain:Uint8Array;script:Uint8Array;area:Float64Array;lineage:Map<string,number>;sourceHash:string;}
const fail=():never=>{throw new Error('Invalid or incompatible Gaia routing dataset.');};
export function parseRouting(buffer:ArrayBuffer,meta?:GaiaMeta,mesh?:GaiaMesh):RoutingData{
  if(buffer.byteLength<128||buffer.byteLength>100_000_000)fail();const v=new DataView(buffer),u=(at:number)=>v.getUint32(at,true);
  if(new TextDecoder().decode(new Uint8Array(buffer,0,8))!=='GAIARTG\0'||v.getUint16(8,true)!==1||v.getUint16(10,true)!==128||u(44)!==1)fail();
  const count=u(12),arcs=u(16),node=u(20),csr=u(24),neighbor=u(28),weight=u(32),total=u(36),seamEdges=u(40);
  if(!count||count>2_000_000||arcs>count*3||seamEdges>arcs/2||node!==128||csr!==128+count*16||neighbor!==csr+(count+1)*4||weight!==neighbor+arcs*4||total!==weight+arcs*8||total!==buffer.byteLength)fail();
  if(new Uint8Array(new Uint16Array([1]).buffer)[0]!==1)fail();
  if([48,52,56,60,96,100,104,108,112,116,120,124].some(at=>u(at)!==0))fail();
  const sourceHash=Array.from(new Uint8Array(buffer,64,32),x=>x.toString(16).padStart(2,'0')).join(''),expected=(meta as GaiaMeta&{stage1?:{source_wm0_sha256?:string}})?.stage1?.source_wm0_sha256;
  if(expected&&expected.toLowerCase()!==sourceHash)throw new Error('Routing was generated from a different WM0 source.');if(mesh&&mesh.sourceTriangleCount!==count)fail();
  const offsets=new Uint32Array(buffer,csr,count+1),neighbors=new Uint32Array(buffer,neighbor,arcs),weights=new Float64Array(arcs),terrain=new Uint8Array(count),script=new Uint8Array(count),area=new Float64Array(count),lineage=new Map<string,number>();
  if(offsets[0]!==0||offsets[count]!==arcs)fail();
  for(let i=0;i<count;i++){const at=node+i*16,s=v.getUint16(at,true),m=v.getUint16(at+2,true),t=v.getUint16(at+4,true),key=`${s}/${m}/${t}`;terrain[i]=v.getUint8(at+6);script[i]=v.getUint8(at+7);area[i]=v.getFloat64(at+8,true);if(s>62||m>15||terrain[i]>31||script[i]>7||!Number.isFinite(area[i])||area[i]<0||lineage.has(key)||offsets[i]>offsets[i+1]||offsets[i+1]-offsets[i]>3)fail();lineage.set(key,i);
    if(mesh){const a=mesh.attributes(i);if(a.origin||a.section!==s||a.mesh!==m||a.triangle!==t||a.terrain!==terrain[i]||a.script!==script[i])fail();}
    let previous=-1;for(let j=offsets[i];j<offsets[i+1];j++){const b=neighbors[j];weights[j]=v.getFloat64(weight+j*8,true);if(b>=count||b===i||b<=previous||!Number.isFinite(weights[j])||weights[j]<0)fail();previous=b;}
  }
  for(let i=0;i<count;i++)for(let j=offsets[i];j<offsets[i+1];j++){const b=neighbors[j];let reverse=-1;for(let k=offsets[b];k<offsets[b+1];k++)if(neighbors[k]===i)reverse=k;if(reverse<0||weights[j]!==weights[reverse])fail();}
  return {count,arcs,seamEdges,offsets,neighbors,weights,terrain,script,area,lineage,sourceHash};
}
export function routeState(id:string,terrain:number,script=0){if(!routeProfiles.some(p=>p.id===id))throw new Error('Not a routing profile');const s=evaluateTraversal(id,terrain,script).state;return s==='allowed'&&[13,14,30].includes(terrain)?'conditional':s;}
export interface Component {id:number;triangles:number;area:number;}
export function connectedComponents(g:RoutingData,id:string,conditional=false){
  const states=Array.from({length:32},(_,t)=>routeState(id,t)),eligible=new Uint8Array(g.count);for(let i=0;i<g.count;i++)eligible[i]=Number(states[g.terrain[i]]==='allowed'||conditional&&states[g.terrain[i]]==='conditional');
  const labels=new Int32Array(g.count).fill(-1),components:Component[]=[],stack=new Uint32Array(g.count);
  for(let i=0;i<g.count;i++){if(!eligible[i]||labels[i]>=0)continue;const c={id:components.length,triangles:0,area:0};let top=0;stack[top++]=i;labels[i]=c.id;while(top){const a=stack[--top];c.triangles++;c.area+=g.area[a];for(let j=g.offsets[a];j<g.offsets[a+1];j++){const b=g.neighbors[j];if(eligible[b]&&labels[b]<0){labels[b]=c.id;stack[top++]=b;}}}components.push(c);}
  return {labels,components};
}
export interface Endpoint {node:number;entrance:string;}
export function entranceEndpoints(g:RoutingData,entrances:Entrance[]):Endpoint[]{const result:Endpoint[]=[];for(const e of entrances)for(const t of e.trigger_triangle_ids){const node=g.lineage.get(`${e.section_id}/${e.mesh_id}/${t}`);if(node!==undefined)result.push({node,entrance:e.id});}return result.sort((a,b)=>a.node-b.node||a.entrance.localeCompare(b.entrance,'en'));}
class Heap {items:[number,number][]=[];push(value:[number,number]){let i=this.items.length;this.items.push(value);while(i){const p=(i-1)>>1;if(this.compare(this.items[p],value)<=0)break;this.items[i]=this.items[p];i=p;}this.items[i]=value;}compare(a:[number,number],b:[number,number]){return a[0]-b[0]||a[1]-b[1];}pop(){const first=this.items[0],last=this.items.pop()!;if(this.items.length){let i=0;while(i*2+1<this.items.length){let c=i*2+1;if(c+1<this.items.length&&this.compare(this.items[c+1],this.items[c])<0)c++;if(this.compare(last,this.items[c])<=0)break;this.items[i]=this.items[c];i=c;}this.items[i]=last;}return first;}}
export function findRoute(g:RoutingData,labels:Int32Array,starts:Endpoint[],targets:Endpoint[]){
  const valid=(p:Endpoint)=>Number.isInteger(p.node)&&p.node>=0&&p.node<g.count&&labels[p.node]>=0;
  const start=starts.filter(valid),target=targets.filter(valid),targetNodes=new Map<number,string>();for(const e of target)if(!targetNodes.has(e.node))targetNodes.set(e.node,e.entrance);
  if(!start.length||!target.length||!start.some(s=>target.some(t=>labels[s.node]===labels[t.node])))return null;
  const cost=new Float64Array(g.count).fill(Infinity),parent=new Int32Array(g.count).fill(-1),origin=new Int32Array(g.count).fill(-1),heap=new Heap();
  for(let i=0;i<start.length;i++)if(cost[start[i].node]!==0){cost[start[i].node]=0;origin[start[i].node]=i;heap.push([0,start[i].node]);}
  while(heap.items.length){const [d,a]=heap.pop();if(d!==cost[a])continue;if(targetNodes.has(a)){const path:number[]=[];for(let v=a;v>=0;v=parent[v])path.push(v);return {nodes:path.reverse(),distance:d,startEntrance:start[origin[a]].entrance,targetEntrance:targetNodes.get(a)!,component:labels[a]};}
    for(let j=g.offsets[a];j<g.offsets[a+1];j++){const b=g.neighbors[j];if(labels[b]<0)continue;const next=d+g.weights[j];if(next<cost[b]){cost[b]=next;parent[b]=a;origin[b]=origin[a];heap.push([next,b]);}}
  }return null;
}
export async function loadOptionalRouting(meta:GaiaMeta,mesh:GaiaMesh){if(import.meta.env.VITE_GAIA_SOURCE_ONLY==='true')return null;const response=await fetch(`${import.meta.env.BASE_URL}data/gaia-routing.bin`);if(response.status===404||response.ok&&response.headers.get('content-type')?.includes('text/html'))return null;if(!response.ok)throw new Error('Routing data could not load.');const buffer=await response.arrayBuffer();return {buffer,data:parseRouting(buffer,meta,mesh)};}
