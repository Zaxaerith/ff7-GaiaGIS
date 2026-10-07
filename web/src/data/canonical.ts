// SPDX-License-Identifier: GPL-3.0-only
// Fingerprints identify the approved V1 transport; they contain no geometry.
// This is a Viewer release policy, not a FF7 parser compatibility rule.
export const V1_CANONICAL={
  id:'v1-geometric-gaia',
  meshSha256:'e38b3fb85f1307bd0ba8075bce86698804f304f504acd9c0e81d0057d8d89c0d',
  buildSha256:'64236afae175da0d05e99f1d3d290481db7afbe1b457eec8080f087ec1bc338d',
  geographicSha256:'2cd6ab36261c6ad94bcf99139947450ca50fc8d835655b2b2e01df600a5b38db',
  radius:6371008.8,
  phiMax:80.07152881489458,
  byteLength:5396280,
} as const;

export function validateCanonicalMetadata(value:unknown):void {
  if(!value||typeof value!=='object')throw new Error('Invalid Gaia metadata. Choose the generated gaia-meta.json.');
  const m=value as Record<string,unknown>,stage=m.stage1 as Record<string,unknown>|undefined;
  const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
  const provenance=hash(stage?.geographic_gpkg_sha256)&&stage?.geographic_transport_sha256===undefined&&stage?.transport_backend===undefined||
    stage?.geographic_gpkg_sha256===undefined&&hash(stage?.geographic_transport_sha256)&&stage?.transport_backend==='stdlib Float64 SQLite; not GeoPackage';
  if((m.canonical_reconstruction!==undefined&&m.canonical_reconstruction!==V1_CANONICAL.id)||
    m.sha256!==V1_CANONICAL.meshSha256||m.byte_length!==V1_CANONICAL.byteLength||
    !hash(stage?.build_metadata_sha256)||!provenance||
    m.physical_reference_radius_m!==V1_CANONICAL.radius||m.phi_max_deg!==V1_CANONICAL.phiMax)
    throw new Error('This release accepts V1 Geometric Gaia only. Climate warps and other reconstructions are not supported.');
  // Stage 1 metadata includes time and local paths, and GeoPackage bytes can vary
  // across regenerations. Record their hashes, but pin geometry by transport bytes.
  if(m.version!==1||m.binary!=='gaia-mesh.bin'||m.endianness!=='little'||m.mercator_max_latitude_deg!==85.0511287798066)
    throw new Error('Unsupported V1 metadata format.');
  for(const key of ['vertex_count','triangle_count','ff7_triangle_count','synthetic_triangle_count'])
    if(!Number.isSafeInteger(m[key])||Number(m[key])<=0)throw new Error('Invalid V1 metadata counts.');
  for(const key of ['terrain_names','region_names']){
    const names=m[key];
    if(!names||typeof names!=='object'||Array.isArray(names)||Object.entries(names).some(([id,name])=>!/^\d+$/.test(id)||Number(id)>31||typeof name!=='string'||name.length>160))
      throw new Error('Invalid V1 categorical names.');
  }
}
