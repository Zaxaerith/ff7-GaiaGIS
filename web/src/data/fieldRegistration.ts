// SPDX-License-Identifier: GPL-3.0-only
import {projectField} from './fieldCamera';
import type {BackgroundSelection,FieldCamera} from './fieldCamera';

/** All positions are either original FieldLocal XYZ or named pixel spaces. */
export interface RegistrationSource {kind:'vertex'|'anchor'|'visual';id:string;xyz?:readonly number[];fieldId:number;sourceSHA256?:string;}
export interface PixelRect {x:number;y:number;width:number;height:number;}
export interface RegistrationMapping {screen:PixelRect;reference:PixelRect;}
export interface RegistrationMetadata {
 gameVersion:string;ffNx:string;renderer:string;resolution:string;frameCondition:string;
 crop:string;scaling:string;filters:string;colorSpace:string;hdr:string;notes:string;
}
export interface RegistrationProvenance {contextSHA256:string;flevelSHA256:string;maplistSHA256:string;}
export interface RegistrationPreviewEvidence {generatorRevision?:string;section4SHA256?:string;section9SHA256?:string;selection:BackgroundSelection;}
export const unknownRegistrationMetadata=():RegistrationMetadata=>({gameVersion:'',ffNx:'',renderer:'',resolution:'',frameCondition:'',crop:'',scaling:'',filters:'',colorSpace:'',hdr:'',notes:''});
export const REFERENCE_LIMITS=Object.freeze({bytes:8_000_000,pixels:4_000_000,dimension:4096,points:256});
export interface ReferenceFrame {id:string;sha256:string;width:number;height:number;fieldId:number;cameraId:number|null;metadata:RegistrationMetadata;}
export interface RegistrationPoint {id:number;frameId:string;cameraId:number|null;source:RegistrationSource|null;observed:[number,number];uncertainty:number|null;grade:'manual'|'visual';}
export type Exclusion='visual_only'|'frame_mismatch'|'camera_unknown'|'camera_mismatch'|'mapping_unknown'|'source_mismatch'|'source_identity_unknown'|'invalid_source'|'invalid_observation'|'invalid_projection';
export interface Residual {id:number;observed:[number,number];predicted:[number,number]|null;delta:[number,number]|null;distance:number|null;excluded:Exclusion|null;}
export interface ResidualSummary {unit:'reference pixels';valid:number;excluded:number;rms:number|null;median:number|null;maximum:number|null;records:Residual[];reasons:Partial<Record<Exclusion,number>>;}
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const rect=(r:PixelRect)=>r&&[r.x,r.y,r.width,r.height].every(finite)&&r.width>0&&r.height>0;
export function validMapping(mapping:RegistrationMapping|null,width:number,height:number):mapping is RegistrationMapping {
 if(!mapping||!rect(mapping.screen)||!rect(mapping.reference)||![width,height].every(n=>Number.isSafeInteger(n)&&n>0))return false;
 const r=mapping.reference;
 return r.x>=0&&r.y>=0&&r.x<=width-r.width&&r.y<=height-r.height&&mapping.screen.width<=1e7&&mapping.screen.height<=1e7&&Math.abs(mapping.screen.x)<=1e7&&Math.abs(mapping.screen.y)<=1e7;
}
/** Explicit crop/scale only; this never fits or modifies a Camera or XYZ. */
export function referencePixel(screen:readonly number[],mapping:RegistrationMapping):[number,number] {
 return [mapping.reference.x+(screen[0]-mapping.screen.x)*mapping.reference.width/mapping.screen.width,mapping.reference.y+(screen[1]-mapping.screen.y)*mapping.reference.height/mapping.screen.height];
}
export function registrationResiduals(frame:ReferenceFrame,camera:FieldCamera|null,mapping:RegistrationMapping|null,points:readonly RegistrationPoint[],sourceSHA256?:string):ResidualSummary {
 const records:Residual[]=[],reasons:Partial<Record<Exclusion,number>>={};
 for(const p of points){
  let excluded:Exclusion|null=null,predicted:[number,number]|null=null;
  if(p.grade==='visual'||p.source?.kind==='visual'||!p.source?.xyz)excluded='visual_only';
  else if(p.frameId!==frame.id)excluded='frame_mismatch';
  else if(!camera||frame.cameraId===null||p.cameraId===null)excluded='camera_unknown';
  else if(camera.id!==frame.cameraId||camera.id!==p.cameraId)excluded='camera_mismatch';
  else if(p.source.fieldId!==frame.fieldId)excluded='source_mismatch';
  else if(!sourceSHA256||!p.source.sourceSHA256||!/^([a-f0-9]{64})$/.test(sourceSHA256)||!/^([a-f0-9]{64})$/.test(p.source.sourceSHA256))excluded='source_identity_unknown';
  else if(p.source.sourceSHA256!==sourceSHA256)excluded='source_mismatch';
  else if(p.source.xyz.length!==3||!p.source.xyz.every(finite))excluded='invalid_source';
  else if(p.observed.length!==2||!p.observed.every(finite)||p.observed[0]<0||p.observed[1]<0||p.observed[0]>=frame.width||p.observed[1]>=frame.height)excluded='invalid_observation';
  else if(!validMapping(mapping,frame.width,frame.height))excluded='mapping_unknown';
  else{const screen=projectField(camera,p.source.xyz);if(!screen||!screen.every(finite))excluded='invalid_projection';else{predicted=referencePixel(screen,mapping);if(!predicted.every(finite))excluded='invalid_projection';}}
  let delta=!excluded&&predicted?[p.observed[0]-predicted[0],p.observed[1]-predicted[1]] as [number,number]:null,distance=delta?Math.hypot(...delta):null;
  if(delta&&(!delta.every(finite)||!finite(distance))){excluded='invalid_projection';delta=null;distance=null;}
  records.push({id:p.id,observed:[...p.observed],predicted,delta,distance,excluded});if(excluded)reasons[excluded]=(reasons[excluded]??0)+1;
 }
 const values=records.flatMap(r=>r.distance===null?[]:[r.distance]).sort((a,b)=>a-b),n=values.length;
 return {unit:'reference pixels',valid:n,excluded:records.length-n,rms:n?Math.hypot(...values.map(v=>v/Math.sqrt(n))):null,median:n?values[Math.floor(n/2)]/2+values[Math.ceil(n/2)-1]/2:null,maximum:n?values[n-1]:null,records,reasons};
}

