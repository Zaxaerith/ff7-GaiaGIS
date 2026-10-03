// SPDX-License-Identifier: GPL-3.0-only
import {it,expect,describe} from 'vitest';
import {movementProfiles,traversalProfile,evaluateTraversal,referenceGate,maskAllows,profileById,traversalColor,traversalPalette,chocoboExitHeightCompatible} from '../src/data/traversal';
import type {TriangleAttributes} from '../src/data/mesh';
const a={terrain:0,script:0,origin:0,chocobo:false,region:0} as TriangleAttributes;
describe('static traversal profile',()=>{
  it('covers ten modes and every one of 32 terrain codes deterministically',()=>{
    expect(movementProfiles).toHaveLength(10);
    for(const p of movementProfiles)for(let t=0;t<32;t++)for(let s=0;s<8;s++){
      expect(evaluateTraversal(p.id,t,s)).toEqual(evaluateTraversal(p.id,t,s));
      expect(Object.keys(traversalPalette)).toContain(evaluateTraversal(p.id,t,s).state);
    }
  });
  it.each([-1,32,NaN,1.5])('rejects invalid terrain %s',t=>expect(()=>evaluateTraversal('foot',t)).toThrow());
  it('rejects unknown profile, tint and script',()=>{expect(()=>profileById('airborne-highwind')).toThrow();expect(()=>referenceGate(19,0,{tint:5})).toThrow();expect(()=>evaluateTraversal('foot',0,8)).toThrow();});
  it('keeps current executable equivalence unverified and separates movement/exit scopes',()=>{expect(traversalProfile.runtime_equivalence).toBe('not-verified-steam2026');expect(evaluateTraversal('foot',0).runtime_available).toBe('not_simulated');expect(evaluateTraversal('foot',0).enter_exit_compatible).toBe('unknown');expect(evaluateTraversal('highwind-landing',0).scope).toBe('landing_initiation');expect(evaluateTraversal('highwind-landing',0).terrain_compatible).toBe('unknown');});
  it('normal foot includes bridges and Back Entrance but excludes sea/cliffs/unused',()=>{for(const t of [0,1,13,14,20,29,30])expect(evaluateTraversal('foot',t).state).toBe('allowed');for(const t of [2,3,12,15,18,21,23,27,31])expect(evaluateTraversal('foot',t).state).toBe('blocked');});
  it('bridge restriction uses current terrain and current model',()=>{expect(referenceGate(0,0)).toBe(true);expect(referenceGate(0,0,{currentTerrain:13,currentModel:0})).toBe(false);expect(referenceGate(0,29,{currentTerrain:14,currentModel:0})).toBe(true);expect(referenceGate(0,0,{currentTerrain:13,currentModel:3})).toBe(true);});
  it('buggy river crossing and departure are different',()=>{expect(evaluateTraversal('buggy',4).state).toBe('allowed');expect(evaluateTraversal('buggy',4).enter_exit_initiation).toBe('blocked');for(const t of [3,5,6])expect(referenceGate(6,t)).toBe(false);expect(referenceGate(6,24)).toBe(true);});
  it('Bronco water excludes deep sea and exit destination allows beach/riverside',()=>{for(const t of [4,5,6])expect(referenceGate(5,t)).toBe(true);for(const t of [3,17,22,26])expect(referenceGate(5,t)).toBe(false);for(const t of [11,17])expect(referenceGate(5,t,{leaveState:2})).toBe(true);expect(referenceGate(5,6,{leaveState:2})).toBe(false);});
  it('Bronco airborne/descent is a separate branch',()=>{expect(referenceGate(5,2,{airborne:true})).toBe(true);expect(referenceGate(5,2,{airborne:true,flightState:-1})).toBe(false);expect(referenceGate(5,6,{airborne:true,flightState:-1})).toBe(true);});
  it('Highwind airborne permission does not imply landing',()=>{expect(referenceGate(3,3)).toBe(true);expect(evaluateTraversal('highwind-landing',3).state).toBe('blocked');expect(referenceGate(3,3,{flightState:-1})).toBe(false);expect(referenceGate(3,0,{flightState:-1})).toBe(true);});
  it('Northern Cave is a conditional script path, not ordinary grass landing',()=>{expect(evaluateTraversal('highwind-landing',27).state).toBe('conditional');expect(evaluateTraversal('highwind-landing',27).evidence).toBe('script_dependent');});
  it('grass script 7 permits landing initiation but blocks exit candidate',()=>{expect(evaluateTraversal('highwind-landing',0,7).state).toBe('conditional');expect(referenceGate(3,7<<5,{leaveState:2})).toBe(false);});
  it('exit gate is script !=7, different from encounter script==0',()=>{expect(referenceGate(6,1<<5,{leaveState:2})).toBe(true);expect(referenceGate(6,7<<5,{leaveState:2})).toBe(false);expect(referenceGate(0,7<<5)).toBe(true);expect(referenceGate(5,17|(7<<5),{leaveState:2})).toBe(true);});
  it.each([[0,false,false,false],[1,true,false,false],[2,false,true,false],[3,true,true,false],[4,true,true,true]])('Chocobo tint %i capability boundaries', (tint,mountain,water,sea)=>{expect([2,6,3].map(t=>referenceGate(19,t,{tint:Number(tint)}))).toEqual([mountain,water,sea]);});
  it('owned Gold exits using yellow mask while wild remains yellow',()=>{expect(referenceGate(19,2,{tint:4})).toBe(true);expect(referenceGate(19,2,{tint:4,leaveState:2})).toBe(false);expect(referenceGate(4,2,{tint:4})).toBe(false);});
  it('strict raw-height Chocobo exit boundary',()=>{for(const d of [-199,0,199])expect(chocoboExitHeightCompatible(-500,-500+d)).toBe(true);for(const d of [-200,200,201])expect(chocoboExitHeightCompatible(-500,-500+d)).toBe(false);expect(()=>chocoboExitHeightCompatible(0,NaN)).toThrow();});
  it('Submarine surface occupancy is not surface departure or WM2',()=>{for(const t of [3,15,18,26])expect(evaluateTraversal('submarine-surface',t).state).toBe('allowed');expect(evaluateTraversal('submarine-surface',3).enter_exit_initiation).toBe('blocked');expect(evaluateTraversal('submarine-surface',18).enter_exit_initiation).toBe('allowed');});
  it('higher terrain-info bits leave the terrain mask unchanged',()=>{for(const model of [0,3,4,5,6,8,13,19,100])for(let t=0;t<32;t++)expect(referenceGate(model,t|0xff00)).toBe(referenceGate(model,t));});
  it('handles unsigned bit31 and rejects invalid packed input',()=>{expect(maskAllows('0x80000000',31)).toBe(true);for(const t of [-1,65536,NaN])expect(()=>referenceGate(0,t)).toThrow();});
  it('unknown model default-success is not a supported movement mode',()=>{for(const m of [9,41,42,255])expect(referenceGate(m,0)).toBeNull();});
  it('four-state colors and missing source caps',()=>{expect(traversalColor('foot',a)).toBe(traversalPalette.allowed);expect(traversalColor('foot',{...a,terrain:3})).toBe(traversalPalette.blocked);expect(traversalColor('highwind-landing',{...a,terrain:27})).toBe(traversalPalette.conditional);expect(traversalColor('foot',{...a,origin:1,terrain:null})).toBe(traversalPalette.unknown);});
  it('tracks, region and encounter attributes do not alter traversal',()=>{expect(traversalColor('foot',a)).toBe(traversalColor('foot',{...a,chocobo:true,region:19}));});
  it('shared profile JSON has unique stable identifiers and complete evidence',()=>{expect(new Set(movementProfiles.map(p=>p.id)).size).toBe(10);for(const p of movementProfiles)expect(p.mask).toMatch(/^0x[0-9A-F]{8}$/);expect(traversalProfile.evidence).toBe('verified_reference_logic');});
  it('human leader masks share the same behavior',()=>{for(let t=0;t<32;t++){expect(referenceGate(1,t)).toBe(referenceGate(0,t));expect(referenceGate(2,t)).toBe(referenceGate(0,t));}});
});
