// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {compareVariantFaces,variantSignatures,decodeWorldVariants,VARIANT_GROUPS,activeVariantSections,validateVariantPayload,visibleVariantFaces,sha256} from '../src/data/worldVariants';
import type {VariantFace,VariantMesh} from '../src/data/worldVariants';
import {nativeTriangle} from '../src/analysis/native';
import type {NativePoint} from '../src/analysis/native';
import {initialState,capabilities} from '../src/app/state';
import {dictionaries,locales} from '../src/i18n';
import {worldVariantsCatalog} from '../src/i18n/worldVariantsCatalog';
const hash='a'.repeat(64);
function face(id:string,points:NativePoint[]=[[0,0,0],[10,0,0],[0,10,0]],raw=[0,1,2,0,0,0,1,0,0,1,0]):VariantFace{return {id,section:50,placement:50,mesh:0,triangle:0,group:1,points,raw,normals:[[0,1,0],[0,1,0],[0,1,0]],uv:[[0,0],[1,0],[0,1]],sourceMesh:[] as unknown as VariantMesh,metrics:nativeTriangle(points),geometry:''};}
function fixture(){const meshes:VariantMesh[]=[];for(const [aa,bb]of VARIANT_GROUPS)for(const [i,s]of [...aa,...bb].entries())for(let mid=0;mid<16;mid++){const placement=i<aa.length?bb[i]:s;meshes.push([s,placement,mid,s*47104+64+mid*12,4,64,[[0,0,0,0],[10,0,0,0],[0,0,10,0]],[[0,4096,0,0],[0,4096,0,0],[0,4096,0,0]],[[0,1,2,0,0,0,1,0,0,1,0]]]);}return {meshes,boundary_evidence:[],script_evidence:null};}
async function envelope(value=fixture()){
 const payload=JSON.stringify(value),bytes=new TextEncoder().encode(payload);
 return {schema:'gaiagis-world-variants',version:1,generator:'world-variants-1',map_id:'WM0',source_sha256:hash,coordinate_frame:['placed raw X','placed raw Z','raw Y'],normal_frame:'original raw XYZ',groups:VARIANT_GROUPS.map(([a,b],i)=>({id:i+1,alternatives:a,bases:b})),payload_bytes:bytes.length,payload_sha256:await sha256(bytes),payload,script_evidence:null};
}
function buffer(e:unknown){return new TextEncoder().encode(JSON.stringify(e)).buffer;}
describe('source-level differences',()=>{
 it('retains unrelated source identities with identical geometry',()=>{const c=compareVariantFaces([face('50/0/0')],[face('63/7/42')]);expect(c.stats.geometry_common).toBe(1);expect([...c.buckets.values()][0].alternative[0].id).toBe('63/7/42');});
 it('does not choose a duplicated match',()=>{const c=compareVariantFaces([face('b')],[face('a1'),face('a2')]);expect(c.stats.alternative_only).toBe(1);expect(c.stats.area_contribution_delta).toBe(50);expect([...c.buckets.values()][0].ambiguous).toBe(true);});
 it('detects attributes, UV and normals separately',()=>{const b=face('b'),a=face('a');a.raw[10]=32768;a.uv[0]=[4,5];a.normals[0]=[1,0,0];const c=compareVariantFaces([b],[a]);expect(c.stats.geometry_common).toBe(1);expect([c.stats.attribute_common,c.stats.uv_common,c.stats.normal_common]).toEqual([0,0,0]);});
 it('detects reversed winding without changed geometry',()=>{const b=face('b'),a=face('a',b.points.slice().reverse());a.uv=b.uv.slice().reverse();const c=compareVariantFaces([b],[a]);expect([c.stats.geometry_common,c.stats.winding_common,c.stats.uv_common]).toEqual([1,0,1]);});
 it('preserves multiple heights and vertical sources',()=>{const a=face('a',[[0,0,0],[0,0,10],[10,0,0]]);expect(a.metrics.zeroXZ).toBe(true);expect(a.metrics.degenerate3D).toBe(false);expect(a.metrics.a).toBeNull();const b=face('b'),c=face('c',b.points.map(([x,z,h])=>[x,z,h+10]));expect(variantSignatures(b).geometry).not.toBe(variantSignatures(c).geometry);});
 it('counts retessellation as source changes, not changed footprint',()=>{const b=face('b'),a=face('a',[[0,0,0],[5,0,0],[0,10,0]]),c=face('c',[[5,0,0],[10,0,0],[0,10,0]]);const s=compareVariantFaces([b],[a,c]).stats;expect([s.geometry_common,s.base_only,s.alternative_only,s.area_contribution_delta]).toEqual([0,1,2,0]);});
 it('rejects duplicate IDs',()=>expect(()=>compareVariantFaces([face('id')],[face('id')])).toThrow());
});
describe('private resource boundaries',()=>{
 it('validates synthetic complete source tables and cumulative states',async()=>{const e=await envelope(),data=await decodeWorldVariants(buffer(e),hash);expect(data.faces).toHaveLength(192);for(let s=0;s<5;s++)expect(visibleVariantFaces(data,s)).toHaveLength(96);expect([...activeVariantSections(3)]).toEqual([63,64,65,66]);});
 for(const state of [-1,.5,5,NaN,Infinity])it('rejects invalid cumulative state '+state,()=>expect(()=>activeVariantSections(state)).toThrow());
 for(const mode of ['source','version','generator','frame','groups','length','hash','compression'])it('rejects '+mode,async()=>{const e=await envelope();if(mode==='source')e.source_sha256='b'.repeat(64);if(mode==='version')e.version=2;if(mode==='generator')e.generator='other';if(mode==='frame')e.normal_frame='display';if(mode==='groups')e.groups.reverse();if(mode==='length')e.payload_bytes++;if(mode==='hash')e.payload_sha256='0'.repeat(64);if(mode==='compression')e.payload='gzip is not this plaintext contract';await expect(decodeWorldVariants(buffer(e),hash)).rejects.toThrow();});
 for(const mode of ['duplicate','index','padding','negative span','overflow','decoded length','vector count','extra section','noninteger','overlap'])it('rejects malformed '+mode,()=>{const p=fixture(),m=p.meshes[0];if(mode==='duplicate')p.meshes[1]=structuredClone(m);if(mode==='index')m[8][0][0]=99;if(mode==='padding')m[6][0][3]=-1;if(mode==='negative span')m[3]=-1;if(mode==='overflow')m[4]=Number.MAX_SAFE_INTEGER;if(mode==='decoded length')m[5]++;if(mode==='vector count')m[7].pop();if(mode==='extra section')m[0]=62;if(mode==='noninteger')m[6][0][0]=.5;if(mode==='overlap')p.meshes[1][3]=m[3];expect(()=>validateVariantPayload(p)).toThrow();});
 it('honours cancellation before and after hash',async()=>{const e=await envelope(),abort=new AbortController();abort.abort();await expect(decodeWorldVariants(buffer(e),hash,abort.signal)).rejects.toThrow();});
 for(const kind of ['duplicate boundary','owner mismatch','entry mismatch'])it('rejects '+kind,async()=>{
  const p=JSON.parse((await envelope()).payload),row={group:1,kind:'base_alternative_side',sections:[50,63],axis:0,coordinate:163840,a:1,b:1,exact:1,unmatched_a:0,unmatched_b:0,examples:[] as unknown[]};
  if(kind==='duplicate boundary')p.boundary_evidence=[row,row];
  if(kind==='owner mismatch'){row.examples=[{points:[[163840,0,0],[163840,10,0]],a_owners:[['51/0/0',0]],b_owners:[['63/0/0',0]]}];p.boundary_evidence=[row];}
  if(kind==='entry mismatch')p.script_evidence={source_sha256:hash,section_sha256:hash,entry:{offset:0,data_offset:24,size:2000,toc_index:1,filename:'wm0.ev'},sites:[{word_offset:1,payload_byte_offset:1026,archive_byte_offset:1050,literal:4,entries:[{table:1,header:16384,kind:0,function:0}]}],runtime:'Unknown'};
  await expect(decodeWorldVariants(buffer(await envelope(p)),hash)).rejects.toThrow();
 });
 it('guards invalid UTF8 and file budget',async()=>{await expect(decodeWorldVariants(new Uint8Array(8_000_001).buffer,hash)).rejects.toThrow();const a=new Uint8Array(200).fill(255);await expect(decodeWorldVariants(a.buffer,hash)).rejects.toThrow();});
 it('disables WM0 gameplay capabilities without changing authority',()=>{const s=initialState();for(const id of ['geometry','routing','locations','explorer'] as const)s.data.assets[id]={status:'loaded',bytes:1};expect(capabilities(s).canRoute).toBe(true);s.view.variantResearch=true;expect(capabilities(s).canRoute).toBe(false);expect(capabilities(s).canExplore).toBe(false);expect(capabilities(s).canMeasureSphere).toBe(false);expect(capabilities(s).canProjectGlobally).toBe(true);expect(s.map.coordinateSpace).toBe('GaiaGeographic');});
 for(const lang of locales)it('complete locale '+lang,()=>{for(const [key]of worldVariantsCatalog)expect(dictionaries[lang][key]?.length).toBeGreaterThan(0);});
});
describe('private all-source regression',()=>{
 it.skipIf(!process.env.GAIA_WORLD_VARIANT_ORACLE||!process.env.GAIA_WORLD_VARIANT_RESOURCE)('matches every independent raw/Fraction oracle record',async()=>{
  const bytes=readFileSync(process.env.GAIA_WORLD_VARIANT_RESOURCE!),data=await decodeWorldVariants(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,'43e72295212311fcec3a513051a96ca4475185a72211ebc3a5e4f89a50eca78c');
  const oracle=JSON.parse(readFileSync(process.env.GAIA_WORLD_VARIANT_ORACLE!,'utf8')).oracle,faces=new Map(data.faces.map(f=>[f.id,f]));expect(oracle.length).toBe(faces.size);
  for(const r of oracle){const f=faces.get(r.id)!;expect(f, r.id).toBeDefined();expect(f.points).toEqual(r.points);expect(f.normals).toEqual(r.normals);expect(f.raw).toEqual(r.raw);expect(f.metrics.determinant).toBe(r.determinant);expect(f.metrics.area).toBe(r.area);expect(f.metrics.a===r.a).toBe(true);expect(f.metrics.b===r.b).toBe(true);expect(f.metrics.degenerate3D).toBe(r.degenerate);}
 },30000);
 it.skipIf(!process.env.GAIA_WORLD_VARIANT_RESOURCE)('cross-checks actual source groups',async()=>{const bytes=readFileSync(process.env.GAIA_WORLD_VARIANT_RESOURCE!),data=await decodeWorldVariants(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,'43e72295212311fcec3a513051a96ca4475185a72211ebc3a5e4f89a50eca78c');expect(data.faces).toHaveLength(30514);expect(data.meshes.reduce((n,m)=>n+m[6].length,0)).toBe(18700);expect(data.faces.filter(f=>f.metrics.zeroXZ)).toHaveLength(82);expect(data.groups.map(g=>g.stats.geometry_common)).toEqual([2760,4084,2275,5152]);expect(data.groups.reduce((n,g)=>n+g.stats.attribute_uv_difference_lower_bound,0)).toBe(383);expect(data.groups.map(g=>g.stats.all_common)).toEqual([2731,3591,2192,4965]);expect(data.script?.sites.map(r=>r.word_offset)).toEqual([137,143,149,155,169,183,197]);},30000);
});
