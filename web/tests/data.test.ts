// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect,beforeAll} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {parseMesh} from '../src/data/mesh';
import type {GaiaMeta} from '../src/data/mesh';
import {prepareDisplay,projectDisplay,splitAntimeridian} from '../src/data/display';
import {projections} from '../src/projections';
import type {ProjectionContext} from '../src/projections/Projection';

function fixture() {
  const buffer=new ArrayBuffer(64+72+24+32),view=new DataView(buffer);
  new Uint8Array(buffer,0,8).set(new TextEncoder().encode('GAIAWEB\0'));view.setUint16(8,1,true);view.setUint16(10,64,true);
  for(const [offset,value]of [[12,1],[16,6],[20,2],[24,64],[28,136],[32,160],[36,16],[40,192],[44,1],[48,1]])view.setUint32(offset,value,true);
  new Float32Array(buffer,64,18).set([179,0,0,-179,0,20,179,2,40,0,80,0,10,80,0,0,90,0]);
  new Uint32Array(buffer,136,6).set([0,1,2,3,4,5]);
  let p=160;view.setUint8(p,10);view.setUint8(p+1,11);view.setUint16(p+2,7,true);view.setUint16(p+4,2,true);view.setUint16(p+6,3,true);view.setUint16(p+10,17,true);view.setUint8(p+12,2);view.setUint8(p+13,1);view.setUint16(p+14,65535,true);
  p+=16;view.setUint8(p,255);view.setUint8(p+1,255);for(const o of [2,4,6,10])view.setUint16(p+o,65535,true);view.setUint8(p+8,1);for(const o of [9,12,13])view.setUint8(p+o,255);view.setUint16(p+14,0,true);
  return buffer;
}
describe('Gaia Web transport invariants',()=>{
  it('reads aligned records, attributes and null synthetic lineage',()=>{const m=parseMesh(fixture());expect(m.vertexCount).toBe(6);expect(m.triangleCount).toBe(2);expect(m.attributes(0)).toMatchObject({terrain:10,region:11,section:7,mesh:2,triangle:3,script:2,chocobo:true});expect(m.attributes(1)).toMatchObject({origin:1,section:null,terrain:null,map:null,capTriangle:0});});
  it.each([['magic',0,0],['version',8,2],['header',10,32],['offset',24,68],['count',16,999],['length',40,191],['stride',36,12]])('rejects malformed %s',(_label,offset,value)=>{const b=fixture();new DataView(b).setUint32(offset as number,value as number,true);expect(()=>parseMesh(b)).toThrow();});
  it('rejects out-of-range references and fabricated synthetic IDs',()=>{const b=fixture();new DataView(b).setUint32(136,6,true);expect(()=>parseMesh(b)).toThrow(/reference/);const c=fixture();new DataView(c).setUint16(178,0,true);expect(()=>parseMesh(c)).toThrow(/fabricated/);});
  it('checks metadata agreement',()=>{expect(()=>parseMesh(fixture(),{version:1,vertex_count:1} as GaiaMeta)).toThrow(/metadata/);});
  it('splits seam triangles and retains display-to-canonical identities',()=>{const d=prepareDisplay(parseMesh(fixture()));expect(Array.from(new Set(d.renderToSource))).toEqual([0,1]);for(let i=0;i<d.geographic.length;i+=9){const longs=[d.geographic[i],d.geographic[i+3],d.geographic[i+6]];expect(Math.max(...longs)-Math.min(...longs)).toBeLessThan(11);}expect(d.edgeIndices.length).toBeGreaterThan(0);});
  it('fills polar longitude sectors without changing canonical topology',()=>{const m=parseMesh(fixture()),d=prepareDisplay(m);expect(m.triangleCount).toBe(2);expect(Array.from(d.renderToSource).filter(t=>t===1)).toHaveLength(2);const poleLons=[];for(let i=0;i<d.geographic.length;i+=3)if(d.geographic[i+1]===90)poleLons.push(d.geographic[i]);expect(poleLons).toContain(0);expect(poleLons).toContain(10);});
  it('interpolates antimeridian height at the cut',()=>{const parts=splitAntimeridian([[179,0,0],[-179,0,20],[179,2,40]]);expect(parts).toHaveLength(2);expect(parts.flat()).toContainEqual([180,0,10]);expect(parts.flat()).toContainEqual([-180,0,10]);});
});
const asset=new URL('../public/data/gaia-mesh.bin',import.meta.url);
describe.skipIf(!existsSync(asset))('real local Stage 1 transport',()=>{
  let meta:GaiaMeta,m:ReturnType<typeof parseMesh>;
  beforeAll(()=>{const buffer=readFileSync(asset);meta=JSON.parse(readFileSync(new URL('../public/data/gaia-meta.json',import.meta.url),'utf8')) as GaiaMeta;m=parseMesh(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength) as ArrayBuffer,meta);});
  it('matches current transport metadata and retains all source/cap identities',()=>{expect(m.sourceTriangleCount).toBe(meta.ff7_triangle_count);expect(m.capTriangleCount).toBe(meta.synthetic_triangle_count);const identities=new Set<string>();let synthetic=0;for(let t=0;t<m.triangleCount;t++){const a=m.attributes(t);if(a.origin){synthetic++;expect([a.terrain,a.region,a.section,a.mesh,a.triangle,a.map,a.script,a.texture]).toEqual(Array(8).fill(null));}else identities.add(`${a.section}/${a.mesh}/${a.triangle}`);}expect(identities.size).toBe(m.sourceTriangleCount);expect(synthetic).toBe(m.capTriangleCount);});
  it('produces finite positions/masks in all modes, including rotating orthographic',()=>{const d=prepareDisplay(m),c:ProjectionContext={radius:meta.physical_reference_radius_m,mercatorLimit:meta.mercator_max_latitude_deg,centerLon:137,centerLat:-55};for(const p of Object.values(projections)){const frame=projectDisplay(d,p,c);expect(frame.positions.every(Number.isFinite)).toBe(true);expect(frame.mask.every(Number.isFinite)).toBe(true);expect(frame.positions.every(x=>Math.abs(x)<5)).toBe(true);}for(let i=0;i<d.geographic.length;i+=9){const a=d.geographic[i],b=d.geographic[i+3],c=d.geographic[i+6];expect(Math.max(a,b,c)-Math.min(a,b,c)).toBeLessThan(4);}});
});
