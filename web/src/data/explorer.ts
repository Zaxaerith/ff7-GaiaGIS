// SPDX-License-Identifier: GPL-3.0-only
import type {MapId} from './nativeMaps';
export interface BlobRef {offset:number;bytes:number;}
export interface ExplorerPart extends BlobRef {bone:number;vertices:number;texture:string|null;resource:string;group:number;}
export interface ExplorerClip extends BlobRef {name:string;frame_count:number;bone_count:number;rotation_order:number[];timing:string;}
export interface ExplorerModel {id:string;model_id:number|null;sourceKind?:'world_map'|'extended_field';characterId?:string|null;displayNameKey?:string;evidence?:string;compatibility_class?:string;field_binding?:{source_field:string;byte_offset:number};display_transform?:{scale_policy:string;forward_axis:string;ground_origin:string};hrc:string;source_scale:number;bone_count:number;bones:{name:string;parent:number;length:number;resources:string[]}[];parts:ExplorerPart[];clips:ExplorerClip[];animation_identity:string;}
export interface ExplorerSurface extends BlobRef {mapId:MapId;extent:[number,number];source_sha256:string;record_bytes:56;stats:{triangles:number};}
export interface ExplorerTexture extends BlobRef {name:string;width:number;height:number;}
export interface ExplorerHeader {schema:string;version:number;runtimeClaim:false;reconstruction:string;sources:Record<string,string>;models:ExplorerModel[];surfaces:ExplorerSurface[];textures:ExplorerTexture[];map_bindings?:Omit<ExplorerSurface,"offset"|"bytes"|"record_bytes">[];}
export interface ExplorerPack {header:ExplorerHeader;payload:ArrayBuffer;sha256:string;surface:(id:MapId)=>Surface;floats:(ref:BlobRef)=>Float32Array;bindSurface?:(surface:Surface)=>void;}
const reject=():never=>{throw Error('Invalid or incompatible Explorer pack');};
const int=(n:number,min:number,max:number)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export async function decodeExplorer(buffer:ArrayBuffer):Promise<ExplorerPack>{
 if(buffer.byteLength<48||buffer.byteLength>80_000_000)reject();const view=new DataView(buffer),magic=new TextDecoder().decode(new Uint8Array(buffer,0,8)),length=view.getUint32(12,true);
 if(magic!=='GAIAEXP\0'||![1,2].includes(view.getUint32(8,true))||length>2_000_000||16+length>buffer.byteLength-32)reject();
 const hash=await crypto.subtle.digest('SHA-256',buffer.slice(0,-32));if(new Uint8Array(hash).some((v,i)=>v!==view.getUint8(buffer.byteLength-32+i)))reject();
 const h:ExplorerHeader=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer.slice(16,16+length))),start=16+Math.ceil(length/4)*4,payload=buffer.slice(start,-32);
 if(h.schema!=='gaiagis-explorer'||![1,2].includes(h.version)||h.version!==view.getUint32(8,true)||h.runtimeClaim!==false||h.reconstruction!=='v1-geometric-gaia'||!Array.isArray(h.models)||!h.models.length||h.models.length>32||!Array.isArray(h.surfaces)||h.surfaces.length!==(h.version===1?3:0)||!Array.isArray(h.textures)||h.textures.length>256)reject();
 const spans:[number,number][]=[];
 const blob=(r:BlobRef)=>{if(!int(r.offset,0,payload.byteLength)||r.offset%4||!int(r.bytes,1,payload.byteLength)||r.offset+r.bytes>payload.byteLength)reject();spans.push([r.offset,r.offset+r.bytes]);};
 for(const k of ['wm0.map','wm2.map','wm3.map','world_us.lgp'])if(!/^[0-9a-f]{64}$/.test(h.sources?.[k]??''))reject();
 const textureNames=new Set<string>();for(const r of h.textures){blob(r);if(!/^[a-z0-9_.]+\.tex$/.test(r.name)||textureNames.has(r.name)||!int(r.width,1,4096)||!int(r.height,1,4096)||r.bytes!==r.width*r.height*4)reject();textureNames.add(r.name);}
 const ids=new Set<string>();for(const m of h.models){if(!/^[a-z0-9-]+$/.test(m.id)||ids.has(m.id)||!(m.model_id===null&&m.sourceKind==='extended_field'||typeof m.model_id==='number'&&int(m.model_id,0,63))||!Number.isFinite(m.source_scale)||m.source_scale<=0||m.source_scale>1000||!int(m.bone_count,0,1024)||m.bones.length!==(m.bone_count||1)||!m.parts.length||m.parts.length>1024||!m.clips.length||m.clips.length>100)reject();ids.add(m.id);if(m.sourceKind!==undefined&&!['world_map','extended_field'].includes(m.sourceKind))reject();if(m.sourceKind==='extended_field'&&(!['barret','aerith','red-xiii','yuffie','cait-sith','vincent'].includes(m.id)||m.characterId!==m.id||!m.field_binding||!int(m.field_binding.byte_offset,6,100000)||!/^[a-z0-9]+$/.test(m.field_binding.source_field)))reject();
  m.bones.forEach((b,i)=>{if(!int(b.parent,-1,i-1)||!Number.isFinite(b.length)||b.length<0||b.length>100000)reject();});
  for(const p of m.parts){blob(p);if(!int(p.bone,0,m.bones.length-1)||!int(p.vertices,3,1_000_000)||p.vertices%3||p.bytes!==p.vertices*48||(p.texture!==null&&!textureNames.has(p.texture)))reject();}
  for(const c of m.clips){blob(c);if(!int(c.frame_count,1,10000)||c.bone_count!==m.bone_count||c.bytes!==c.frame_count*(6+c.bone_count*3)*4||[...c.rotation_order].sort().join()!=='0,1,2')reject();}
  for(const r of [...m.parts,...m.clips])for(const value of new Float32Array(payload,r.offset,r.bytes/4))if(!Number.isFinite(value)||Math.abs(value)>1e8)reject();
 }
 const bound=new Map<MapId,Surface>();if(h.version===2){if(!Array.isArray(h.map_bindings)||h.map_bindings.length!==3)reject();const identities=new Set<string>();for(const b of h.map_bindings??[]){if(!['WM0','WM2','WM3'].includes(b.mapId)||identities.has(b.mapId)||b.source_sha256!==h.sources[b.mapId.toLowerCase()+'.map']||!int(b.stats?.triangles,1,200000)||b.extent?.length!==2||b.extent.some(n=>!int(n,1,1_000_000)))reject();identities.add(b.mapId);}}
 const maps=new Set<MapId>();for(const s of h.surfaces){blob(s);if(!['WM0','WM2','WM3'].includes(s.mapId)||maps.has(s.mapId)||s.record_bytes!==56||!int(s.stats.triangles,1,200000)||s.bytes!==s.stats.triangles*56||s.source_sha256!==h.sources[s.mapId.toLowerCase()+'.map']||s.extent.length!==2||s.extent.some(x=>!int(x,1,1_000_000)))reject();maps.add(s.mapId);
  const surface=new Surface(s,payload);for(let i=0;i<surface.count;i++){const a=surface.attrs(i);if(a.terrain>31||a.script>7||a.mesh>15)reject();for(const p of surface.points(i))if(p[0]<0||p[0]>s.extent[0]||p[1]<0||p[1]>s.extent[1]||Math.abs(p[2])>32768)reject();const slots=[[1,2],[2,0],[0,1]],pointKey=(p:SourcePoint)=>[s.mapId==='WM0'?p[0]%s.extent[0]:p[0],p[1],p[2]].join('/'),edgeKey=(t:number,slot:number)=>slots[slot].map(j=>pointKey(surface.points(t)[j])).sort().join('|');
   surface.neighbors(i).forEach((n,slot)=>{if(!int(n,-1,surface.count-1)||n===i)reject();if(n>=0){const opposite=surface.neighbors(n).map((x,j)=>x===i?j:-1).filter(j=>j>=0);if(opposite.length!==1||edgeKey(i,slot)!==edgeKey(n,opposite[0]))reject();}});}
 }
 spans.sort((a,b)=>a[0]-b[0]);if(spans.some((s,i)=>i&&s[0]<spans[i-1][1]))reject();
 return {header:h,payload,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),x=>x.toString(16).padStart(2,'0')).join(''),bindSurface(surface){const b=h.map_bindings?.find(b=>b.mapId===surface.header.mapId);if(!b||b.source_sha256!==surface.header.source_sha256||b.stats.triangles!==surface.count||b.extent.some((n,i)=>n!==surface.header.extent[i]))throw Error('Explorer map binding mismatch');bound.set(b.mapId,surface);},surface(id){if(h.version===2){const s=bound.get(id);if(!s)throw Error('Explorer requires compatible loaded map geometry');return s;}const s=h.surfaces.find(s=>s.mapId===id);if(!s)return reject();return new Surface(s,payload);},floats:r=>new Float32Array(payload,r.offset,r.bytes/4)};
}
export type SourcePoint=[number,number,number];
export class Surface {
 readonly view:DataView;readonly count:number;
 private cells:Map<string,number[]>|null=null;
 constructor(readonly header:ExplorerSurface,payload:ArrayBuffer){this.view=new DataView(payload,header.offset,header.bytes);this.count=header.stats.triangles;}
 points(i:number):SourcePoint[]{if(!int(i,0,this.count-1))return reject();return [0,1,2].map(j=>[0,1,2].map(k=>this.view.getInt32(i*56+j*12+k*4,true)) as SourcePoint);}
 neighbors(i:number){return [0,1,2].map(j=>this.view.getInt32(i*56+36+j*4,true));}
 attrs(i:number){const p=i*56;return {terrain:this.view.getUint8(p+48),script:this.view.getUint8(p+49),section:this.view.getUint16(p+50,true),mesh:this.view.getUint16(p+52,true),triangle:this.view.getUint16(p+54,true)};}
 candidates(x:number,z:number){if(!this.cells){this.cells=new Map();for(let i=0;i<this.count;i++){const p=this.points(i),xs=p.map(v=>v[0]),zs=p.map(v=>v[1]);for(let a=Math.floor(Math.min(...xs)/8192);a<=Math.floor(Math.max(...xs)/8192);a++)for(let b=Math.floor(Math.min(...zs)/8192);b<=Math.floor(Math.max(...zs)/8192);b++){const key=`${a}/${b}`,row=this.cells.get(key)??[];row.push(i);this.cells.set(key,row);}}}return this.cells.get(`${Math.floor(x/8192)}/${Math.floor(z/8192)}`)??[];}
}
