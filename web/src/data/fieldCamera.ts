// SPDX-License-Identifier: GPL-3.0-only
import type {FieldPack} from './fieldContext';
import {blendChannel,sourceSpan} from './fieldCompositing';
export interface FieldCamera {id:number;offset:number;matrix:number[];translation:number[];repeatedRzz:number;extra:number[];zoom:number;}
export interface BaseTile {x:number;y:number;id:number;layer?:number;offset:number;sourceOffset:number;texture:number;palette:number;size?:number;sx?:number;sy?:number;depth?:number;group?:number;mask?:number;blend?:number;blendType?:number;supportCode?:number;z?:number;rawDepth?:number;sub?:number;}
export interface FieldBackground {status:'unsupported'|'partial'|'static_base'|'static_complete'|'static_partial'|'invalid_source'|'unknown';reason?:string;formatVersion?:2;generatorRevision?:string;section9Bytes?:number;bounds?:number[];layers?:{id:number;width:number;height:number;tiles:number}[];tiles?:BaseTile[];tileCount?:number;supportedTileCount?:number;baseTileCount?:number;conditionalTileCount?:number;paletteRefs?:{id:number;transparent:boolean}[];palettes?:number[][];pages?:{id:number;big:number;depth:number;sourceOffset:number;bytes:number}[];section4SHA256?:string;section9SHA256?:string;omitted?:number;pixelBytes?:number;offset?:number;bytes?:number;rawBytes?:number;sha256?:string;}
export interface FieldVisualScene {fieldId:number;cameras:FieldCamera[];background:FieldBackground;reason?:string;}
export interface BackgroundSelection {base:boolean;conditional:boolean;group:number|null;bit:number|null;layers?:boolean[];rawLayers?:boolean;opaqueOnly?:boolean;highlightBlend?:boolean;}
export const staticBackgroundSelection=():BackgroundSelection=>({base:true,conditional:false,group:null,bit:null});
export const hasBackgroundPayload=(b:FieldBackground)=>b.bounds!==undefined&&b.offset!==undefined;
export const cameraFov=(camera:FieldCamera)=>2*Math.atan(120/camera.zoom)*180/Math.PI;
/** Raw FF7 XYZ -> screen coordinates, positive screen Y points down. No tuning. */
export function projectField(camera:FieldCamera,p:readonly number[]):[number,number]|null{
 const q=[0,1,2].map(i=>camera.translation[i]+[0,1,2].reduce((s,k)=>s+camera.matrix[i*3+k]*p[k]/4096,0));
 if(!q.every(Number.isFinite)||q[2]<=1e-6)return null;return [camera.zoom*q[0]/q[2],camera.zoom*q[1]/q[2]];
}
/** Invert the stored Q12 matrix; transpose is not an exact inverse after rounding. */
export function cameraCenter(c:FieldCamera):number[]|null{
 const [a,b,d,e,f,g,h,i,j]=c.matrix.map(n=>n/4096),co=[f*j-g*i,d*i-b*j,b*g-d*f,g*h-e*j,a*j-d*h,d*e-a*g,e*i-f*h,b*h-a*i,a*f-b*e],det=a*co[0]+b*co[3]+d*co[6];
 if(Math.abs(det)<1e-12)return null;return [0,1,2].map(k=>-co.slice(k*3,k*3+3).reduce((s,n,i)=>s+n*c.translation[i],0)/det);
}
const int=(n:unknown,lo=0,hi=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&Number(n)>=lo&&Number(n)<=hi;
const shape=(v:unknown,required:string[],optional:string[]=[])=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Visual object');const r=v as Record<string,any>;if(required.some(k=>!Object.hasOwn(r,k))||Object.keys(r).some(k=>![...required,...optional].includes(k)))throw Error('Visual shape');return r;};
const numbers=(v:unknown,length:number,lo:number,hi:number):v is number[]=>Array.isArray(v)&&v.length===length&&v.every(n=>int(n,lo,hi));
export function parseVisualHeader(buffer:ArrayBuffer,total:number,fields:FieldPack){
 const v=new DataView(buffer);if(v.byteLength>=16&&v.getUint32(8,true)===2)return parseVisualHeader2(buffer,total,fields);if(total>64_000_000||v.byteLength<16||new TextDecoder().decode(buffer.slice(0,8))!=='GAIACAM\0'||v.getUint32(8,true)!==1)throw Error('Visual header');
 const length=v.getUint32(12,true),base=16+length;if(length>8_000_000||base>total||buffer.byteLength!==base)throw Error('Visual metadata bounds');
 const meta=shape(JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(buffer.slice(16))),['schema','version','generator_revision','sources','scenes']);
 if(meta.schema!=='gaiagis-field-visual'||meta.version!==1||!['field-visual-1','field-visual-2'].includes(meta.generator_revision))throw Error('Visual schema');const sources=shape(meta.sources,['flevel.lgp','maplist']);
 if(Object.entries(sources).some(([k,h])=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h)||h!==fields.sources[k]))throw Error('Visual source identity');
 if(!Array.isArray(meta.scenes)||meta.scenes.length>2000)throw Error('Visual scene count');const scenes=new Map<number,FieldVisualScene>();let end=0;
 for(const value of meta.scenes){const r=shape(value,['fieldId','cameras','background'],['reason']);if(r.reason!==undefined&&(typeof r.reason!=='string'||r.reason.length>256))throw Error('Visual reason');if(!int(r.fieldId,0,65535)||scenes.has(r.fieldId)||!fields.nodes.some(n=>n.id===r.fieldId&&n.status==='available')||!Array.isArray(r.cameras)||r.cameras.length>32)throw Error('Visual scene identity');
  for(const [id,value] of r.cameras.entries()){const c=shape(value,['id','offset','matrix','translation','repeatedRzz','extra','zoom']);if(c.id!==id||c.offset!==id*38||!numbers(c.matrix,9,-32768,32767)||!numbers(c.translation,3,-2147483648,2147483647)||!numbers(c.extra,4,0,255)||!int(c.repeatedRzz,-32768,32767)||!int(c.zoom,1,65535))throw Error('Camera record');}
  const b=shape(r.background,['status'],['reason','bounds','layers','tileCount','paletteRefs','omitted','pixelBytes','offset','bytes','sha256']);if(b.reason!==undefined&&(typeof b.reason!=='string'||b.reason.length>256))throw Error('Background reason');if(!['unsupported','partial','static_base'].includes(b.status))throw Error('Background status');
  if(b.status==='unsupported'&&Object.keys(b).some(k=>!['status','reason'].includes(k)))throw Error('Unsupported background payload');
  if(b.status!=='unsupported'){
   if(!numbers(b.bounds,4,-4096,4112)||b.bounds[0]>b.bounds[2]||b.bounds[1]>b.bounds[3]||(b.bounds[2]-b.bounds[0])*(b.bounds[3]-b.bounds[1])>4_000_000||!Array.isArray(b.layers)||b.layers.length!==4||!int(b.tileCount,0,meta.generator_revision==='field-visual-1'?8192:16384)||!int(b.omitted,0,16384)||b.pixelBytes!==b.tileCount*256||b.offset!==end||!int(b.bytes,1,8_000_000)||base+end+b.bytes>total||typeof b.sha256!=='string'||!/^[a-f0-9]{64}$/.test(b.sha256))throw Error('Background budget/span');
   b.layers.forEach((value:unknown,id:number)=>{const l=shape(value,['id','width','height','tiles']);if(l.id!==id||!int(l.width,0,4096)||!int(l.height,0,4096)||!int(l.tiles,0,8192))throw Error('Background layer');});
   if(!Array.isArray(b.paletteRefs)||b.paletteRefs.length>256)throw Error('Palette reference count');let paletteId=-1;for(const value of b.paletteRefs){const p=shape(value,['id','transparent']);if(!int(p.id,0,255)||p.id<=paletteId||typeof p.transparent!=='boolean')throw Error('Palette reference');paletteId=p.id;}
   const totalTiles=b.layers.reduce((s:number,l:{tiles:number})=>s+l.tiles,0),supportedPool=b.layers[0].tiles+(meta.generator_revision==='field-visual-2'?b.layers[1].tiles:0);
   if(totalTiles>16384||b.tileCount>supportedPool||b.tileCount+b.omitted!==totalTiles)throw Error('Omitted tile accounting');end+=b.bytes;
  }
  scenes.set(r.fieldId,r as FieldVisualScene);
 }if(base+end!==total)throw Error('Visual trailing bytes');return {base,scenes,revision:meta.generator_revision as string,version:1 as const};
}
/** Transport 2 is a separate contract; v1 descriptors are never reinterpreted. */
function parseVisualHeader2(buffer:ArrayBuffer,total:number,fields:FieldPack){
 const v=new DataView(buffer);if(total>100_000_000||v.byteLength<16||new TextDecoder().decode(buffer.slice(0,8))!=='GAIACAM\0'||v.getUint32(8,true)!==2)throw Error('Visual header');
 const length=v.getUint32(12,true),base=16+length;if(length>8_000_000||base>total||buffer.byteLength!==base)throw Error('Visual metadata bounds');
 const meta=shape(JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(buffer.slice(16))),['schema','version','generator_revision','sources','scenes']);
 if(total>(meta.generator_revision==='field-visual-4'?100_000_000:96_000_000))throw Error('Visual header profile budget');
 if(meta.schema!=='gaiagis-field-visual'||meta.version!==2||!['field-visual-3','field-visual-4'].includes(meta.generator_revision))throw Error('Visual schema');const sources=shape(meta.sources,['flevel.lgp','maplist']);
 const hash=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
 if(Object.entries(sources).some(([k,h])=>!hash(h)||h!==fields.sources[k]))throw Error('Visual source identity');
 if(!Array.isArray(meta.scenes)||meta.scenes.length>2000)throw Error('Visual scene count');const scenes=new Map<number,FieldVisualScene>();let end=0;
 for(const value of meta.scenes){
  const r=shape(value,['fieldId','cameras','background'],['reason']);if(r.reason!==undefined&&(typeof r.reason!=='string'||r.reason.length>256))throw Error('Visual reason');
  if(!int(r.fieldId,0,65535)||scenes.has(r.fieldId)||!fields.nodes.some(n=>n.id===r.fieldId&&n.status==='available')||!Array.isArray(r.cameras)||r.cameras.length>32)throw Error('Visual scene identity');
  for(const [id,value]of r.cameras.entries()){const c=shape(value,['id','offset','matrix','translation','repeatedRzz','extra','zoom']);if(c.id!==id||c.offset!==id*38||!numbers(c.matrix,9,-32768,32767)||!numbers(c.translation,3,-2147483648,2147483647)||!numbers(c.extra,4,0,255)||!int(c.repeatedRzz,-32768,32767)||!int(c.zoom,1,65535))throw Error('Camera record');}
  const payload=['bounds','layers','tileCount','supportedTileCount','baseTileCount','conditionalTileCount','omitted','pixelBytes','paletteRefs','pages','offset','bytes','rawBytes','sha256'];
  const b=shape(r.background,['status'],['reason','section4SHA256','section9SHA256',...payload,...(meta.generator_revision==='field-visual-4'?['section9Bytes']:[])]),hasHashes=Object.hasOwn(b,'section4SHA256')||Object.hasOwn(b,'section9SHA256');
  if(!['static_complete','static_partial','unsupported','invalid_source','unknown'].includes(b.status)||hasHashes&&(!hash(b.section4SHA256)||!hash(b.section9SHA256))||!hasHashes&&(b.status!=='unknown'||Object.hasOwn(b,'bounds'))||b.reason!==undefined&&(typeof b.reason!=='string'||b.reason.length>256))throw Error('Background status/source');
  if(!Object.hasOwn(b,'bounds')){if(['static_complete','static_partial'].includes(b.status)||payload.some(k=>Object.hasOwn(b,k)))throw Error('Background missing payload');}
  else{
   if(meta.generator_revision==='field-visual-4'&&(!Object.hasOwn(b,'section9Bytes')||!sourceSpan(0,b.section9Bytes)))throw Error('Background source length');
   if(payload.some(k=>!Object.hasOwn(b,k))||!numbers(b.bounds,4,-4096,4128)||b.bounds[0]>b.bounds[2]||b.bounds[1]>b.bounds[3]||(b.bounds[2]-b.bounds[0])*(b.bounds[3]-b.bounds[1])>4_000_000)throw Error('Background bounds');
   if(!Array.isArray(b.layers)||b.layers.length!==4||!int(b.tileCount,0,16384)||!int(b.supportedTileCount,0,b.tileCount)||!int(b.baseTileCount,0,b.supportedTileCount)||!int(b.conditionalTileCount,0,b.tileCount)||!int(b.omitted,0,b.tileCount)||b.omitted+b.supportedTileCount!==b.tileCount)throw Error('Background tile accounting');
   b.layers.forEach((value:unknown,id:number)=>{const l=shape(value,['id','width','height','tiles']);if(l.id!==id||!int(l.width,0,4096)||!int(l.height,0,4096)||!int(l.tiles,0,8192))throw Error('Background layer');});
   if(b.layers.reduce((s:number,l:{tiles:number})=>s+l.tiles,0)!==b.tileCount)throw Error('Background layer accounting');
   if(!Array.isArray(b.paletteRefs)||b.paletteRefs.length>256)throw Error('Palette reference count');let last=-1;
   for(const value of b.paletteRefs){const p=shape(value,['id','transparent']);if(!int(p.id,0,255)||p.id<=last||typeof p.transparent!=='boolean')throw Error('Palette reference');last=p.id;}
   if(!Array.isArray(b.pages)||b.pages.length>42)throw Error('Background page count');last=-1;
   for(const value of b.pages){const p=shape(value,['id','big','depth','sourceOffset','bytes']);if(!int(p.id,0,41)||p.id<=last||!int(p.big,0,1)||!int(p.depth,0,2)||!int(p.sourceOffset,40,8_000_000)||p.bytes!==[32768,65536,131072][p.depth]||!sourceSpan(p.sourceOffset,p.bytes,b.section9Bytes??8_000_000))throw Error('Background page');last=p.id;}
   if(!int(b.pixelBytes,0,8_000_000)||b.rawBytes!==b.tileCount*36+b.paletteRefs.length*512+b.pixelBytes||!int(b.rawBytes,0,8_000_000)||b.offset!==end||!int(b.bytes,1,8_000_000)||base+end+b.bytes>total||!hash(b.sha256))throw Error('Background budget/span');end+=b.bytes;
  }
  scenes.set(r.fieldId,{...r,background:{...b,formatVersion:2,generatorRevision:meta.generator_revision}} as FieldVisualScene);
 }
 if(base+end!==total)throw Error('Visual trailing bytes');return {base,scenes,revision:meta.generator_revision as string,version:2 as const};
}
export async function inflateVisual(buffer:ArrayBuffer,expected:number,signal?:AbortSignal){
 if(!int(expected,0,8_000_000))throw Error('Visual decoded budget');const reader=new Blob([buffer]).stream().pipeThrough(new DecompressionStream('deflate')).getReader(),out=new Uint8Array(expected);let at=0;
 const cancel=()=>{void reader.cancel().catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
 try{signal?.throwIfAborted();for(;;){const {done,value}=await reader.read();signal?.throwIfAborted();if(done)break;if(at+value.length>expected)throw Error('Visual decompression budget');out.set(value,at);at+=value.length;}if(at!==expected)throw Error('Visual decoded length');return out;}finally{signal?.removeEventListener('abort',cancel);await reader.cancel();reader.releaseLock();}
}
/** File handle plus one selected scene's compact pixels; no global image collection. */
export async function openFieldVisual(file:File,fields:FieldPack){
 if(file.name!=='gaia-field-visual.bin'||file.size<16||file.size>100_000_000)throw Error('Visual file bounds');const head=new DataView(await file.slice(0,16).arrayBuffer()),length=head.getUint32(12,true);if(head.getUint32(8,true)!==2&&file.size>64_000_000)throw Error('Visual file bounds');if(length>8_000_000||16+length>file.size)throw Error('Visual metadata budget');
 const {base,scenes,revision,version}=parseVisualHeader(await file.slice(0,16+length).arrayBuffer(),file.size,fields);
 return {scenes,version,revision,async decode(id:number,signal?:AbortSignal){signal?.throwIfAborted();const scene=scenes.get(id);if(!scene)throw Error('Visual unavailable');const b=scene.background;if(!hasBackgroundPayload(b))return {scene,pixels:null};
  const pixels=await inflateVisual(await file.slice(base+b.offset!,base+b.offset!+b.bytes!).arrayBuffer(),version===2?b.rawBytes!:b.tileCount!*264+b.paletteRefs!.length*512,signal);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels)),n=>n.toString(16).padStart(2,'0')).join('');signal?.throwIfAborted();if(hash!==b.sha256)throw Error('Visual pixel hash');if(version===2)return decodeBackground2(scene,pixels);const v=new DataView(pixels.buffer),tiles:BaseTile[]=[],seen=new Set<string>();let previous=-1;
  for(let i=0;i<b.tileCount!;i++){const at=i*8,encoded=v.getUint8(at+6),layer=revision==='field-visual-2'?encoded>>>6:0,t={x:v.getInt16(at,true),y:v.getInt16(at+2,true),id:v.getUint16(at+4,true),layer,texture:revision==='field-visual-2'?encoded&63:encoded,palette:v.getUint8(at+7),offset:i*256,sourceOffset:0};t.sourceOffset=(layer===0?52:52+b.layers![0].tiles*52+27)+t.id*52;const key=layer+':'+t.id;if(layer>1||seen.has(key)||revision==='field-visual-1'&&t.id<=previous||t.id>=b.layers![layer].tiles||t.texture>=42||!b.paletteRefs!.some(p=>p.id===t.palette)||t.x<b.bounds![0]||t.y<b.bounds![1]||t.x+16>b.bounds![2]||t.y+16>b.bounds![3])throw Error('Base tile reference');seen.add(key);previous=t.id;tiles.push(t);}
  const palettes=b.paletteRefs!.map((_,i)=>Array.from({length:256},(_,k)=>v.getUint16(b.tileCount!*8+i*512+k*2,true)));return {scene:{...scene,background:{...b,tiles,palettes}},pixels:pixels.subarray(b.tileCount!*8+b.paletteRefs!.length*512)};
 }};
}
function decodeBackground2(scene:FieldVisualScene,raw:Uint8Array){
 const b=scene.background,v=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),tiles:BaseTile[]=[],seen=new Set<string>(),pixelSpans=new Map<string,number>(),storedSpans=new Map<number,number>(),layerStarts=new Map<number,number>();let pixelEnd=0,supported=0,base=0,conditional=0;let previous:BaseTile|null=null;
 for(let i=0;i<b.tileCount!;i++){
  const at=i*36,t:BaseTile={x:v.getInt16(at,true),y:v.getInt16(at+2,true),id:v.getUint16(at+4,true),layer:v.getUint8(at+6),size:v.getUint8(at+7),sourceOffset:v.getUint32(at+8,true),sx:v.getUint16(at+12,true),sy:v.getUint16(at+14,true),texture:v.getUint8(at+16),palette:v.getUint8(at+17),depth:v.getUint8(at+18),group:v.getUint8(at+19),mask:v.getUint8(at+20),blend:v.getUint8(at+21),blendType:v.getUint8(at+22),supportCode:v.getUint8(at+23),z:v.getUint16(at+24,true),rawDepth:v.getUint16(at+26,true),sub:v.getUint32(at+28,true),offset:v.getUint32(at+32,true)};
  const key=t.layer+':'+t.id,page=b.pages!.find(p=>p.id===t.texture),isConditional=t.layer!>0&&(t.group!==0||t.mask!==0);
  const outside=Math.abs(t.x)>4096||Math.abs(t.y)>4096,modern=b.generatorRevision==='field-visual-4',expectedCode=outside?4:modern?(t.layer!>0&&(t.group===0)!==(t.mask===0)?3:t.layer!>0&&t.blend&&(t.blend!==1||t.depth===2||![1,2].includes(t.blendType!))?1:t.layer!>1?5:0):t.layer!>1?2:t.layer!>0&&t.blend?1:t.layer!>0&&(t.group===0)!==(t.mask===0)?3:0;
  if(t.layer!>3||t.size!==(t.layer!<2?16:32)||seen.has(key)||t.id>=b.layers![t.layer!].tiles||t.sourceOffset<52||!sourceSpan(t.sourceOffset,52,b.section9Bytes??8_000_000)||!page||page.depth!==t.depth||t.supportCode!==expectedCode||t.sx!+t.size!>256||t.sy!+t.size!>256||!outside&&(t.x<b.bounds![0]||t.y<b.bounds![1]||t.x+t.size!>b.bounds![2]||t.y+t.size!>b.bounds![3]))throw Error('Background tile reference');
  const layerStart=t.sourceOffset-t.id*52;if(layerStart<0||t.layer===0&&layerStart!==52||layerStarts.has(t.layer!)&&layerStarts.get(t.layer!)!==layerStart)throw Error('Background source offset');layerStarts.set(t.layer!,layerStart);
  if(previous&&(previous.z!<t.z!||previous.z===t.z&&(previous.sub!<t.sub!||previous.sub===t.sub&&(previous.layer!>t.layer!||previous.layer===t.layer&&previous.id>=t.id))))throw Error('Background draw order');
  if(t.supportCode===0||t.supportCode===5){
   if(!modern&&(t.layer!>1||t.layer!>0&&t.blend!==0)||t.depth!>2||t.layer!>0&&(t.group===0)!==(t.mask===0)||t.depth!==2&&!b.paletteRefs!.some(p=>p.id===t.palette))throw Error('Background supported tile');
   const pixelKey=[t.texture,t.sx,t.sy,t.size].join(':'),prior=pixelSpans.get(pixelKey),bytes=t.size!*t.size!*(t.depth===2?2:1);
   if(prior===undefined){
    if(modern){if(!sourceSpan(t.offset,bytes,b.pixelBytes)||storedSpans.has(t.offset)&&storedSpans.get(t.offset)!==bytes)throw Error('Background pixel bounds');storedSpans.set(t.offset,bytes);pixelSpans.set(pixelKey,t.offset);}
    else{if(t.offset!==pixelEnd||pixelEnd+bytes>b.pixelBytes!)throw Error('Background pixel bounds');pixelSpans.set(pixelKey,t.offset);pixelEnd+=bytes;}
   }else if(t.offset!==prior)throw Error('Background shared pixel span');if(t.supportCode===0){supported++;if(!isConditional)base++;}
  }else if(t.offset!==0xffffffff)throw Error('Background unsupported pixel span');
  if(isConditional)conditional++;seen.add(key);tiles.push(t);previous=t;
 }
 if(b.generatorRevision==='field-visual-4')for(const [start,bytes]of [...storedSpans].sort((a,b)=>a[0]-b[0])){if(start!==pixelEnd)throw Error('Background pixel coverage');pixelEnd+=bytes;}
 if(pixelEnd!==b.pixelBytes||supported!==b.supportedTileCount||base!==b.baseTileCount||conditional!==b.conditionalTileCount)throw Error('Background decoded accounting');
 if(b.generatorRevision==='field-visual-4'){
  const footprint=tiles.filter(t=>t.supportCode!==4),bounds=[Math.min(...footprint.map(t=>t.x)),Math.min(...footprint.map(t=>t.y)),Math.max(...footprint.map(t=>t.x+t.size!)),Math.max(...footprint.map(t=>t.y+t.size!))];if(!footprint.length)bounds.fill(0);
  const status=!base?'unsupported':tiles.some(t=>!isConditionalTile(t)&&t.supportCode!==0)?'static_partial':'static_complete';
  if(bounds.some((v,i)=>v!==b.bounds![i])||status!==b.status||tiles.some(t=>t.rawDepth!>255||t.layer===0&&t.z!==4095))throw Error('Background derived bounds/status');
 }
 const palettes=b.paletteRefs!.map((_,i)=>Array.from({length:256},(_,k)=>v.getUint16(b.tileCount!*36+i*512+k*2,true))),pixels=raw.subarray(b.tileCount!*36+b.paletteRefs!.length*512);
 for(const t of tiles)if([0,5].includes(t.supportCode!)&&t.depth===0&&pixels.subarray(t.offset,t.offset+t.size!*t.size!).some(n=>n>15))throw Error('Background 4-bit index');
 return {scene:{...scene,background:{...b,tiles,palettes}},pixels};
}
export function baseBackground(scene:FieldVisualScene,pixels:Uint8Array):{rgba:Uint8ClampedArray;width:number;height:number}{
 if(scene.background.formatVersion===2)return composeBackground(scene,pixels,staticBackgroundSelection());
 const b=scene.background,[x,y,right,bottom]=b.bounds!,width=right-x,height=bottom-y;if(pixels.byteLength!==b.pixelBytes)throw Error('Visual pixel length');const rgba=new Uint8ClampedArray(width*height*4);
 for(const t of b.tiles!)for(let row=0;row<16;row++)for(let col=0;col<16;col++){const index=pixels[t.offset+row*16+col],paletteId=b.paletteRefs!.findIndex(p=>p.id===t.palette),palette=b.palettes![paletteId];if(index===0&&b.paletteRefs![paletteId].transparent)continue;/* PC zero-valued CLUT entries alias color 0; nonzero green is ordinary opaque color. */const color=palette[index]===0?palette[0]:palette[index];const at=((t.y-y+row)*width+t.x-x+col)*4;for(let k=0;k<3;k++){const n=(color>>(k*5))&31;rgba[at+k]=(n<<3)|(n>>2);}rgba[at+3]=255;}
 return {rgba,width,height};
}
/** Raw tile condition, independent of Trigger association and runtime execution. */
export function isConditionalTile(t:BaseTile){return (t.layer??0)>0&&((t.group??0)!==0||(t.mask??0)!==0);}
export function selectedBackgroundTiles(scene:FieldVisualScene,selection:BackgroundSelection){
 return (scene.background.tiles??[]).filter(t=>isConditionalTile(t)?selection.conditional&&selection.group===t.group&&selection.bit!==null&&selection.bit>=0&&selection.bit<8&&!!((t.mask??0)&(1<<selection.bit)):selection.base);
}
export function backgroundStateOptions(scene:FieldVisualScene){
 const groups=new Map<number,{group:number;bits:{bit:number;total:number;supported:number}[]}>();
 for(const t of scene.background.tiles??[]){if(!isConditionalTile(t))continue;const group=t.group!;let entry=groups.get(group);if(!entry){entry={group,bits:[]};groups.set(group,entry);}for(let bit=0;bit<8;bit++){if(!(t.mask!&(1<<bit)))continue;let option=entry.bits.find(o=>o.bit===bit);if(!option){option={bit,total:0,supported:0};entry.bits.push(option);}option.total++;if(t.supportCode===0)option.supported++;}}
 return [...groups.values()].sort((a,b)=>a.group-b.group).map(g=>({...g,bits:g.bits.sort((a,b)=>a.bit-b.bit)}));
}
/** Per-layer diagnostics separate state applicability from visibility controls. */
export function backgroundLayerStats(scene:FieldVisualScene,selection:BackgroundSelection){
 const applicable=new Set(selectedBackgroundTiles(scene,selection));
 return [0,1,2,3].map(layer=>{const raw=(scene.background.tiles??[]).filter(t=>t.layer===layer),active=raw.filter(t=>applicable.has(t)),enabled=selection.layers?.[layer]??layer<2;
  const drawable=(t:BaseTile)=>t.supportCode===0||t.supportCode===5&&selection.rawLayers;
  return {layer,raw:raw.length,applicable:active.length,visible:enabled?active.filter(t=>drawable(t)&&!(selection.opaqueOnly&&t.layer!>0&&t.blend)).length:0,
   blend:raw.filter(t=>t.layer!>0&&t.blend).length,runtime:layer>1&&raw.length>0,
   omitted:{blend:active.filter(t=>t.supportCode===1).length,position:active.filter(t=>t.supportCode===4).length,condition:active.filter(t=>t.supportCode===3).length,runtime:active.filter(t=>t.supportCode===2||t.supportCode===5&&!selection.rawLayers).length}};
 });
}
/** Recompose only the selected scene's decoded pixels; no archive or texture read.
 * Raw-position layers use the stored Z/Sub order as an explicit experiment;
 * they do not reproduce FF7's camera-dependent scrolling or dynamic Z. */
