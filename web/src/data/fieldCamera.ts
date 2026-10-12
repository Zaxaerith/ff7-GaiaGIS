// SPDX-License-Identifier: GPL-3.0-only
import type {FieldPack} from './fieldContext';
export interface FieldCamera {id:number;offset:number;matrix:number[];translation:number[];repeatedRzz:number;extra:number[];zoom:number;}
export interface BaseTile {x:number;y:number;id:number;offset:number;sourceOffset:number;texture:number;palette:number;}
export interface FieldBackground {status:'unsupported'|'partial'|'static_base';reason?:string;bounds?:number[];layers?:{id:number;width:number;height:number;tiles:number}[];tiles?:BaseTile[];tileCount?:number;paletteRefs?:{id:number;transparent:boolean}[];palettes?:number[][];omitted?:number;pixelBytes?:number;offset?:number;bytes?:number;sha256?:string;}
export interface FieldVisualScene {fieldId:number;cameras:FieldCamera[];background:FieldBackground;reason?:string;}
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
 const v=new DataView(buffer);if(total>64_000_000||v.byteLength<16||new TextDecoder().decode(buffer.slice(0,8))!=='GAIACAM\0'||v.getUint32(8,true)!==1)throw Error('Visual header');
 const length=v.getUint32(12,true),base=16+length;if(length>8_000_000||base>total||buffer.byteLength!==base)throw Error('Visual metadata bounds');
 const meta=shape(JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(buffer.slice(16))),['schema','version','generator_revision','sources','scenes']);
 if(meta.schema!=='gaiagis-field-visual'||meta.version!==1||meta.generator_revision!=='field-visual-1')throw Error('Visual schema');const sources=shape(meta.sources,['flevel.lgp','maplist']);
 if(Object.entries(sources).some(([k,h])=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h)||h!==fields.sources[k]))throw Error('Visual source identity');
 if(!Array.isArray(meta.scenes)||meta.scenes.length>2000)throw Error('Visual scene count');const scenes=new Map<number,FieldVisualScene>();let end=0;
 for(const value of meta.scenes){const r=shape(value,['fieldId','cameras','background'],['reason']);if(r.reason!==undefined&&(typeof r.reason!=='string'||r.reason.length>256))throw Error('Visual reason');if(!int(r.fieldId,0,65535)||scenes.has(r.fieldId)||!fields.nodes.some(n=>n.id===r.fieldId&&n.status==='available')||!Array.isArray(r.cameras)||r.cameras.length>32)throw Error('Visual scene identity');
  for(const [id,value] of r.cameras.entries()){const c=shape(value,['id','offset','matrix','translation','repeatedRzz','extra','zoom']);if(c.id!==id||c.offset!==id*38||!numbers(c.matrix,9,-32768,32767)||!numbers(c.translation,3,-2147483648,2147483647)||!numbers(c.extra,4,0,255)||!int(c.repeatedRzz,-32768,32767)||!int(c.zoom,1,65535))throw Error('Camera record');}
  const b=shape(r.background,['status'],['reason','bounds','layers','tileCount','paletteRefs','omitted','pixelBytes','offset','bytes','sha256']);if(b.reason!==undefined&&(typeof b.reason!=='string'||b.reason.length>256))throw Error('Background reason');if(!['unsupported','partial','static_base'].includes(b.status))throw Error('Background status');
  if(b.status==='unsupported'&&Object.keys(b).some(k=>!['status','reason'].includes(k)))throw Error('Unsupported background payload');
  if(b.status!=='unsupported'){
   if(!numbers(b.bounds,4,-4096,4112)||b.bounds[0]>b.bounds[2]||b.bounds[1]>b.bounds[3]||(b.bounds[2]-b.bounds[0])*(b.bounds[3]-b.bounds[1])>4_000_000||!Array.isArray(b.layers)||b.layers.length!==4||!int(b.tileCount,0,8192)||!int(b.omitted,0,16384)||b.pixelBytes!==b.tileCount*256||b.offset!==end||!int(b.bytes,1,8_000_000)||base+end+b.bytes>total||typeof b.sha256!=='string'||!/^[a-f0-9]{64}$/.test(b.sha256))throw Error('Background budget/span');
   b.layers.forEach((value:unknown,id:number)=>{const l=shape(value,['id','width','height','tiles']);if(l.id!==id||!int(l.width,0,4096)||!int(l.height,0,4096)||!int(l.tiles,0,8192))throw Error('Background layer');});
   if(!Array.isArray(b.paletteRefs)||b.paletteRefs.length>256)throw Error('Palette reference count');let paletteId=-1;for(const value of b.paletteRefs){const p=shape(value,['id','transparent']);if(!int(p.id,0,255)||p.id<=paletteId||typeof p.transparent!=='boolean')throw Error('Palette reference');paletteId=p.id;}
   if(b.tileCount+b.omitted!==b.layers.reduce((s:number,l:{tiles:number})=>s+l.tiles,0))throw Error('Omitted tile accounting');end+=b.bytes;
  }
  scenes.set(r.fieldId,r as FieldVisualScene);
 }if(base+end!==total)throw Error('Visual trailing bytes');return {base,scenes};
}
export async function inflateVisual(buffer:ArrayBuffer,expected:number){
 if(!int(expected,0,8_000_000))throw Error('Visual decoded budget');const reader=new Blob([buffer]).stream().pipeThrough(new DecompressionStream('deflate')).getReader(),out=new Uint8Array(expected);let at=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;if(at+value.length>expected)throw Error('Visual decompression budget');out.set(value,at);at+=value.length;}if(at!==expected)throw Error('Visual decoded length');return out;}finally{await reader.cancel();reader.releaseLock();}
}
/** File handle plus one selected scene's compact pixels; no global image collection. */
export async function openFieldVisual(file:File,fields:FieldPack){
 if(file.name!=='gaia-field-visual.bin'||file.size<16||file.size>64_000_000)throw Error('Visual file bounds');const head=new DataView(await file.slice(0,16).arrayBuffer()),length=head.getUint32(12,true);if(length>8_000_000||16+length>file.size)throw Error('Visual metadata budget');
 const {base,scenes}=parseVisualHeader(await file.slice(0,16+length).arrayBuffer(),file.size,fields);
 return {scenes,async decode(id:number){const scene=scenes.get(id);if(!scene)throw Error('Visual unavailable');const b=scene.background;if(b.status==='unsupported')return {scene,pixels:null};
  const pixels=await inflateVisual(await file.slice(base+b.offset!,base+b.offset!+b.bytes!).arrayBuffer(),b.tileCount!*264+b.paletteRefs!.length*512);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels)),n=>n.toString(16).padStart(2,'0')).join('');if(hash!==b.sha256)throw Error('Visual pixel hash');const v=new DataView(pixels.buffer),tiles:BaseTile[]=[];let previous=-1;
  for(let i=0;i<b.tileCount!;i++){const at=i*8,t={x:v.getInt16(at,true),y:v.getInt16(at+2,true),id:v.getUint16(at+4,true),texture:v.getUint8(at+6),palette:v.getUint8(at+7),offset:i*256,sourceOffset:0};t.sourceOffset=52+t.id*52;if(t.id<=previous||t.id>=b.layers![0].tiles||t.texture>=42||!b.paletteRefs!.some(p=>p.id===t.palette)||t.x<b.bounds![0]||t.y<b.bounds![1]||t.x+16>b.bounds![2]||t.y+16>b.bounds![3])throw Error('Base tile reference');previous=t.id;tiles.push(t);}
  const palettes=b.paletteRefs!.map((_,i)=>Array.from({length:256},(_,k)=>v.getUint16(b.tileCount!*8+i*512+k*2,true)));return {scene:{...scene,background:{...b,tiles,palettes}},pixels:pixels.subarray(b.tileCount!*8+b.paletteRefs!.length*512)};
 }};
}
export function baseBackground(scene:FieldVisualScene,pixels:Uint8Array){
 const b=scene.background,[x,y,right,bottom]=b.bounds!,width=right-x,height=bottom-y;if(pixels.byteLength!==b.pixelBytes)throw Error('Visual pixel length');const rgba=new Uint8ClampedArray(width*height*4);
 for(const t of b.tiles!)for(let row=0;row<16;row++)for(let col=0;col<16;col++){const index=pixels[t.offset+row*16+col],paletteId=b.paletteRefs!.findIndex(p=>p.id===t.palette),palette=b.palettes![paletteId];if(index===0&&b.paletteRefs![paletteId].transparent)continue;const color=palette[index]||palette[0];const at=((t.y-y+row)*width+t.x-x+col)*4;for(let k=0;k<3;k++){const n=(color>>(k*5))&31;rgba[at+k]=(n<<3)|(n>>2);}rgba[at+3]=255;}
 return {rgba,width,height};
}
