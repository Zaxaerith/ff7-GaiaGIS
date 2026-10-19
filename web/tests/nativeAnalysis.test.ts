// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {nativeTriangle,rawDistance,analyzeNative,matchesDiagnostic} from '../src/analysis/native';
import type {NativePoint} from '../src/analysis/native';
import {decodeNativeMap} from '../src/data/nativeMaps';
import type {NativeMap} from '../src/data/nativeMaps';
import {dictionaries,locales} from '../src/i18n';
import {nativeGisCatalog} from '../src/i18n/nativeGisCatalog';

function mesh(points:NativePoint[][],terrains:number[]=[]){return {positions:Float32Array.from(points.flat(2)),sourceTriangleCount:points.length,attributes:(i:number)=>{if(!Number.isInteger(i)||i<0||i>=points.length)throw Error('Index');return {terrain:terrains[i]??0};}} as NativeMap;}
describe('native raw geometry',()=>{
 it('preserves exact determinant, reversed winding and signed plane',()=>{const p:NativePoint[]=[[-2,-3,5],[5,-3,7],[-2,8,-1]],a=nativeTriangle(p),b=nativeTriangle(p.slice().reverse());expect(a.determinant).toBe(-b.determinant);expect(a.a).toBeCloseTo(2/7,14);expect(a.b).toBeCloseTo(-6/11,14);expect(a.area).toBe(38.5);expect(a.a).toBe(b.a);});
 it('separates vertical and 3D degenerate',()=>{const v=nativeTriangle([[0,0,0],[0,0,10],[0,10,0]]);expect(v.zeroXZ).toBe(true);expect(v.degenerate3D).toBe(false);expect(v.a).toBeNull();expect(v.b).toBeNull();expect(nativeTriangle([[0,0,0],[1,1,1],[2,2,2]]).degenerate3D).toBe(true);});
 it('raw distance does not use display height',()=>expect(rawDistance([0,0,-100],[3,4,100])).toBe(5));
 it('retains full integer range',()=>{const p=nativeTriangle([[-32768,-32768,-32768],[32767,-32768,32767],[-32768,32767,32767]]);expect(p.determinant).toBe(65535**2);expect(p.a).toBe(1);expect(p.b).toBe(1);});
 for(const p of [[],[[0,0,0]],[[.5,0,0],[0,0,0],[0,0,0]],[[Infinity,0,0],[0,0,0],[0,0,0]],[[1000001,0,0],[0,0,0],[0,0,0]]])it('rejects malformed input '+JSON.stringify(p),()=>expect(()=>nativeTriangle(p as unknown as NativePoint[])).toThrow());
 it('duplicate contributions are not union and all members are marked',()=>{const p:NativePoint[]=[[0,0,0],[2,0,0],[0,2,0]],m=analyzeNative(mesh([p,p.slice().reverse()]));expect(m.summary.duplicateExcess).toBe(1);expect(m.summary.area).toBe(4);expect(m.faces.map(f=>f.duplicateCount)).toEqual([2,2]);expect(m.terrain.get(0)?.area).toBe(4);});
 it('does not join three-owner edges, weld height or wrap',()=>{const p:NativePoint[]=[[0,0,0],[1,0,0],[0,1,0]],q:NativePoint[]=[p[0],p[1],[0,-1,0]],r:NativePoint[]=[p[0],p[1],[0,0,1]],m=analyzeNative(mesh([p,q,r]));expect(m.summary.components).toBe(3);expect(m.summary.incidenceGT2).toBe(1);expect(matchesDiagnostic(m.faces[0],'nonmanifold')).toBe(true);});
 it('counts repeated edge occurrences without self adjacency',()=>{const m=analyzeNative(mesh([[[0,0,0],[0,0,0],[1,1,1]]]));expect(m.summary.collapsedKeys).toBe(1);expect(m.faces[0].repeated).toBe(2);expect(m.summary.components).toBe(1);});
 for(const lang of locales)it('complete '+lang+' native text',()=>{for(const [key]of nativeGisCatalog)expect(dictionaries[lang][key]?.length).toBeGreaterThan(0);});
});
const oracle=process.env.GAIA_NATIVE_ORACLE,workspace=process.env.GAIA_BROWSER_WORKSPACE;
it.skipIf(!oracle||!workspace)('all original Native v1 records match independent Fraction/source oracle',async()=>{
 const reports=JSON.parse(readFileSync(oracle!,'utf8'));
 for(const report of reports){const bytes=readFileSync(workspace!+'/gaia-map-'+report.map+'.bin'),map=await decodeNativeMap(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),result=analyzeNative(map);expect(map.header.source_sha256).toBe(report.source_sha256);expect(result.faces.length).toBe(report.exact_records);
  for(let i=0;i<result.faces.length;i++){const m=result.faces[i],o=report.oracle[i];expect(m.determinant).toBe(o.determinant);expect(m.area).toBe(o.area);expect(m.zeroXZ).toBe(o.zero);expect(m.degenerate3D).toBe(o.degenerate);expect(m.duplicateCount).toBe(o.duplicate);expect(m.incidence).toEqual(o.incidence);expect(m.component).toBe(o.component);if(o.a===null){expect(m.a).toBeNull();expect(m.b).toBeNull();}else{expect(m.a).toBe(o.a);expect(m.b).toBe(o.b);}}
  expect(result.summary.area).toBe(report.summary.area);expect(result.summary.components).toBe(report.summary.components);expect(result.summary.edgeKeys).toBe(report.summary.edge_keys);console.log(JSON.stringify({map:report.map,faces:result.faces.length,analysisMs:result.milliseconds,sourceExact:true}));
 }
},30000);