export function composeBackground(scene:FieldVisualScene,pixels:Uint8Array,selection:BackgroundSelection):{rgba:Uint8ClampedArray;width:number;height:number;visible:number;unsupported:number;total:number}{
 const b=scene.background;if(b.formatVersion!==2){const image=baseBackground(scene,pixels);return {...image,visible:b.tileCount??0,unsupported:b.omitted??0,total:b.tileCount??0};}
 const [x,y,right,bottom]=b.bounds!,width=right-x,height=bottom-y;if(pixels.byteLength!==b.pixelBytes)throw Error('Visual pixel length');const rgba=new Uint8ClampedArray(width*height*4),selected=selectedBackgroundTiles(scene,selection);let visible=0,unsupported=0;
 const paletteMap=new Map(b.paletteRefs!.map((p,i)=>[p.id,{transparent:p.transparent,colors:b.palettes![i]}]));
 for(const tile of selected){
  if(!(selection.layers?.[tile.layer!]??(tile.layer!<2||b.generatorRevision!=='field-visual-4')))continue;
  if(tile.supportCode!==0&&!(tile.supportCode===5&&selection.rawLayers)){unsupported++;continue;}
  if(selection.opaqueOnly&&tile.layer!>0&&tile.blend)continue;
  visible++;const palette=paletteMap.get(tile.palette);
  for(let row=0;row<tile.size!;row++)for(let col=0;col<tile.size!;col++){
   const pixel=row*tile.size!+col,at=((tile.y-y+row)*width+tile.x-x+col)*4;let color:number,shifts:number[];
   if(tile.depth===2){const offset=tile.offset+pixel*2,word=pixels[offset]|pixels[offset+1]<<8;if(word===0)continue;color=word===0x0821?0:word;shifts=[11,6,0];}
   else{const index=pixels[tile.offset+pixel];if(index===0&&palette!.transparent)continue;color=palette!.colors[index]===0?palette!.colors[0]:palette!.colors[index];shifts=[0,5,10];}
   for(let k=0;k<3;k++){const n=(color>>shifts[k])&31,front=(n<<3)|(n>>2);rgba[at+k]=tile.layer!>0&&tile.blend?blendChannel(rgba[at+k],front,tile.blendType!):front;}rgba[at+3]=255;
   if(selection.highlightBlend&&tile.layer!>0&&tile.blend&&(row===0||col===0||row===tile.size!-1||col===tile.size!-1)){rgba[at]=255;rgba[at+1]=0;rgba[at+2]=255;}
  }
 }
 return {rgba,width,height,visible,unsupported,total:b.tileCount!};
}
