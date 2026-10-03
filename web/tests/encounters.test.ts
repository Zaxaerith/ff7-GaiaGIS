// SPDX-License-Identifier: GPL-3.0-only
import {it,expect,vi,describe} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {parseEncounters,resolveEncounter,yuffieScene,chocoboRating,terrainSlots,yuffieThresholds,encounterKinds,
  encounterColor,encounterPalette,loadOptionalEncounters,readLocalEncounters} from '../src/data/encounters';
import type {TriangleAttributes,GaiaMeta} from '../src/data/mesh';
const hash='a'.repeat(64),meta={stage1:{source_wm0_sha256:hash}} as unknown as GaiaMeta;
function fixture(){
  return {schema:'gaiagis-encounters',version:1,reconstruction:'v1-geometric-gaia',lookup_profile:'classic-pc-reference',runtime_equivalence:'not-verified-steam2026',
    sources:{'wm0.map':hash,'world_us.lgp':hash,'enc_w.bin':hash},source_record:{filename:'enc_w.bin',size:2208,toc_index:0,archive_data_offset:4096},
    regions:terrainSlots.map((row,id)=>({id,terrain_slots:[...row],yuffie_threshold:yuffieThresholds[id]})),terrain_aliases:[{source:16,effective:0},{source:24,effective:8}],
    yuffie:Array.from({length:8},(_,i)=>({level_max:(i+1)*10,scene_id:100+i*2,raw_scene_id:100+i*2,byte_offset:i*4})),
    chocobo_ratings:Array.from({length:32},(_,i)=>({scene_id:i===0?23:9999,rating:i===0?4:0,valid:i===0,byte_offset:32+i*4})),
    encounter_sets:Array.from({length:64},(_,i)=>{
      let offset=162+i*32;const records=Object.fromEntries(encounterKinds.map((kind,k)=>[kind,Array.from({length:[6,2,1,1,4][k]},()=>{
        const e={scene_id:23,weight:i===0?7:0,packed:(i===0?7:0)<<10|23,encounter_type:kind,byte_offset:offset};offset+=2;return e;})]));
      return {id:`${Math.floor(i/4)}:${i%4}`,region_id:Math.floor(i/4),slot:i%4,byte_offset:160+i*32,active_raw:i===0?1:0,active:i===0,encounter_rate:20,padding_hex:'0000',records};
    })};
}
const attr={region:0,terrain:0,script:0,origin:0,chocobo:false} as TriangleAttributes;
describe('synthetic encounter schema and lookup',()=>{
  it('accepts synthetic structure and source binding',()=>expect(parseEncounters(fixture(),meta).encounter_sets).toHaveLength(64));
  it.each(['schema','version','reconstruction','lookup_profile'])('rejects incompatible %s',key=>{const f=fixture();(f as Record<string,unknown>)[key]='invalid';expect(()=>parseEncounters(f)).toThrow();});
  it('requires source identity when loaded with mesh metadata',()=>{expect(()=>parseEncounters(fixture(),{} as GaiaMeta)).toThrow(/unverified/);expect(()=>parseEncounters(fixture(),{stage1:{source_wm0_sha256:'b'.repeat(64)}} as never)).toThrow(/different/);});
  it('rejects malformed hash and archive provenance',()=>{const f=fixture();f.sources['enc_w.bin']='short';expect(()=>parseEncounters(f)).toThrow();const g=fixture();g.source_record.size=2209;expect(()=>parseEncounters(g)).toThrow();});
  it('rejects region and slot reordering',()=>{const f=fixture();f.regions[0].id=1;expect(()=>parseEncounters(f)).toThrow();const g=fixture();g.encounter_sets[0].slot=3;expect(()=>parseEncounters(g)).toThrow();});
  it('rejects aliases and altered behavioral table',()=>{const f=fixture();f.terrain_aliases[0].effective=1;expect(()=>parseEncounters(f)).toThrow();const g=fixture();g.regions[0].terrain_slots[1]=3;expect(()=>parseEncounters(g)).toThrow();});
  it('validates active bit without rejecting other raw bits',()=>{const f=fixture();f.encounter_sets[0].active_raw=3;expect(parseEncounters(f).encounter_sets[0].active).toBe(true);f.encounter_sets[0].active_raw=2;expect(()=>parseEncounters(f)).toThrow();});
  it('validates packed formation and weight fields',()=>{const f=fixture();f.encounter_sets[0].records.normal[0].weight=64;expect(()=>parseEncounters(f)).toThrow();const g=fixture();g.encounter_sets[0].records.normal[0].scene_id=1024;expect(()=>parseEncounters(g)).toThrow();});
  it('validates group count and offsets',()=>{const f=fixture();f.encounter_sets[0].records.chocobo.pop();expect(()=>parseEncounters(f)).toThrow();const g=fixture();g.encounter_sets[0].records.side_attack[0].byte_offset=0;expect(()=>parseEncounters(g)).toThrow();});
  it('clamps later regions and handles unmatched terrain fallback',()=>{const r=resolveEncounter(parseEncounters(fixture()),19,3);expect(r.effectiveRegion).toBe(15);expect(r.slot).toBe(0);expect(r.fallback).toBe(true);});
  it('first duplicate terrain match wins',()=>expect(resolveEncounter(parseEncounters(fixture()),1,0).slot).toBe(0));
  it('aliases Hillside and Gold Saucer Desert only',()=>{const d=parseEncounters(fixture());expect(resolveEncounter(d,0,16).effectiveTerrain).toBe(0);expect(resolveEncounter(d,4,24).slot).toBe(2);expect(resolveEncounter(d,4,28).fallback).toBe(true);});
  it('preserves inactive table data',()=>expect(resolveEncounter(parseEncounters(fixture()),2,1).set.active).toBe(false));
  it('resolves Yuffie level bound and original Jungle bonus',()=>{const d=parseEncounters(fixture());expect(yuffieScene(d,10,1)).toBe(100);expect(yuffieScene(d,11,25)).toBe(103);expect(yuffieScene(d,1000,1)).toBe(114);});
  it('rejects decreasing Yuffie bounds and fabricated rating valid flag',()=>{const f=fixture();f.yuffie[1].level_max=0;expect(()=>parseEncounters(f)).toThrow();const g=fixture();g.chocobo_ratings[1].valid=true;expect(()=>parseEncounters(g)).toThrow();});
  it('finds first Chocobo rating and ignores sentinel',()=>{const d=parseEncounters(fixture());expect(chocoboRating(d,23)).toBe(4);expect(chocoboRating(d,9999)).toBeNull();});
  it('colors active table, inactive table and independent script gate',()=>{const d=parseEncounters(fixture());expect(encounterColor(d,attr)).toBe(encounterPalette.active);expect(encounterColor(d,{...attr,script:1})).toBe(encounterPalette.script);expect(encounterColor(d,{...attr,region:1})).toBe(encounterPalette.inactive);});
  it('rate coloring shows raw intensity without fabricating frequency',()=>{const d=parseEncounters(fixture());const a=encounterColor(d,attr,true);d.encounter_sets[0].encounter_rate=255;expect(encounterColor(d,attr,true)).not.toBe(a);});
  it('keeps synthetic caps unassigned',()=>expect(encounterColor(parseEncounters(fixture()),{...attr,origin:1})).toBe(encounterPalette.unavailable));
  it('rejects invalid terrain input',()=>expect(()=>resolveEncounter(parseEncounters(fixture()),0,32)).toThrow());
});
describe('optional local encounter loading',()=>{
  it('absent file returns null',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{status:404})));expect(await loadOptionalEncounters(meta)).toBeNull();vi.unstubAllGlobals();});
  it('corrupt optional file rejects explicitly',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{headers:{'content-type':'application/json'}})));await expect(loadOptionalEncounters(meta)).rejects.toThrow();vi.unstubAllGlobals();});
  it('rejects request failure and wrong content type',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{status:500})));await expect(loadOptionalEncounters(meta)).rejects.toThrow(/500/);vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>')));await expect(loadOptionalEncounters(meta)).rejects.toThrow(/not JSON/);vi.unstubAllGlobals();});
  it('reads a local JSON file without any upload',async()=>{const file={size:100,text:async()=>JSON.stringify(fixture())} as File;expect((await readLocalEncounters(file,meta)).regions).toHaveLength(16);});
  it('rejects oversized local file',async()=>{await expect(readLocalEncounters({size:1_000_001} as File,meta)).rejects.toThrow(/large/);});
});
const real=new URL('../public/data/gaia-encounters.json',import.meta.url),metadata=new URL('../public/data/gaia-meta.json',import.meta.url);
it.skipIf(!existsSync(real)||!existsSync(metadata))('local real generated data binds to unchanged mesh source',()=>{
  const d=parseEncounters(JSON.parse(readFileSync(real,'utf8')),JSON.parse(readFileSync(metadata,'utf8')));
  expect(d.encounter_sets.filter(s=>s.active).length).toBeGreaterThan(0);
  for(let region=0;region<32;region++)for(let terrain=0;terrain<32;terrain++)expect(resolveEncounter(d,region,terrain).set).toBeDefined();
});