function crc32(bytes:Uint8Array,start:number,end:number){let crc=0xffffffff;for(let i=start;i<end;i++){crc^=bytes[i];for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
/** Strict lossless input profile. Compressed ancillary payloads are deliberately
 * excluded: bounding IDAT alone cannot bound a browser's ICC/text inflater. */
export function inspectReferencePNG(bytes:Uint8Array):{width:number;height:number;channels:number} {
 if(bytes.length<57||bytes.length>REFERENCE_LIMITS.bytes||![137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))throw Error('PNG signature/budget');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),seen=new Set<string>();let at=8,width=0,height=0,idat=false,ended=false,dataEnded=false,metadataBytes=0;
 while(at<bytes.length){
  if(bytes.length-at<12)throw Error('PNG chunk bounds');const length=view.getUint32(at),end=at+12+length;
  if(length>bytes.length-at-12)throw Error('PNG chunk bounds');
  const type=String.fromCharCode(...bytes.subarray(at+4,at+8));if(!/^[A-Za-z]{4}$/.test(type)||crc32(bytes,at+4,end-4)!==view.getUint32(end-4))throw Error('PNG chunk integrity');
  if(at===8){if(type!=='IHDR'||length!==13)throw Error('PNG IHDR');width=view.getUint32(at+8);height=view.getUint32(at+12);if(!width||!height||width>REFERENCE_LIMITS.dimension||height>REFERENCE_LIMITS.dimension||width>REFERENCE_LIMITS.pixels/height||bytes[at+16]!==8||![2,6].includes(bytes[at+17])||bytes[at+18]||bytes[at+19]||bytes[at+20])throw Error('PNG dimensions/profile');}
  else if(type==='IHDR')throw Error('PNG duplicate IHDR');
  if(['acTL','fcTL','fdAT'].includes(type))throw Error('PNG animation unsupported');
  if(!['IHDR','IDAT','IEND'].includes(type)){
   const sizes:Record<string,number>={sRGB:1,gAMA:4,cHRM:32,pHYs:9,bKGD:6,tIME:7,tRNS:6};
   if(type==='PLTE'){if(!length||length>768||length%3)throw Error('PNG palette profile');}
   else if(type==='tEXt'){if(!length||length>16_384)throw Error('PNG text budget');}
   else if(!Object.hasOwn(sizes,type)||length!==sizes[type])throw Error('PNG ancillary profile');
   if(type!=='tEXt'&&seen.has(type)||idat&&!['tEXt','tIME'].includes(type))throw Error('PNG metadata order');
   if(type==='tRNS'&&bytes[25]!==2||type==='sRGB'&&bytes[at+8]>3||type==='pHYs'&&bytes[at+16]>1)throw Error('PNG metadata value');
   metadataBytes+=length;if(metadataBytes>65_536)throw Error('PNG metadata budget');seen.add(type);
  }
  if(type==='IDAT'){if(dataEnded)throw Error('PNG IDAT order');idat=true;}else if(idat)dataEnded=true;
  if(type==='IEND'){if(length||!idat||end!==bytes.length)throw Error('PNG ending');ended=true;}
  else if(type[0]===type[0].toUpperCase()&&!['IHDR','PLTE','IDAT'].includes(type))throw Error('PNG critical chunk');
  at=end;
 }
 if(!ended)throw Error('PNG missing IEND');return {width,height,channels:bytes[25]===6?4:3};
}
/** Independently cap PNG inflate before invoking the browser image decoder. */
export async function validateReferencePNGInflate(bytes:Uint8Array,signal?:AbortSignal){
 const {width,height,channels}=inspectReferencePNG(bytes),parts:Uint8Array<ArrayBuffer>[]=[],row=width*channels+1,total=row*height;let at=8;
 while(at<bytes.length){const view=new DataView(bytes.buffer,bytes.byteOffset+at),size=view.getUint32(0),type=String.fromCharCode(...bytes.subarray(at+4,at+8));if(type==='IDAT')parts.push(bytes.slice(at+8,at+8+size));at+=12+size;}
 const reader=new Blob(parts).stream().pipeThrough(new DecompressionStream('deflate')).getReader();let count=0;
 const abort=()=>{void reader.cancel().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
 try{while(true){if(signal?.aborted)throw new DOMException('Aborted','AbortError');const {done,value}=await reader.read();if(done)break;if(value.length>total-count)throw Error('PNG inflate budget');for(let i=0;i<value.length;i++){if((count+i)%row===0&&value[i]>4)throw Error('PNG filter');}count+=value.length;}if(count!==total)throw Error('PNG inflated size');}
 finally{signal?.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function loadReferencePNG(file:File,signal?:AbortSignal):Promise<{bitmap:ImageBitmap;sha256:string;width:number;height:number}> {
 const check=()=>{if(signal?.aborted)throw new DOMException('Aborted','AbortError');};check();
 if(file.size>REFERENCE_LIMITS.bytes||file.size<57)throw Error('PNG file budget');
 const data=await file.arrayBuffer();check();const bytes=new Uint8Array(data),dimensions=inspectReferencePNG(bytes);await validateReferencePNGInflate(bytes,signal);check();
 const digest=await crypto.subtle.digest('SHA-256',data);check();
 const bitmap=await createImageBitmap(new Blob([data],{type:'image/png'}),{colorSpaceConversion:'none',premultiplyAlpha:'none'});
 if(signal?.aborted||bitmap.width!==dimensions.width||bitmap.height!==dimensions.height){bitmap.close();check();throw Error('PNG decoded dimensions');}
 return {...dimensions,bitmap,sha256:Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')};
}
/** No bitmap, original filename, path, or embedded PNG is exported. */
export function registrationRecord(frame:ReferenceFrame,mapping:RegistrationMapping|null,points:readonly RegistrationPoint[],summary:ResidualSummary,options:{camera?:FieldCamera|null;provenance?:RegistrationProvenance;sourceSHA256?:string;previewEvidence?:RegistrationPreviewEvidence|null}={}) {
 const metadata=Object.fromEntries(Object.entries(frame.metadata).map(([key,value])=>[key,value.trim().slice(0,512)||'UNKNOWN']));
 const c=options.camera,preview=options.previewEvidence;
 return {schema:'gaiagis-registration-research',version:1,evidence:'manual research; original runtime registration NOT VERIFIED',coordinateSpace:'original FieldLocal XYZ; camera screen Y down; reference pixels',frame:{id:frame.id,sha256:frame.sha256,width:frame.width,height:frame.height,fieldId:frame.fieldId,cameraId:frame.cameraId,metadata},
  sources:{contextSHA256:options.provenance?.contextSHA256??'UNKNOWN',flevelSHA256:options.provenance?.flevelSHA256??'UNKNOWN',maplistSHA256:options.provenance?.maplistSHA256??'UNKNOWN',walkmeshSectionSHA256:options.sourceSHA256??'UNKNOWN'},
  camera:c?{evidence:'original Section 2 source values; no calibration',id:c.id,offset:c.offset,matrix:[...c.matrix],translation:[...c.translation],zoom:c.zoom,repeatedRzz:c.repeatedRzz,extra:[...c.extra]}:null,
  preview:preview?{evidence:'GaiaGIS research preview; runtime state UNKNOWN',generatorRevision:preview.generatorRevision??'UNKNOWN',section4SHA256:preview.section4SHA256??'UNKNOWN',section9SHA256:preview.section9SHA256??'UNKNOWN',selection:{...preview.selection,layers:preview.selection.layers?[...preview.selection.layers]:undefined}}:null,
  mapping:mapping?{screen:{...mapping.screen},reference:{...mapping.reference}}:null,points:points.map(p=>({...p,observed:[...p.observed],source:p.source?{...p.source,xyz:p.source.xyz?[...p.source.xyz]:undefined}:null})),residuals:summary};
}
