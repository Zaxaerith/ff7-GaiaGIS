// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {tinGradient,analyzeLegs,summarizeProfile,aspectCategory,sourceCorners,corridorLegs,surfaceAttributes} from '../src/analysis/spatial';
import {serviceArea,serviceProfiles} from '../src/analysis/serviceArea';
import {connectedComponents,parseRouting} from '../src/data/routing';
import {routingFixture} from './fixtures/routing';
import {terrainSlots} from '../src/data/encounters';
import {sourceGeographic} from '../src/explorer/coordinates';
import {ownLocomotion,locomotion} from '../src/explorer/locomotion';
import type {GaiaMesh} from '../src/data/mesh';
const attrs=(i:number)=>({origin:0,terrain:i%2,region:0,script:0,chocobo:i===1});
describe('source TIN methods',()=>{
 it('flat has zero slope and undefined aspect',()=>{expect(tinGradient([[0,0,1],[1,0,1],[0,1,1]])).toMatchObject({slope:0,aspect:null});});
 it.each([[0,1,0],[ -1,0,90],[0,-1,180],[1,0,270]])('GIS aspect of gradient %s/%s is %s',(east,south,aspect)=>{expect(tinGradient([[0,0,0],[1,0,east],[0,1,south]]).aspect).toBeCloseTo(aspect);});
 it('rise/run and independent configured scales',()=>{expect(tinGradient([[0,0,0],[1,0,1],[0,1,0]]).slope).toBeCloseTo(45);expect(tinGradient([[0,0,0],[1,0,1],[0,1,0]],2,1).slope).toBeCloseTo(Math.atan(.5)*180/Math.PI);});
 it('guards vertical/degenerate and steep faces',()=>{expect(tinGradient([[0,0,0],[0,0,1],[1,0,3]]).slope).toBeNull();expect(tinGradient([[0,0,0],[1,0,100000],[0,1,0]]).slope).toBeGreaterThan(89);});
 it.each([0,-1,NaN,Infinity])('rejects bad scale %s',scale=>expect(()=>tinGradient([[0,0,0],[1,0,1],[0,1,0]],scale)).toThrow());
 it('aspect category wraps north',()=>{expect(aspectCategory(359)).toBe(0);expect(aspectCategory(90)).toBe(2);});
 const raw=[[1000,1000,0],[2000,1000,100],[1000,2000,100],[2000,2000,0]],geographic=new Float32Array(raw.flatMap(p=>sourceGeographic(p[0],p[1],p[2]))),mesh={geographic,indices:new Uint32Array([0,1,2,1,3,2]),sourceTriangleCount:2,attributes:attrs} as GaiaMesh;
 it('recovers integer source vertices through the frozen mapping',()=>expect(sourceCorners(mesh,0)).toEqual(raw.slice(0,3)));
 it('walks source shared edge, with continuous height and finite sphere distances',()=>{const legs=corridorLegs(mesh,[0,1]);expect(legs.length).toBe(2);expect(legs[0].to).toEqual(legs[1].from);expect(legs.every(l=>l.distance>0)).toBe(true);expect(analyzeLegs(mesh,legs,null).samples.map(s=>s.rawHeight)).toEqual([200/3,100,200/3]);});
 it('caches source attribute arrays with one value per source face',()=>{const a=surfaceAttributes(mesh);expect(a.slope.length).toBe(2);expect(a.bytes).toBe(16);expect(a.aspect[0]).toBeCloseTo(315);});
 it('same-face route retains height with zero distance',()=>{const r=analyzeLegs(mesh,corridorLegs(mesh,[0]),null);expect(r.metrics).toMatchObject({distance:0,ascent:0,descent:0});expect(r.metrics?.min).toBeCloseTo(200/3);});
 it('rejects fabricated nonadjacent corridor and synthetic face',()=>{expect(()=>corridorLegs(mesh,[0,0])).toThrow();expect(()=>sourceCorners(mesh,2)).toThrow();});
});
describe('single-pass route summaries',()=>{
 const legs=[{triangle:0,from:[0,0,10],to:[1,0,30],distance:50},{triangle:1,from:[1,0,30],to:[2,0,5],distance:50}] as any;
 const encounters={regions:terrainSlots.map((s,id)=>({id,terrain_slots:s,yuffie_threshold:0})),encounter_sets:Array.from({length:64},(_,id)=>({id:`${Math.floor(id/4)}:${id%4}`}))} as any;
 it('profile min/max/ascent/descent and ordered samples',()=>{const r=analyzeLegs({attributes:attrs} as any,legs,null);expect(r.metrics).toEqual({distance:100,min:5,max:30,ascent:20,descent:25});expect(r.samples.map(s=>s.distance)).toEqual([0,50,100]);});
 it('50m grass and 50m forest = 50/50 by distance',()=>{expect(analyzeLegs({attributes:attrs} as any,legs,null).terrain.map(r=>r.percentage)).toEqual([50,50]);});
 it('unequal lengths override equal triangle counts',()=>{expect(analyzeLegs({attributes:attrs} as any,[legs[0],{...legs[1],distance:150}],null).terrain[0]).toMatchObject({id:'1',distance:150,percentage:75});});
 it('encounter lookup, aggregation and chocobo flags preserve static semantics',()=>{const r=analyzeLegs({attributes:attrs} as any,legs,encounters);expect(r.exposure).toMatchObject([{id:'0:0',distance:100,percentage:100}]);expect(r.chocoboDistance).toBe(50);expect('expectedBattles' in r).toBe(false);});
 it('splits distinct region/terrain sets at face boundary, including aliases',()=>{const mesh={attributes:(i:number)=>({...attrs(i),region:2,terrain:i?1:16})};const r=analyzeLegs(mesh as any,legs,encounters);expect(r.exposure.map(r=>[r.id,r.percentage])).toEqual([['2:0',50],['2:2',50]]);});
 it('explicitly absent encounters and raw/display unit conversion',()=>{const r=analyzeLegs({attributes:attrs} as any,legs,null,2);expect(r.encountersAvailable).toBe(false);expect(r.exposure).toEqual([]);expect(r.samples[0]).toMatchObject({rawHeight:10,elevation:20});});
 it('handles empty route and rejects sample disorder',()=>{expect(summarizeProfile([])).toBeNull();expect(()=>summarizeProfile([{distance:2,elevation:1},{distance:1,elevation:2}] as any)).toThrow();});
});
describe('distance-threshold Dijkstra on the existing graph',()=>{
 it('clips at threshold and preserves shortest paths over longer direct edges',()=>{const g=parseRouting(routingFixture()),labels=connectedComponents(g,'foot').labels;expect([...serviceArea(g,labels,[{node:0,entrance:'s'}],4).flags]).toEqual([1,1,0,0]);expect([...serviceArea(g,labels,[{node:0,entrance:'s'}],5).flags]).toEqual([1,1,1,0]);});
 it('zero threshold contains origin only; disconnected remains excluded',()=>{const g=parseRouting(routingFixture([0,0,0,0],[[0,1,2],[2,3,2]])),labels=connectedComponents(g,'foot').labels;expect(serviceArea(g,labels,[{node:0,entrance:'s'}],0).visited).toBe(1);expect(serviceArea(g,labels,[{node:0,entrance:'s'}],100).visited).toBe(2);});
 it('conditional exclusion uses unchanged routing owner',()=>{const g=parseRouting(routingFixture([0,13,0],[[0,1,2],[1,2,2]]));expect(serviceArea(g,connectedComponents(g,'foot').labels,[{node:0,entrance:'s'}],100).visited).toBe(1);expect(serviceArea(g,connectedComponents(g,'foot',true).labels,[{node:0,entrance:'s'}],100).visited).toBe(3);});
 it.each(serviceProfiles)('honors %s eligibility without another graph',mode=>{const g=parseRouting(routingFixture([0,1,3,8]));const r=serviceArea(g,connectedComponents(g,mode).labels,[{node:0,entrance:'s'}],100);expect(r.visited).toBeLessThanOrEqual(4);expect(r.flags.length).toBe(g.count);});
 it.each([-1,NaN,Infinity,40_000_001])('rejects invalid threshold %s',threshold=>{const g=parseRouting(routingFixture());expect(()=>serviceArea(g,connectedComponents(g,'foot').labels,[],threshold)).toThrow();});
});
describe('reviewed own-source character locomotion',()=>{
 it('does not change unrelated vehicle playback rate',()=>expect(locomotion({id:'buggy',animation_identity:'neutral_clip_indices'} as any,true,true).rate).toBe(1));
 it.each(Object.entries(ownLocomotion))('%s uses its own reviewed clip',(_,binding)=>{const id=Object.entries(ownLocomotion).find(([,v])=>v===binding)![0],model={id,hrc:binding.hrc,sourceKind:'extended_field',bone_count:binding.bones,animation_identity:'stationary_0_moving_1',clips:binding.clips.map(name=>({name,frame_count:15}))} as any;expect(locomotion(model,true)).toMatchObject({clip:2,rate:1});expect(locomotion(model,false).clip).toBe(0);model.clips[2].name='bie.a';expect(locomotion(model,true).clip).toBe(1);});
 it('Yuffie cadence is preview-only and leaders preserve source binding',()=>{const b=ownLocomotion.yuffie,m={id:'yuffie',hrc:b.hrc,sourceKind:'extended_field',bone_count:b.bones,animation_identity:'stationary_0_moving_1',clips:b.clips.map(name=>({name,frame_count:14}))} as any;expect(locomotion(m,true).rate).toBeCloseTo(14/15);expect(locomotion({...m,id:'cloud',sourceKind:'world_map'},true).clip).toBe(1);});
});
