// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {decodeTextures,textureAlpha,cornerWeights,displayTextureAttributes,parseTextureTransport,WM0_TEXTURE_SOURCE} from '../src/data/textures';
import type {DecodedTextures,TexturePack} from '../src/data/textures';
import {applyRelief,reliefRadius} from '../src/viewer/relief';
import {prepareDisplay,projectDisplay} from '../src/data/display';
import type {GaiaMesh,GaiaMeta} from '../src/data/mesh';
import {projections} from '../src/projections';
import {measureDistance,measureArea} from '../src/analysis/sphere';
import {dictionaries} from '../src/i18n';
const meta={sha256:'a'.repeat(64)} as GaiaMeta;
function mesh(points=[[-10,0,0],[10,0,100],[0,10,200]]):GaiaMesh{return {geographic:new Float32Array(points.flat()),indices:new Uint32Array([0,1,2]),vertexCount:3,triangleCount:1,sourceTriangleCount:1,capTriangleCount:0,attributes:()=>({terrain:0,region:0,section:0,mesh:0,triangle:0,origin:0,map:0,texture:0,script:0,chocobo:false,capTriangle:null})};}
function transport(mutate:(m:TexturePack)=>void=()=>{}){const m={schema:'gaiagis-textures',version:1,mapId:'WM0',reconstruction:'V1 Geometric Gaia',mesh_sha256:meta.sha256,sources:{'wm0.map':WM0_TEXTURE_SOURCE,'world_us.lgp':'c'.repeat(64)},atlas:{width:256,height:256,padding:4},textures:[{id:0,name:'synthetic',width:32,height:32,x:4,y:4,u_offset:32,v_offset:64,has_alpha:false,format:{paletted:true,color_key:false}}],triangle_count:1,uv_record_bytes:14,uv_byte_length:14,image_byte_length:64,payload_sha256:'b'.repeat(64)};mutate(m);const json=new TextEncoder().encode(JSON.stringify(m)),buffer=new ArrayBuffer(16+json.length+110),v=new DataView(buffer);new Uint8Array(buffer).set(new TextEncoder().encode('GAIATEX\0'));v.setUint32(8,1,true);v.setUint32(12,json.length,true);new Uint8Array(buffer,16,json.length).set(json);new Uint8Array(buffer,16+json.length+8,6).set([32,64,64,64,32,96]);return buffer;}
const context={radius:6371008.8,mercatorLimit:85.0511287798066,centerLon:0,centerLat:0};
describe('optional texture transport',()=>{
 it('accepts synthetic source-bound pack',()=>expect(parseTextureTransport(transport(),mesh(),meta).records.size).toBe(1));
 for(const [name,change]of Object.entries({schema:(m:TexturePack):unknown=>m.schema='bad',version:(m:TexturePack):unknown=>m.version=2,map:(m:TexturePack):unknown=>m.mapId='WM2',hash:(m:TexturePack):unknown=>m.mesh_sha256='x',source:(m:TexturePack):unknown=>m.sources['wm0.map']='x',count:(m:TexturePack):unknown=>m.triangle_count=2,layout:(m:TexturePack):unknown=>m.uv_record_bytes=13,image:(m:TexturePack):unknown=>m.image_byte_length=0,atlas:(m:TexturePack):unknown=>m.atlas.width=257,rectangle:(m:TexturePack):unknown=>m.textures[0].x=255,overlap:(m:TexturePack):unknown=>m.textures.push({...m.textures[0],id:1})}))it(`rejects ${name}`,()=>expect(()=>parseTextureTransport(transport(change),mesh(),meta)).toThrow());
 it('rejects corrupt UV lineage',()=>{const b=transport(),v=new DataView(b),p=16+v.getUint32(12,true);v.setUint16(p+4,3,true);expect(()=>parseTextureTransport(b,mesh(),meta)).toThrow();});
 it('rejects truncated metadata',()=>expect(()=>parseTextureTransport(transport().slice(0,20),mesh(),meta)).toThrow());
 it('does not mutate canonical mesh on rejection',()=>{const m=mesh(),before=m.geographic.slice();expect(()=>parseTextureTransport(transport(x=>x.mapId='bad'),m,meta)).toThrow();expect(m.geographic).toEqual(before);});
});
describe('per-corner UV interpolation',()=>{
 it('same position keeps different per-triangle UV',()=>{const m=mesh(),p=parseTextureTransport(transport(),m,meta),uv=new DataView(new ArrayBuffer(28));for(let i=0;i<14;i++){uv.setUint8(i,p.uv.getUint8(i));uv.setUint8(i+14,p.uv.getUint8(i));}uv.setUint8(22,48);m.indices=new Uint32Array([0,1,2,0,1,2]);m.triangleCount=m.sourceTriangleCount=2;m.attributes=t=>({...mesh().attributes(0),triangle:t});p.records.set('0/0/1',14);const a=displayTextureAttributes({...p,uv},m,prepareDisplay(m));expect(a.uv[0]).toBe(0);expect(a.uv[6]).toBe(.5);});
 it('alpha repeat and missing fallback',()=>{const p=parseTextureTransport(transport(),mesh(),meta),r={...p.resources.get(0)!,width:2,height:1},pack={resources:new Map([[0,r]]),alphas:new Map([[0,new Uint8Array([0,255])]])};expect(textureAlpha(pack,0,0,0)).toBe(0);expect(textureAlpha(pack,0,.75,0)).toBe(1);expect(textureAlpha(pack,0,-.25,0)).toBe(1);expect(textureAlpha(pack,0,.5,0,true)).toBe(.5);expect(textureAlpha(pack,1,0,0)).toBe(1);});
 it('corrupt checksum rejects before image decode',async()=>{await expect(decodeTextures(transport(),mesh(),meta)).rejects.toThrow('checksum');});

 it('vertex corners retain distinct values',()=>{const m=mesh(),p=parseTextureTransport(transport(),m,meta),attrs=displayTextureAttributes(p,m,prepareDisplay(m));expect(Array.from(attrs.uv)).toEqual([0,0,1,0,0,1]);});
 it('interpolates in triangle interior',()=>expect(cornerWeights(0,5,[[-10,0,0],[10,0,0],[0,10,0]])).toEqual([.25,.25,.5]));
 it('unwraps antimeridian',()=>{const w=cornerWeights(180,5,[[179,0,0],[-179,0,0],[180,10,0]]);expect(w).toEqual([.25,.25,.5]);});
 it('retains vertical corner identity',()=>expect(cornerWeights(1,0,[[0,0,0],[1,0,100],[1,0,200]],200)).toEqual([0,0,1]));
 it('negative UV is signed, not absolute',()=>{const m=mesh(),b=transport(),v=new DataView(b),p=16+v.getUint32(12,true);v.setUint8(p+8,0);const parsed=parseTextureTransport(b,m,meta),a=displayTextureAttributes(parsed,m,prepareDisplay(m));expect(a.uv[0]).toBe(-1);});
 it('synthetic cap has no artwork',()=>{const m=mesh();m.attributes=()=>({...mesh().attributes(0),origin:1,texture:null});const p=parseTextureTransport(transport(),mesh(),meta);expect(displayTextureAttributes(p,m,prepareDisplay(m)).rect.every(x=>x===0)).toBe(true);});
 for(const id of Object.keys(projections))it(`${id} keeps UV`,()=>{const m=mesh(),d=prepareDisplay(m),p=parseTextureTransport(transport(),m,meta),a=displayTextureAttributes(p,m,d);projectDisplay(d,projections[id as keyof typeof projections],context);expect(displayTextureAttributes(p,m,d).uv).toEqual(a.uv);});
});
describe('display-only relief',()=>{
 for(const value of [0,1,10,25,50,100])it(`${value}× radial formula`,()=>{const d=prepareDisplay(mesh()),before=d.geographic.slice(),positions=new Float32Array(d.geographic.length);applyRelief(d,positions,context.radius,value);expect(Math.hypot(...positions.slice(3,6))).toBeCloseTo(1+100*value/context.radius,6);expect(d.geographic).toEqual(before);expect(d.renderToSource[0]).toBe(0);});
 for(const value of [-1,101,NaN,Infinity])it(`rejects invalid ${value}`,()=>expect(()=>reliefRadius(100,context.radius,value)).toThrow());
 it('reference distance and area do not change',()=>{const m=mesh(),d=prepareDisplay(m),p=[[0,0,0],[1,0,0],[1,1,0]] as [number,number,number][],distance=measureDistance(p),area=measureArea(p);applyRelief(d,new Float32Array(d.geographic.length),context.radius,100);expect(measureDistance(p)).toEqual(distance);expect(measureArea(p)).toEqual(area);});
 it('five-locales parity',()=>{for(const dict of Object.values(dictionaries))expect(Object.keys(dict)).toEqual(Object.keys(dictionaries.en));});
});

