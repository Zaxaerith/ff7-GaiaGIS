// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {SharedSurface,sharedSurface} from '../src/explorer/sharedSurface';
import {decodeExplorer} from '../src/data/explorer';
import {decodeDataset} from '../src/data/mesh';
import {decodeNativeMap} from '../src/data/nativeMaps';
import type {NativeMap} from '../src/data/nativeMaps';
const buffer=(path:string)=>{const b=readFileSync(path);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;};
function native():NativeMap{return {header:{schema:'gaiagis-native-map',version:1,mapId:'WM2',coordinate_space:'WM2Native',global_mapping:null,axis_order:[],height_unit:'raw_source_units',section_grid:[3,4],section_count:12,triangle_count:2,record_bytes:72,extent:[98304,131072],source_sha256:'a'.repeat(64),payload_sha256:'b'.repeat(64),terrain_names:{},region_names:{}},sha256:'c'.repeat(64),records:new DataView(new ArrayBuffer(0)),positions:new Float32Array([0,0,0,10,0,0,0,10,0,10,0,0,10,10,0,0,10,0]),sourceTriangleCount:2,attributes(i){return {origin:0,map:2,section:0,mesh:0,triangle:i,terrain:0,region:0,script:0,texture:0,chocobo:false,capTriangle:null};}};}
describe('borrowed source surface',()=>{
 it('builds opposite-corner adjacency while reusing native position owner',async()=>{const mesh=native(),s=await sharedSurface(mesh);expect(s.neighbors(0)).toEqual([1,-1,-1]);expect(s.neighbors(1)).toEqual([-1,0,-1]);mesh.positions[2]=7;expect(s.points(0)[0][2]).toBe(7);expect(s.view.byteLength).toBe(0);});
 it('memoizes by map owner and frees no borrowed resources',async()=>{const m=native();expect(await sharedSurface(m)).toBe(await sharedSurface(m));});
 it('conservatively excludes duplicate faces',async()=>{const m=native();m.positions.set(m.positions.subarray(0,9),9);const s=await sharedSurface(m);expect(s.neighbors(0)).toEqual([-1,-1,-1]);expect(s.neighbors(1)).toEqual([-1,-1,-1]);});
 it('has no fabricated geographic native mapping',async()=>{const s=await sharedSurface(native());expect(s.header.mapId).toBe('WM2');expect(s.points(0)[1]).toEqual([10,0,0]);});
});
const root=resolve('..'),v1=resolve(root,'output/v1_9/gaia-explorer.bin'),v2=resolve(root,'output/v2_0/gaia-explorer.bin');
describe.skipIf(!existsSync(v1)||!existsSync(v2))('optional actual-source shared geometry validation',()=>{
 it('all three borrowed surfaces exactly reproduce v1 positions, lineage and conservative adjacency',async()=>{
 const old=await decodeExplorer(buffer(v1)),next=await decodeExplorer(buffer(v2));expect(next.header.version).toBe(2);expect(next.header.surfaces).toHaveLength(0);expect(()=>next.surface('WM0')).toThrow();
 const wm=await decodeDataset(buffer(resolve(root,'web/public/data/gaia-mesh.bin')),JSON.parse(readFileSync(resolve(root,'web/public/data/gaia-meta.json'),'utf8')));
 for(const id of ['WM0','WM2','WM3'] as const){const s=id==='WM0'?await sharedSurface(wm.mesh,wm.meta):await sharedSurface(await decodeNativeMap(buffer(resolve(root,`output/v1_8/data/gaia-map-${id}.bin`))));next.bindSurface!(s);expect(next.surface(id)).toBe(s);const previous=old.surface(id);let mismatch=0;for(let i=0;i<s.count;i++){if(JSON.stringify(s.points(i))!==JSON.stringify(previous.points(i))||JSON.stringify(s.neighbors(i))!==JSON.stringify(previous.neighbors(i))||JSON.stringify(s.attrs(i))!==JSON.stringify(previous.attrs(i)))mismatch++;}expect(mismatch).toBe(0);}
 expect(next.payload.byteLength).toBeLessThan(900000);
 },30000);
});
