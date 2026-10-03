// SPDX-License-Identifier: GPL-3.0-only
import {V1_CANONICAL,validateCanonicalMetadata} from './canonical';
export interface GaiaMeta {
  version: number; sha256: string; byte_length: number; vertex_count: number; triangle_count: number;
  ff7_triangle_count: number; synthetic_triangle_count: number;
  physical_reference_radius_m: number; mercator_max_latitude_deg: number; phi_max_deg: number;
  maximum_cartesian_quantization_error_m: number;
  terrain_names: Record<string,string>; region_names: Record<string,string>;
}
export interface TriangleAttributes {
  terrain: number|null; region: number|null; section: number|null; mesh: number|null;
  triangle: number|null; origin: number; map: number|null; texture: number|null;
  script: number|null; chocobo: boolean|null; capTriangle: number|null;
}
export interface GaiaMesh {
  geographic: Float32Array; indices: Uint32Array; vertexCount: number; triangleCount: number;
  sourceTriangleCount: number; capTriangleCount: number;
  attributes: (triangle:number)=>TriangleAttributes;
}
export function parseMesh(buffer:ArrayBuffer,meta?:GaiaMeta):GaiaMesh {
  if(buffer.byteLength<64) throw new Error('Truncated Gaia header');
  const view=new DataView(buffer);
  const magic=new TextDecoder().decode(new Uint8Array(buffer,0,8));
  if(magic!=='GAIAWEB\0') throw new Error('Not a Gaia Web mesh');
  if(view.getUint16(8,true)!==1) throw new Error('Unsupported Gaia format version');
  if(view.getUint16(10,true)!==64||view.getUint32(12,true)!==1) throw new Error('Unsupported layout/flags');
  const nv=view.getUint32(16,true),nt=view.getUint32(20,true),vo=view.getUint32(24,true),io=view.getUint32(28,true),ao=view.getUint32(32,true);
  const source=view.getUint32(44,true),caps=view.getUint32(48,true);
  if(!nv||!nt||view.getUint32(36,true)!==16||vo!==64||io!==vo+nv*12||ao!==io+nt*12||
    view.getUint32(40,true)!==buffer.byteLength||ao+nt*16!==buffer.byteLength||source+caps!==nt||
    [52,56,60].some(offset=>view.getUint32(offset,true)!==0)) throw new Error('Invalid Gaia counts, offsets or length');
  const littleEndian=new Uint8Array(new Uint16Array([1]).buffer)[0]===1;
  if(!littleEndian) throw new Error('This transport requires a little-endian browser');
  const geographic=new Float32Array(buffer,vo,nv*3),indices=new Uint32Array(buffer,io,nt*3);
  for(let i=0;i<geographic.length;i+=3) {
    if(!Number.isFinite(geographic[i])||Math.abs(geographic[i])>180.00001||!Number.isFinite(geographic[i+1])||Math.abs(geographic[i+1])>90||!Number.isFinite(geographic[i+2])) throw new Error('Invalid geographic vertex');
  }
  for(const index of indices) if(index>=nv) throw new Error('Vertex reference out of range');
  let actualSource=0;
  for(let t=0;t<nt;t++) {
    const p=ao+t*16,origin=view.getUint8(p+8);
    if(origin>2) throw new Error('Unknown geometry origin');
    if(origin===0) {
      actualSource++;
      if(view.getUint8(p)>31||view.getUint8(p+1)>31||view.getUint16(p+2,true)===65535||view.getUint16(p+4,true)===65535||view.getUint16(p+6,true)===65535||view.getUint8(p+9)!==0||view.getUint16(p+14,true)!==65535) throw new Error('Invalid FF7 lineage/attributes');
    } else if(view.getUint8(p)!==255||view.getUint8(p+1)!==255||[2,4,6,10].some(o=>view.getUint16(p+o,true)!==65535)||[9,12,13].some(o=>view.getUint8(p+o)!==255)||view.getUint16(p+14,true)===65535) throw new Error('Synthetic face has fabricated FF7 attributes');
  }
  if(actualSource!==source) throw new Error('Origin count mismatch');
  if(meta&&(meta.version!==1||meta.byte_length!==buffer.byteLength||meta.vertex_count!==nv||meta.triangle_count!==nt||meta.ff7_triangle_count!==source||meta.synthetic_triangle_count!==caps)) throw new Error('Binary / metadata mismatch');
  const u8=(p:number)=>{const v=view.getUint8(p);return v===255?null:v;};
  const u16=(p:number)=>{const v=view.getUint16(p,true);return v===65535?null:v;};
  return {geographic,indices,vertexCount:nv,triangleCount:nt,sourceTriangleCount:source,capTriangleCount:caps,
    attributes(t) {
      if(!Number.isInteger(t)||t<0||t>=nt) throw new Error('Triangle outside dataset');
      const p=ao+t*16,c=u8(p+13);
      return {terrain:u8(p),region:u8(p+1),section:u16(p+2),mesh:u16(p+4),triangle:u16(p+6),origin:view.getUint8(p+8),map:u8(p+9),texture:u16(p+10),script:u8(p+12),chocobo:c===null?null:!!c,capTriangle:u16(p+14)};
    }};
}
export async function loadMesh(onStatus:(s:string)=>void):Promise<{mesh:GaiaMesh;meta:GaiaMeta}> {
  const base=import.meta.env.BASE_URL;
  onStatus('Loading local Gaia dataset…');
  const [metaResponse,meshResponse]=await Promise.all([fetch(`${base}data/gaia-meta.json`),fetch(`${base}data/gaia-mesh.bin`)]);
  if(!metaResponse.ok||!meshResponse.ok||!metaResponse.headers.get('content-type')?.includes('application/json')) throw new MissingDatasetError();
  const meta:GaiaMeta=await metaResponse.json();
  validateCanonicalMetadata(meta);
  const buffer=await meshResponse.arrayBuffer();
  onStatus('Preparing geographic mesh…');
  return decodeDataset(buffer,meta);
}
export class MissingDatasetError extends Error {
  constructor(){super('Open your local V1 dataset to explore Gaia. Game-derived geometry is not included in the source-only release.');}
}
export async function decodeDataset(buffer:ArrayBuffer,meta:GaiaMeta){
  validateCanonicalMetadata(meta);
  if(!globalThis.crypto?.subtle)throw new Error('Checksum verification requires HTTPS or localhost.');
  const digest=await crypto.subtle.digest('SHA-256',buffer);
  const hex=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  if(hex!==meta.sha256)throw new Error('Gaia mesh checksum does not match V1 metadata.');
  return {mesh:parseMesh(buffer,meta),meta};
}
export async function readLocalDataset(files:FileList|File[]){
  const selected=Array.from(files),json=selected.find(f=>f.name==='gaia-meta.json'),binary=selected.find(f=>f.name==='gaia-mesh.bin');
  if(selected.length!==2||!json||!binary)throw new Error('Choose both gaia-meta.json and gaia-mesh.bin together.');
  if(json.size>100_000||binary.size!==V1_CANONICAL.byteLength)throw new Error('These files do not match the supported V1 dataset size.');
  const meta=JSON.parse(await json.text()) as GaiaMeta;
  return decodeDataset(await binary.arrayBuffer(),meta);
}
