// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect,beforeAll} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {createVariantComparison} from '../src/analysis/variantComparison';
import {nativeTriangle,querySurfaces,transectSurfaces,resourceCoverage} from '../src/analysis/native';
import type {NativePoint,SurfaceSource} from '../src/analysis/native';
import {decodeWorldVariants} from '../src/data/worldVariants';
import type {VariantFace,WorldVariants} from '../src/data/worldVariants';

function face(section:number,id:string,points:NativePoint[]):VariantFace{return {id,section,placement:50,points,metrics:nativeTriangle(points)} as VariantFace;}
const p:NativePoint[]=[[163840,163840,0],[163844,163840,4],[163840,163844,8]];
function data(faces:VariantFace[]){return {faces,meshes:[[50,50],[63,50]]} as unknown as WorldVariants;}
function source(points:NativePoint[][]):SurfaceSource<string>{return {count:points.length,corners:i=>points[i],source:i=>'source-'+i,metrics:i=>({...nativeTriangle(points[i]),bounds:[Math.min(...points[i].map(p=>p[0])),Math.max(...points[i].map(p=>p[0])),Math.min(...points[i].map(p=>p[1])),Math.max(...points[i].map(p=>p[1]))]})};}

describe('shared exact source adapter and comparison',()=>{
 it('queries separate identities without ordinal pairing; inputs remain exact',()=>{const d=data([face(50,'50/0/7',p),face(63,'63/9/42',p.map(([x,z,h])=>[x,z,h-10]))]),r=createVariantComparison(d).point(0,1,['491521/3','491521/3']);expect(r.left.hits[0].source.id).toBe('50/0/7');expect(r.right.hits[0].source.id).toBe('63/9/42');expect(r.left.hits[0].exactHeights[0]).toBe('1');expect(r.delta).toEqual({value:-10,exact:'-10'});expect(r.coverage).toBe('inside');});
 it('never reduces duplicates, shared-edge or vertical evidence to a delta',()=>{const a=face(63,'alt',p),b=face(50,'base',p),v=face(63,'wall',[[163841,163840,0],[163841,163844,0],[163841,163840,10]]);expect(createVariantComparison(data([b,a,face(63,'duplicate',p)])).point(0,1,[163841,163841]).delta).toBeNull();expect(createVariantComparison(data([b,a,v])).point(0,1,[163841,163841]).delta).toBeNull();const shared=face(63,'edge',[[163844,163840,4],[163844,163844,12],[163840,163844,8]]),r=createVariantComparison(data([b,a,shared])).point(0,1,[163842,163842]);expect(r.right.hits).toHaveLength(2);expect(r.right.heightCount).toBe(1);expect(r.delta).toBeNull();});
 it('separates outer boundaries, loaded internal seams and absent regions exactly',()=>{const rectangles=[[0,10,0,10],[10,20,0,10]] as const;expect(resourceCoverage(rectangles,[10,5])).toBe('inside');expect(resourceCoverage(rectangles,[10,0])).toBe('boundary');expect(resourceCoverage(rectangles,['-0.000000000000000001',5])).toBe('outside');expect(resourceCoverage(rectangles,[0,5])).toBe('boundary');});
 it('distinguishes covered no-hit from resource absent, including exact clipped intervals',()=>{const s=source([[[0,0,0],[1,0,1],[0,1,2]]]),rectangles=[[0,1,0,1]] as const;expect(querySurfaces(s,['3/4','3/4']).hits).toEqual([]);expect(resourceCoverage(rectangles,['3/4','3/4'])).toBe('inside');const r=transectSurfaces(s,[-1,'3/4'],[2,'3/4'],rectangles);expect(r.coverage!.covered[0].exactT).toEqual(['1/3','2/3']);expect(r.coverage!.uncovered.map(p=>p.exactT)).toEqual([['0','1/3'],['2/3','1']]);expect(r.coverage!.noSurface[0].exactT).toEqual(['5/12','2/3']);expect(r.traces[0].exactT).toEqual(['1/3','5/12']);});
 it('preserves degenerate events and vertical bands with independent sources',()=>{const s=source([[[0,0,0],[4,0,0],[0,0,8]],[[1,0,0],[1,0,3],[1,0,9]]]);expect(querySurfaces(s,[1,0]).hits.map(h=>h.kind)).toEqual(['vertical','degenerate']);const r=transectSurfaces(s,[0,0],[4,0],[[0,4,-1,1]]);expect(r.traces.map(t=>t.kind)).toEqual(['vertical_band','degenerate_band']);expect(r.coverage!.noSurface[0].exactT).toEqual(['0','1']);});
});

