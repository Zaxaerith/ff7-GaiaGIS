// SPDX-License-Identifier: GPL-3.0-only
/** Private explicit research input. Never a Workspace asset or gameplay mesh. */
import {nativeTriangle} from '../analysis/native';
import type {NativePoint} from '../analysis/native';
export const VARIANT_LIMITS={file:8_000_000,payload:6_000_000,meshes:192,faces:32_000,vertices:20_000} as const;
export const VARIANT_GROUPS=[[[63],[50]],[[64,65],[41,42]],[[66],[60]],[[67,68],[47,48]]] as const;
const placements=new Map<number,number>(VARIANT_GROUPS.flatMap(([aa,bb])=>aa.map((a,i)=>[a,bb[i]] as [number,number])));
const sections=[...placements.keys(),...placements.values()].sort((a,b)=>a-b);
export type VariantMesh=[number,number,number,number,number,number,number[][],number[][],number[][]];
export interface VariantScript {source_sha256:string;section_sha256:string;entry:{data_offset:number;offset:number;size:number;toc_index:number;filename:string};sites:{word_offset:number;payload_byte_offset:number;archive_byte_offset:number;literal:number|null;entries:{table:number;header:number;kind:number;function:number}[]}[];runtime:string;}
export interface VariantFace {id:string;section:number;placement:number;mesh:number;triangle:number;group:number;points:NativePoint[];normals:number[][];uv:number[][];raw:number[];sourceMesh:VariantMesh;metrics:ReturnType<typeof nativeTriangle>;geometry:string;}
export interface VariantBucket {base:VariantFace[];alternative:VariantFace[];common:number;ambiguous:boolean;changed:boolean;}
export interface VariantComparison {group:number;stats:Record<string,number>;terrain:{code:number;baseCount:number;alternativeCount:number;baseArea:number;alternativeArea:number}[];buckets:Map<string,VariantBucket>;}
export interface BoundaryEvidence {group:number;kind:string;sections:number[];axis:number;coordinate:number;a:number;b:number;exact:number;unmatched_a:number;unmatched_b:number;examples:unknown[];}
export interface WorldVariants {boundaries:BoundaryEvidence[];sourceHash:string;payloadHash:string;meshes:VariantMesh[];faces:VariantFace[];groups:VariantComparison[];script:VariantScript|null;bytes:number;decodeMs:number;}
const integer=(n:unknown,lo:number,hi:number):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=lo&&n<=hi;
const hash=(x:unknown):x is string=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export const sha256=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),n=>n.toString(16).padStart(2,'0')).join('');
function compare(a:unknown,b:unknown):number{if(typeof a==='number'&&typeof b==='number')return a-b;const x=a as unknown[],y=b as unknown[];for(let i=0;i<Math.min(x.length,y.length);i++){const n=compare(x[i],y[i]);if(n)return n;}return x.length-y.length;}
const sorted=(rows:unknown[])=>rows.slice().sort(compare);
export function variantSignatures(f:Pick<VariantFace,'points'|'normals'|'uv'|'raw'>){
 const p=f.points,ordered=[0,1,2].map(i=>JSON.stringify([...p.slice(i),...p.slice(0,i)]));
 return {geometry:JSON.stringify(sorted(p)),winding:ordered.sort()[0],attribute:JSON.stringify([f.raw[3],f.raw[10]]),
  uv:JSON.stringify(sorted(p.map((p,i)=>[p,f.uv[i]]))),normal:JSON.stringify(sorted(p.map((p,i)=>[p,f.normals[i]]))),
  all:JSON.stringify(sorted(p.map((p,i)=>[p,f.uv[i],f.normals[i]])))};
}
function common(a:string[],b:string[]){const counts=new Map<string,number>();for(const k of a)counts.set(k,(counts.get(k)??0)+1);let n=0;for(const k of b){const v=counts.get(k)??0;if(v){n++;counts.set(k,v-1);}}return n;}
export function compareVariantFaces(base:VariantFace[],alternative:VariantFace[],group=0):VariantComparison{
 const buckets=new Map<string,VariantBucket>(),stats:Record<string,number>={base_faces:base.length,alternative_faces:alternative.length,geometry_common:0,base_only:0,alternative_only:0,attribute_common:0,uv_common:0,normal_common:0,winding_common:0,attribute_uv_common:0,all_common:0,ambiguous_buckets:0,face_delta:alternative.length-base.length,area_contribution_delta:0};
 const terrain=new Map<number,{code:number;baseCount:number;alternativeCount:number;baseArea:number;alternativeArea:number}>(),ids=new Set<string>();
 for(const [side,rows]of [['base',base],['alternative',alternative]] as const)for(const f of rows){if(ids.has(f.id))throw Error('Duplicate variant source identity');ids.add(f.id);const key=variantSignatures(f).geometry;f.geometry=key;let b=buckets.get(key);if(!b){b={base:[],alternative:[],common:0,ambiguous:false,changed:false};buckets.set(key,b);}b[side].push(f);const code=f.raw[3]&31;let t=terrain.get(code);if(!t){t={code,baseCount:0,alternativeCount:0,baseArea:0,alternativeArea:0};terrain.set(code,t);}if(side==='base'){t.baseCount++;t.baseArea+=f.metrics.area;}else{t.alternativeCount++;t.alternativeArea+=f.metrics.area;}stats.area_contribution_delta+=(side==='base'?-1:1)*f.metrics.area;}
 for(const b of buckets.values()){b.common=Math.min(b.base.length,b.alternative.length);b.ambiguous=b.base.length>1||b.alternative.length>1;stats.geometry_common+=b.common;stats.base_only+=b.base.length-b.common;stats.alternative_only+=b.alternative.length-b.common;stats.ambiguous_buckets+=Number(b.ambiguous);
  const sig=[b.base,b.alternative].map(rows=>rows.map(variantSignatures));
  for(const key of ['attribute','uv','normal','winding'] as const)stats[key+'_common']+=common(sig[0].map(s=>s[key]),sig[1].map(s=>s[key]));
  b.changed=!b.common||common(sig[0].map(s=>s.attribute+s.all+s.winding),sig[1].map(s=>s.attribute+s.all+s.winding))<b.common;
  stats.attribute_uv_common+=common(sig[0].map(s=>s.attribute+s.uv),sig[1].map(s=>s.attribute+s.uv));stats.all_common+=common(sig[0].map(s=>s.attribute+s.all),sig[1].map(s=>s.attribute+s.all));
 }
 stats.attribute_uv_difference_lower_bound=stats.geometry_common-stats.attribute_uv_common;
 return {group,stats,terrain:[...terrain.values()].sort((a,b)=>a.code-b.code),buckets};
}
export function validateVariantPayload(value:unknown):VariantMesh[]{
 if(!value||typeof value!=='object'||Object.keys(value).sort().join()!=='boundary_evidence,meshes,script_evidence')throw Error('Variant payload schema');const meshes=(value as {meshes:unknown}).meshes;
 if(!Array.isArray(meshes)||meshes.length!==VARIANT_LIMITS.meshes)throw Error('Variant mesh count');let faces=0,vertices=0;const seen=new Set<string>(),spans=new Map<number,[number,number][]>();
 for(const m of meshes){if(!Array.isArray(m)||m.length!==9)throw Error('Variant mesh layout');const [s,b,id,off,len,size,v,n,t]=m;
  if(!integer(s,0,68)||!sections.includes(s)||b!==(placements.get(s)??s)||!integer(id,0,15)||seen.has(`${s}/${id}`)||!integer(off,s*47104+64,(s+1)*47104-4)||off%4||!integer(len,1,(s+1)*47104-off-4)||!integer(size,4,20_000))throw Error('Variant source span/identity');seen.add(`${s}/${id}`);
  const list=spans.get(s)??[];if(list.some(([a,z])=>off<z&&a<off+4+len))throw Error('Overlapping variant compressed spans');list.push([off,off+4+len]);spans.set(s,list);
  if(!Array.isArray(v)||v.length<1||v.length>256||!Array.isArray(n)||n.length!==v.length||!Array.isArray(t)||t.length>512||size!==4+t.length*12+v.length*16)throw Error('Variant decoded table lengths');
  for(const vector of [...v,...n])if(!Array.isArray(vector)||vector.length!==4||!vector.slice(0,3).every(x=>integer(x,-32768,32767))||!integer(vector[3],0,65535))throw Error('Variant S16/U16 vector');
  for(const triangle of t)if(!Array.isArray(triangle)||triangle.length!==11||!triangle.slice(0,3).every(x=>integer(x,0,v.length-1))||!triangle.slice(3,10).every(x=>integer(x,0,255))||!integer(triangle[10],0,65535))throw Error('Variant triangle index/attribute');
  faces+=t.length;vertices+=v.length;
 }
 if(faces<1||faces>VARIANT_LIMITS.faces||vertices>VARIANT_LIMITS.vertices)throw Error('Variant record budget');return meshes as VariantMesh[];
}
function validateBoundaries(value:unknown):BoundaryEvidence[]{
 if(!Array.isArray(value)||value.length>128)throw Error('Variant boundary evidence');const seen=new Set<string>();
 for(const r of value){
  if(!r||!integer(r.group,1,4)||!['world_boundary','base_alternative_side','external_base','external_alternative','cumulative_context','internal_base','internal_alternative','mixed_rejected'].includes(r.kind)||!Array.isArray(r.sections)||r.sections.length!==2||!r.sections.every((n:unknown)=>integer(n,0,68))||!integer(r.axis,0,1)||!integer(r.coordinate,0,294912)||r.coordinate%32768||![r.a,r.b,r.exact,r.unmatched_a,r.unmatched_b].every(n=>integer(n,0,2000))||r.exact>Math.min(r.a,r.b)||r.a-r.exact!==r.unmatched_a||r.b-r.exact!==r.unmatched_b||!Array.isArray(r.examples)||r.examples.length>6)throw Error('Variant boundary range/count');
  const key=JSON.stringify([r.group,r.kind,r.sections,r.axis,r.coordinate]);if(seen.has(key))throw Error('Duplicate variant boundary');seen.add(key);
  for(const example of r.examples){if(!example||!Array.isArray(example.points)||example.points.length!==2||!example.points.every((p:unknown)=>Array.isArray(p)&&p.length===3&&p[r.axis]===r.coordinate&&p.every(n=>integer(n,-1_000_000,1_000_000))))throw Error('Variant boundary points');
   for(const [i,name]of ['a_owners','b_owners'].entries()){const owners=example[name];if(!Array.isArray(owners)||owners.length>32||!owners.every((o:unknown)=>Array.isArray(o)&&o.length===2&&typeof o[0]==='string'&&/^[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{1,3}$/.test(o[0])&&o[0].split('/').every((v,j)=>integer(Number(v),0,j===0?68:j===1?15:511))&&Number(o[0].split('/')[0])===r.sections[i]&&integer(o[1],0,2)))throw Error('Variant boundary owner identity');}
  }
 }
 return value;
}
function validateScript(s:unknown):VariantScript|null{
 if(s===null)return null;if(!s||typeof s!=='object')throw Error('Variant script evidence');const e=s as VariantScript;
 if(!hash(e.source_sha256)||!hash(e.section_sha256)||e.runtime!=='Unknown'||!e.entry||e.entry.filename!=='wm0.ev'||!integer(e.entry.offset,0,160_000_000)||e.entry.data_offset!==e.entry.offset+24||!integer(e.entry.size,1024,1_000_000)||e.entry.size%2||e.entry.data_offset>160_000_000-e.entry.size||!integer(e.entry.toc_index,0,100_000)||!Array.isArray(e.sites)||e.sites.length>64)throw Error('Variant script source');
 const seen=new Set<number>();for(const r of e.sites){if(!integer(r.word_offset,1,(e.entry.size-1024)/2-1)||seen.has(r.word_offset)||r.payload_byte_offset!==1024+2*r.word_offset||r.archive_byte_offset!==e.entry.data_offset+r.payload_byte_offset||r.literal!==null&&!integer(r.literal,0,65535)||!Array.isArray(r.entries)||r.entries.length<1||r.entries.length>255||!r.entries.every(x=>integer(x.table,1,255)&&integer(x.header,0,65535)&&integer(x.kind,0,2)&&x.kind===x.header>>14&&integer(x.function,0,255)&&x.function===(x.header&(x.kind===2?15:255))))throw Error('Variant script offset/entry');seen.add(r.word_offset);}return e;
}
export async function decodeWorldVariants(buffer:ArrayBuffer,expectedSource:string,signal?:AbortSignal):Promise<WorldVariants>{
 const started=performance.now();if(buffer.byteLength<100||buffer.byteLength>VARIANT_LIMITS.file)throw Error('Variant file budget');signal?.throwIfAborted();
 const e=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer));
 if(e.schema!=='gaiagis-world-variants'||e.version!==1||e.generator!=='world-variants-1'||e.map_id!=='WM0'||!hash(e.source_sha256)||e.source_sha256!==expectedSource||e.normal_frame!=='original raw XYZ'||JSON.stringify(e.coordinate_frame)!=='["placed raw X","placed raw Z","raw Y"]'||typeof e.payload!=='string'||!integer(e.payload_bytes,1,VARIANT_LIMITS.payload)||e.payload.length>VARIANT_LIMITS.payload||!hash(e.payload_sha256))throw Error('Variant version/source/frame');
 if(JSON.stringify(e.groups)!==JSON.stringify(VARIANT_GROUPS.map(([a,b],i)=>({id:i+1,alternatives:a,bases:b}))))throw Error('Variant atomic groups');
 const raw=new TextEncoder().encode(e.payload);if(raw.byteLength!==e.payload_bytes||await sha256(raw)!==e.payload_sha256)throw Error('Variant payload SHA/length');signal?.throwIfAborted();
 const parsed=JSON.parse(e.payload),meshes=validateVariantPayload(parsed),boundaries=validateBoundaries(parsed.boundary_evidence),script=validateScript(parsed.script_evidence),faces:VariantFace[]=[];
 for(const m of meshes){const [s,b,mid,,,,v,n,ts]=m,col=b%9*4+mid%4,row=Math.floor(b/9)*4+Math.floor(mid/4),group=VARIANT_GROUPS.findIndex(([aa,bb])=>[...aa,...bb].includes(s as never))+1;
  for(let tid=0;tid<ts.length;tid++){const t=ts[tid],points=t.slice(0,3).map(i=>[v[i][0]+8192*col,v[i][2]+8192*row,v[i][1]] as NativePoint);faces.push({id:`${s}/${mid}/${tid}`,section:s,placement:b,mesh:mid,triangle:tid,group,points,normals:t.slice(0,3).map(i=>n[i].slice(0,3)),uv:[0,1,2].map(i=>t.slice(4+i*2,6+i*2)),raw:t,sourceMesh:m,metrics:nativeTriangle(points),geometry:''});}
 }
 const groups=VARIANT_GROUPS.map(([a,b],i)=>compareVariantFaces(faces.filter(f=>(b as readonly number[]).includes(f.section)),faces.filter(f=>(a as readonly number[]).includes(f.section)),i+1));signal?.throwIfAborted();
 return {boundaries,sourceHash:e.source_sha256,payloadHash:e.payload_sha256,meshes,faces,groups,script,bytes:buffer.byteLength,decodeMs:performance.now()-started};
}
export function activeVariantSections(state:number){if(!integer(state,0,4))throw Error('Variant cumulative state');return new Set<number>(VARIANT_GROUPS.slice(0,state).flatMap(([a])=>[...a]));}
export function visibleVariantFaces(data:WorldVariants,state:number){const active=activeVariantSections(state);return data.faces.filter(f=>f.section>=63?active.has(f.section):!VARIANT_GROUPS.slice(0,state).some(([,b])=>(b as readonly number[]).includes(f.section)));}
