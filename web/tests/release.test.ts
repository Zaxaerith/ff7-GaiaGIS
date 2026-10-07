// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {validateCanonicalMetadata,V1_CANONICAL as v} from '../src/data/canonical';
import {decodeDataset,readLocalDataset,parseMesh} from '../src/data/mesh';
import {summarizeRegions} from '../src/data/regions';
const valid=()=>({version:1,binary:'gaia-mesh.bin',endianness:'little',sha256:v.meshSha256,byte_length:v.byteLength,stage1:{build_metadata_sha256:v.buildSha256,geographic_gpkg_sha256:v.geographicSha256},physical_reference_radius_m:v.radius,phi_max_deg:v.phiMax,mercator_max_latitude_deg:85.0511287798066,vertex_count:3,triangle_count:2,ff7_triangle_count:1,synthetic_triangle_count:1,terrain_names:{0:'Grass'},region_names:{0:'Midgar'}});
describe('V1 release dataset policy',()=>{
  it('accepts the original V1 metadata without rewriting it',()=>expect(()=>validateCanonicalMetadata(valid())).not.toThrow());
  it('accepts honest portable transport provenance with the same frozen geometry',()=>expect(()=>validateCanonicalMetadata({...valid(),stage1:{build_metadata_sha256:'a'.repeat(64),geographic_transport_sha256:'b'.repeat(64),transport_backend:'stdlib Float64 SQLite; not GeoPackage'}})).not.toThrow());
  it('rejects ambiguous provenance instead of claiming SQLite is a GeoPackage',()=>expect(()=>validateCanonicalMetadata({...valid(),stage1:{...valid().stage1,geographic_transport_sha256:'b'.repeat(64),transport_backend:'stdlib Float64 SQLite; not GeoPackage'}})).toThrow());
  it.each(['unknown',undefined])('rejects undocumented portable provenance %s',transport_backend=>expect(()=>validateCanonicalMetadata({...valid(),stage1:{build_metadata_sha256:'a'.repeat(64),geographic_transport_sha256:'b'.repeat(64),transport_backend}})).toThrow());
  it('permits regenerated provenance without weakening the geometry fingerprint',()=>expect(()=>validateCanonicalMetadata({...valid(),stage1:{build_metadata_sha256:'a'.repeat(64),geographic_gpkg_sha256:'b'.repeat(64)}})).not.toThrow());
  it.each(['sha256','phi_max_deg','physical_reference_radius_m','canonical_reconstruction','stage1'])('rejects another reconstruction through %s',key=>expect(()=>validateCanonicalMetadata({...valid(),[key]:'climate-v2'})).toThrow(/V1 Geometric Gaia only/));
  it('rejects invalid counts and unsafe categorical metadata',()=>{expect(()=>validateCanonicalMetadata({...valid(),triangle_count:NaN})).toThrow(/counts/);expect(()=>validateCanonicalMetadata({...valid(),region_names:{32:'Fake'}})).toThrow(/names/);});
  it('checks actual binary bytes, not just asserted provenance',async()=>await expect(decodeDataset(new ArrayBuffer(64),valid() as never)).rejects.toThrow(/checksum/));
  it('requires exactly the local metadata/binary pair and expected size',async()=>{await expect(readLocalDataset([])).rejects.toThrow(/both/);await expect(readLocalDataset([{name:'gaia-meta.json',size:1},{name:'gaia-mesh.bin',size:12}] as File[])).rejects.toThrow(/size/);});
});
describe('spherical region navigation',()=>{
  it('centers across the longitude seam and excludes synthetic ocean',()=>{
    const mesh={triangleCount:2,indices:new Uint32Array([0,1,2,3,4,5]),geographic:new Float32Array([179,0,0,-179,0,0,180,3,0,0,80,0,30,80,0,0,90,0]),attributes:(t:number)=>({origin:t,region:t?null:0})};
    const regions=summarizeRegions(mesh as never,valid() as never);
    expect(regions).toHaveLength(1);expect(regions[0].triangles).toBe(1);expect(Math.abs(regions[0].lon)).toBeGreaterThan(179);expect(regions[0].lat).toBeCloseTo(1,1);expect(regions[0].concentration).toBeGreaterThan(.99);
  });
});
const binary=new URL('../public/data/gaia-mesh.bin',import.meta.url);
it.skipIf(!existsSync(binary))('verifies the local V1 dataset checksum and all transport invariants',async()=>{
  const data=readFileSync(binary),meta=JSON.parse(readFileSync(new URL('../public/data/gaia-meta.json',import.meta.url),'utf8'));
  const decoded=await decodeDataset(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength) as ArrayBuffer,meta);
  expect(decoded.mesh.sourceTriangleCount).toBe(142586);expect(parseMesh(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength) as ArrayBuffer).capTriangleCount).toBe(9792);
});
