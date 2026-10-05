// SPDX-License-Identifier: GPL-3.0-only
import {Surface} from '../data/explorer';
import type {ExplorerSurface,SourcePoint} from '../data/explorer';
import type {GaiaMesh,GaiaMeta} from '../data/mesh';
import type {NativeMap} from '../data/nativeMaps';
import {geographicSource} from './coordinates';

/** Only adjacency is retained. Position and lineage access borrow the map owner. */
export class SharedSurface extends Surface {
 readonly adjacency:Int32Array;
 constructor(header:ExplorerSurface,private mesh:GaiaMesh|NativeMap){super({...header,offset:0,bytes:0},new ArrayBuffer(0));this.adjacency=new Int32Array(this.count*3).fill(-1);}
 override points(i:number):SourcePoint[]{if(i<0||i>=this.count||!Number.isInteger(i))throw Error('Source index');const mesh=this.mesh;
  if('positions' in mesh)return [0,1,2].map(j=>Array.from(mesh.positions.subarray(i*9+j*3,i*9+j*3+3)) as SourcePoint);
  return [0,1,2].map(j=>{const v=mesh.indices[i*3+j]*3,p=[...geographicSource(mesh.geographic[v],mesh.geographic[v+1]),mesh.geographic[v+2]];if(p.some(x=>Math.abs(Math.round(x)-x)>.125))throw Error('V1 source integer recovery is ambiguous');return p.map(Math.round) as SourcePoint;});
 }
 override attrs(i:number){const a=this.mesh.attributes(i);if(a.origin||a.terrain===null||a.script===null||a.section===null||a.mesh===null||a.triangle===null)throw Error('Synthetic faces are not Explorer source');return {terrain:a.terrain,script:a.script,section:a.section,mesh:a.mesh,triangle:a.triangle};}
 override neighbors(i:number){return Array.from(this.adjacency.subarray(i*3,i*3+3));}
 async build(){const edges=new Map<string,number[]>(),faces=new Map<string,number[]>(),duplicate=new Set<number>(),slots=[[1,2],[2,0],[0,1]];
  for(let i=0;i<this.count;i++){const points=this.points(i).map(p=>[this.header.mapId==='WM0'?p[0]%this.header.extent[0]:p[0],p[1],p[2]].join('/')),face=[...points].sort().join('|');const f=faces.get(face)??[];f.push(i);faces.set(face,f);
   for(let slot=0;slot<3;slot++){const [a,b]=slots[slot];if(points[a]===points[b])continue;const key=[points[a],points[b]].sort().join('|'),e=edges.get(key)??[];e.push(i*3+slot);edges.set(key,e);}if(i%4096===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  for(const f of faces.values())if(f.length>1)for(const i of f)duplicate.add(i);
  for(const e of edges.values()){if(e.length!==2||Math.floor(e[0]/3)===Math.floor(e[1]/3)||e.some(i=>duplicate.has(Math.floor(i/3))))continue;this.adjacency[e[0]]=Math.floor(e[1]/3);this.adjacency[e[1]]=Math.floor(e[0]/3);}return this;
 }
}
const cache=new WeakMap<GaiaMesh|NativeMap,Promise<SharedSurface>>();
export function sharedSurface(mesh:GaiaMesh|NativeMap,meta?:GaiaMeta){let pending=cache.get(mesh);if(pending)return pending;const native='positions' in mesh;
 const source=native?mesh.header.source_sha256:(meta as GaiaMeta&{stage1:{source_wm0_sha256:string}})?.stage1?.source_wm0_sha256;
 if(!source)throw Error('Explorer source fingerprint missing');const header:ExplorerSurface={mapId:native?mesh.header.mapId:'WM0',extent:native?mesh.header.extent as [number,number]:[294912,229376],source_sha256:source.toLowerCase(),offset:0,bytes:0,record_bytes:56,stats:{triangles:mesh.sourceTriangleCount}};
 pending=new SharedSurface(header,mesh).build();cache.set(mesh,pending);pending.catch(()=>cache.delete(mesh));return pending;
}