const path=process.env.GAIA_WORLD_VARIANT_RESOURCE??'../output/dev/current/world-variants/world-variants.json';
describe.skipIf(!existsSync(path))('actual unchanged private Variant resource',()=>{
 let queries:ReturnType<typeof createVariantComparison>,d:WorldVariants;
 beforeAll(async()=>{const bytes=readFileSync(path);d=await decodeWorldVariants(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'43e72295212311fcec3a513051a96ca4475185a72211ebc3a5e4f89a50eca78c');queries=createVariantComparison(d);});
 it.each([
  [0,1,'510089/3','547085/3','-1760','50/8/15','63/8/15'],
  [1,2,'175979','133610','10','41/1/33','64/1/33'],
  [2,3,'641024/3','199290','-16','60/2/33','66/2/33'],
  [3,4,'293017/3','502708/3','2450317/96357','47/3/38','67/3/38']
 ] as const)('G%d→%d retains exact heights and sources', (a,b,x,z,delta,left,right)=>{const r=queries.point(a,b,[x,z]);expect(r.delta?.exact).toBe(delta);expect(r.left.hits[0].source.id).toBe(left);expect(r.right.hits[0].source.id).toBe(right);});
 it.each([
  [1,2,'507551/3','146422',3,3],[2,3,'660265/3','604807/3',4,1],
  [3,4,'262898/3','510173/3',4,4],[2,3,'395817/2','394175/2',2,2],[3,4,'66048','328105/2',2,2]
 ] as const)('preserves multivalue/vertical/shared-edge %s→%s at %s,%s',(a,b,x,z,n,m)=>{const r=queries.point(a,b,[x,z]);expect(r.left.hits).toHaveLength(n);expect(r.right.hits).toHaveLength(m);expect(r.delta).toBeNull();});
 it('keeps attribute/UV differences even at zero height delta',()=>{const r=queries.point(1,2,['538505/3','414776/3']);expect(r.delta?.exact).toBe('0');expect(r.left.hits[0].source.raw[10]).toBe(1220);expect(r.right.hits[0].source.raw[10]).toBe(1229);expect(r.left.hits[0].source.uv).not.toEqual(r.right.hits[0].source.uv);});
 it.each([
  [0,1,'507017/3','547085/3','513161/3','547085/3',[8,4,0,0],[12,0,0,0]],
  [1,2,'507551/3','145910','507551/3','146934',[5,1,0,0],[5,1,0,0]],
  [1,2,'169322','146422','168960','146422',[3,0,2,8],[3,0,2,8]],
  [2,3,'660265/3','603271/3','660265/3','606343/3',[7,3,0,0],[6,0,0,0]],
  [3,4,'87562','169823','87668','170175',[4,2,1,6],[4,2,1,6]]
 ] as const)('G%d→%d same-line source segments/events/bands',(a,b,x,z,u,v,l,r)=>{const q=queries.transect(a,b,[x,z],[u,v]),counts=(s:typeof q.left)=>['surface','vertical_event','vertical_band','touch'].map(k=>s.traces.filter(t=>t.kind===k).length);expect(counts(q.left)).toEqual(l);expect(counts(q.right)).toEqual(r);expect(q.left.length).toBe(q.right.length);});
 it('does not call the unprovided front of a real transect a terrain hole',()=>{const q=queries.transect(0,4,[160000,180000],[180000,180000]);for(const s of [q.left,q.right]){expect(s.traces).toHaveLength(36);expect(s.coverage!.uncovered.map(p=>p.exactT)).toEqual([['0','24/125']]);expect(s.coverage!.noSurface).toEqual([]);}expect(queries.point(0,4,[160000,180000]).coverage).toBe('outside');expect(queries.point(0,4,[163840,180000]).coverage).toBe('boundary');});
});
