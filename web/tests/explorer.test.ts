// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {Vector3} from 'three';
import {decodeExplorer,Surface} from '../src/data/explorer';
import type {ExplorerHeader,ExplorerSurface,SourcePoint} from '../src/data/explorer';
import {advance,barycentric,compatible,locate} from '../src/explorer/walker';
import {sourceGeographic,geographicSource,sourceGlobe,tangentFrame} from '../src/explorer/coordinates';
import {OriginalModel} from '../src/explorer/model';
import {movementProfiles} from '../src/data/traversal';

function surface(mapId:'WM0'|'WM2'|'WM3'='WM0',points:SourcePoint[][]=[[[0,0,0],[10,0,10],[0,10,20]],[[10,0,10],[10,10,30],[0,10,20]]],neighbors=[ [1,-1,-1],[-1,0,-1] ],terrain=[0,0],script=[0,0]){
 const payload=new ArrayBuffer(points.length*56),v=new DataView(payload);points.forEach((p,i)=>{p.forEach((q,j)=>q.forEach((n,k)=>v.setInt32(i*56+j*12+k*4,n,true)));neighbors[i].forEach((n,j)=>v.setInt32(i*56+36+j*4,n,true));v.setUint8(i*56+48,terrain[i]);v.setUint8(i*56+49,script[i]);v.setUint16(i*56+54,i,true);});
 const header:ExplorerSurface={mapId,extent:[10,10],source_sha256:'1'.repeat(64),offset:0,bytes:payload.byteLength,record_bytes:56,stats:{triangles:points.length}};return new Surface(header,payload);
}
async function fixture(edit:(h:ExplorerHeader,p:Uint8Array)=>void=()=>{}){
 const payload=new Uint8Array(3*112+144+48+4),v=new DataView(payload.buffer);for(let i=0;i<3;i++)payload.set(new Uint8Array(surface().view.buffer),i*112);
 const geometry=336,clip=480,texture=528;for(let i=0;i<3;i++){v.setFloat32(geometry+i*48,i,true);v.setFloat32(geometry+i*48+24,1,true);v.setFloat32(geometry+i*48+36,1,true);}payload.set([255,255,255,255],texture);
 const h:ExplorerHeader={schema:'gaiagis-explorer',version:1,reconstruction:'v1-geometric-gaia',runtimeClaim:false,sources:Object.fromEntries(['wm0.map','wm2.map','wm3.map','world_us.lgp'].map(k=>[k,'1'.repeat(64)])),textures:[{name:'synthetic.tex',width:1,height:1,offset:texture,bytes:4}],models:[{id:'synthetic',model_id:0,hrc:'synthetic.hrc',source_scale:1,bone_count:2,bones:[{name:'hip',parent:-1,length:2,resources:[]},{name:'head',parent:0,length:1,resources:[]}],parts:[{bone:1,vertices:3,texture:'synthetic.tex',resource:'synthetic.p',group:0,offset:geometry,bytes:144}],clips:[{name:'synthetic.a',frame_count:1,bone_count:2,rotation_order:[1,0,2],timing:'preview_30fps',offset:clip,bytes:48}],animation_identity:'neutral_clip_indices'}],surfaces:(['WM0','WM2','WM3'] as const).map((id,i)=>({...surface(id).header,offset:i*112}))};edit(h,payload);const meta=new TextEncoder().encode(JSON.stringify(h)),start=16+Math.ceil(meta.length/4)*4,buffer=new ArrayBuffer(start+payload.length+32),out=new Uint8Array(buffer),head=new DataView(buffer);out.set(new TextEncoder().encode('GAIAEXP\0'));head.setUint32(8,1,true);head.setUint32(12,meta.length,true);out.set(meta,16);out.set(payload,start);out.set(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer.slice(0,-32))),buffer.byteLength-32);return buffer;
}
describe('optional Explorer transport',()=>{
 it('decodes synthetic model/animation/texture/source data',async()=>{const p=await decodeExplorer(await fixture());expect(p.header.runtimeClaim).toBe(false);expect(p.surface('WM2').count).toBe(2);expect(p.header.models[0].clips.length).toBe(1);});
 it('rejects corrupt checksum',async()=>{const b=await fixture();new Uint8Array(b)[b.byteLength-1]^=1;await expect(decodeExplorer(b)).rejects.toThrow();});
 it.each(['schema','version','runtime','bone','parent','texture','frames','modelFloat','neighbor','terrain','sources','overlap','falseEdge','missingAnimation','missingModel'])('rejects invalid %s with valid recomputed checksum',async kind=>{
  const b=await fixture((h,p)=>{if(kind==='schema')h.schema='other';if(kind==='version')h.version=99;if(kind==='runtime')(h as unknown as {runtimeClaim:boolean}).runtimeClaim=true;if(kind==='bone')h.models[0].parts[0].bone=99;if(kind==='parent')h.models[0].bones[1].parent=1;if(kind==='texture')h.models[0].parts[0].texture='missing.tex';if(kind==='frames')h.models[0].clips[0].frame_count=99;if(kind==='modelFloat')new DataView(p.buffer).setFloat32(336,NaN,true);if(kind==='neighbor')new DataView(p.buffer).setInt32(36,12345,true);if(kind==='terrain')p[48]=99;if(kind==='sources')h.sources['wm0.map']='bad';if(kind==='overlap')h.textures[0].offset=336;if(kind==='missingAnimation')h.models[0].clips=[];if(kind==='missingModel')h.models=[];if(kind==='falseEdge'){const v=new DataView(p.buffer);v.setInt32(36,-1,true);v.setInt32(40,1,true);}});await expect(decodeExplorer(b)).rejects.toThrow();
 });
 it('composes source Euler rotations before global Y-up conversion',async()=>{
  const p=await decodeExplorer(await fixture((h,p)=>{const v=new DataView(p.buffer);v.setFloat32(484,30,true);v.setFloat32(488,20,true);v.setFloat32(496,2,true);v.setFloat32(504,270,true);})),m=new OriginalModel(p,p.header.models[0]);
  expect(m.root.position.y).toBe(-2);expect(m.root.rotation.y).toBeCloseTo(Math.PI/6);expect(m.bones[0].rotation.x).toBeCloseTo(3*Math.PI/2);expect(m.orientation.rotation.x).toBe(Math.PI);m.dispose();
 });
 it('preserves clip frame samples without inventing interpolation',async()=>{const p=await decodeExplorer(await fixture()),m=new OriginalModel(p,p.header.models[0]);m.pose(99,123);expect(m.root.rotation.x).toBe(0);m.dispose();});
 it('creates current model only and disposes all local GPU objects',async()=>{const p=await decodeExplorer(await fixture()),m=new OriginalModel(p,p.header.models[0]);expect(m.meshes).toHaveLength(1);expect(m.bones[1].position.z).toBe(-2);expect(m.textures).toHaveLength(1);m.dispose();expect(m.object.children).toHaveLength(0);expect(m.object.parent).toBe(null);});
});
describe('source topology walker',()=>{
 it('interpolates authoritative raw height',()=>{expect(locate(surface(),0,[.5,.25,.25]).rawInterpolatedHeight).toBe(7.5);});
 it('crosses exactly shared edge',()=>{const s=surface(),r=advance(s,locate(s,0,[.6,.2,.2]),5,5,'foot');expect(r.blocked).toBe(false);expect(r.state.sourceTriangleId).toBe(1);expect(r.state.nativeX).toBeCloseTo(7);expect(r.state.rawInterpolatedHeight).toBeCloseTo(21);});
 it('stops on bounded boundary',()=>{const s=surface(),r=advance(s,locate(s,0,[.6,.2,.2]),-5,0,'foot');expect(r.blocked).toBe(true);expect(r.state.nativeX).toBeCloseTo(0);});
 it('blocks disallowed destination without nearest teleport',()=>{const s=surface('WM0',undefined,undefined,[0,3]),r=advance(s,locate(s,0,[.6,.2,.2]),5,5,'foot');expect(r.blocked).toBe(true);expect(r.state.sourceTriangleId).toBe(0);});
 it('does not apply WM0 Foot rules to native preview',()=>{for(const id of ['WM2','WM3'] as const)expect(compatible(surface(id,undefined,undefined,[3,3]),0,'foot')).toBe(true);});
 it('honors opposite-corner seam slot and E/W displacement',()=>{const s=surface('WM0',[[[9,0,0],[10,0,0],[10,10,0]],[[0,0,0],[1,0,0],[0,10,0]]],[[1,-1,-1],[-1,0,-1]]),b=barycentric(s.points(0),9.75,2.5)!,r=advance(s,locate(s,0,b),.5,0,'foot');expect(r.blocked).toBe(false);expect(r.state.sourceTriangleId).toBe(1);expect(r.state.nativeX).toBeCloseTo(.25);});
 it('N/S is cut even in WM0',()=>{const s=surface();expect(advance(s,locate(s,0,[.6,.2,.2]),0,-5,'foot').blocked).toBe(true);});
 it('ambiguity guard stops cycles and vertex crossings',()=>{const s=surface();expect(advance(s,locate(s,0,[.6,.2,.2]),5,5,'foot',0).reason).toBe('crossing_guard');expect(advance(s,locate(s,0,[.6,.2,.2]),-5,-5,'foot').reason).toBe('ambiguous_vertex');});
 it('rejects degenerate and invalid barycentric placement',()=>{const s=surface('WM0',[[[0,0,0],[1,0,0],[2,0,0]]],[[-1,-1,-1]],[0]);expect(()=>locate(s,0,[1/3,1/3,1/3])).toThrow();expect(()=>locate(surface(),0,[1,1,1])).toThrow();expect(()=>locate(surface(),2,[1/3,1/3,1/3])).toThrow();});
 it.each(movementProfiles.filter(p=>p.id!=='highwind-landing'))('uses existing $id terrain profile',p=>{for(let terrain=0;terrain<32;terrain++){const s=surface('WM0',undefined,undefined,[terrain,terrain]);expect(compatible(s,0,p.id)).toBe(!!((Number(p.mask)>>>terrain)&1));}});
 it('conditional Highwind landing never becomes allowed',()=>{expect(compatible(surface('WM0',undefined,undefined,[27,27]),0,'highwind-landing')).toBe(false);expect(compatible(surface('WM0',undefined,undefined,[0,0],[7,7]),0,'highwind-landing')).toBe(false);});
});
describe('unchanged V1 mapping and third-person basis',()=>{
 it.each([[0,0], [294912,229376], [147456,114688], [3000,10000], [290000,200000]])('roundtrips source coordinates %s %s',(x,z)=>{const geo=sourceGeographic(x,z,123);expect(geographicSource(geo[0],geo[1])[0]).toBeCloseTo(x,7);expect(geographicSource(geo[0],geo[1])[1]).toBeCloseTo(z,7);expect(geo[2]).toBe(123);});
 it('equals existing sphere projection and frozen V1 equator/seams',()=>{expect(sourceGeographic(147456,114688,0)).toEqual([0,0,0]);expect(sourceGeographic(0,0,0)[0]).toBe(-180);expect(sourceGeographic(294912,0,0)[0]).toBe(180);expect(sourceGlobe(147456,114688,100,1,{radius:6371008.8,mercatorLimit:85,centerLon:0,centerLat:0}).z).toBeCloseTo(1+100/6371008.8,12);});
 it.each([[1,0,0],[-1,0,0],[0,.9,.3],[0,-.9,-.3]])('radial-up remains orthogonal on both hemispheres %s',(x,y,z)=>{const f=tangentFrame(new Vector3(x,y,z));expect(f.up.dot(f.east)).toBeCloseTo(0,12);expect(f.up.dot(f.north)).toBeCloseTo(0,12);expect(new Vector3().crossVectors(f.east,f.north).dot(f.up)).toBeCloseTo(1,12);});
});
