// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import curated from '../../src/gaiagis/atlas_data/content.json';
import {parseAtlasContent} from '../src/data/atlas';
import {parseRouting} from '../src/data/routing';
import type {PoiDataset} from '../src/data/poi';
import {resolveJourneyStation} from '../src/navigation/journeyTargets';
import {routingFixture} from './fixtures/routing';

const content=parseAtlasContent(curated),graph=()=>parseRouting(routingFixture());
function poi(location='kalm',field='elm'):PoiDataset {
 return {sources:{'wm0.map':'aa'.repeat(32)},locations:[{id:location,display_name:'Same display name',primary_entrance:'door-a',entrance_ids:['door-a','door-b'],field_names:[field]}],entrances:[
  {id:'door-a',location_id:location,source_kind:'derived_from_entry_trigger',world_map:0,section_id:0,mesh_id:0,trigger_triangle_ids:[0,1]},
  {id:'door-b',location_id:location,source_kind:'derived_from_entry_trigger',world_map:0,section_id:0,mesh_id:0,trigger_triangle_ids:[2,3]},
 ]} as unknown as PoiDataset;
}
const station=(id:string,p:PoiDataset|null=poi(),g=graph())=>resolveJourneyStation('occurrence-1',{kind:'atlas',id},false,p,content,g);

describe('evidence-aware Journey target identities',()=>{
 it('keeps every entrance and trigger node, including zero, for the selected location',()=>{
  const s=resolveJourneyStation('first',{kind:'location',id:'kalm'},false,poi(),content,graph());
  expect(s.reason).toBeNull();expect(s.locationId).toBe('kalm');expect(s.precision).toBe('entrance_level');
  expect(s.endpoints).toEqual([{node:0,entrance:'door-a'},{node:1,entrance:'door-a'},{node:2,entrance:'door-b'},{node:3,entrance:'door-b'}]);
 });
 it('retains an explicitly selected entrance identity without replacing the complete place range by its marker',()=>{
  const target={kind:'entrance' as const,id:'door-b'},s=resolveJourneyStation('second',target,false,poi(),content,graph());
  expect(s.target).toEqual(target);expect(s.endpoints).toHaveLength(4);expect(s.endpoints[0].node).toBe(0);
 });
 it('does not infer identity from a matching display name or field name',()=>{
  for(const id of ['Same display name','elm','Kalm'])expect(resolveJourneyStation('x',{kind:'location',id},false,poi(),content,graph()).reason).toBe('unverified_entrance');
  expect(station('Knights of the Round').reason).toBe('unverified_entrance');
 });
 it('keeps the Kalm reward identity and parent-place precision while routing only to Kalm',()=>{
  const s=station('kalm-treasure');expect(s.target).toEqual({kind:'atlas',id:'kalm-treasure'});
  expect(s).toMatchObject({precision:'parent_place',locationId:'kalm',reason:null});expect(s.endpoints).toHaveLength(4);
  expect(s).not.toHaveProperty('coordinates');expect(s).not.toHaveProperty('marker');
 });
 it('requires explicit confirmation before using the Knights reward parent as a separate route context',()=>{
  const p=poi('round-island-cave','zz8'),target={kind:'atlas' as const,id:'round-island-cave-reward'};
  const unconfirmed=resolveJourneyStation('knights',target,false,p,content,graph());
  expect(unconfirmed).toMatchObject({precision:'field_only',reason:'field_only',locationId:null,endpoints:[]});
  const confirmed=resolveJourneyStation('knights',target,true,p,content,graph());
  expect(confirmed).toMatchObject({precision:'field_only',reason:null,locationId:'round-island-cave'});expect(confirmed.target).toEqual(target);expect(confirmed.endpoints).toHaveLength(4);
 });
 it('keeps Gelnika as a Field-only reference even when a similarly named POI exists',()=>{
  const s=station('sunken-gelnika',poi('sunken-gelnika','qa'));expect(s).toMatchObject({precision:'field_only',reason:'field_only',locationId:null,endpoints:[]});
 });
 it('does not route a confirmed parent whose authored scene association fails existing Atlas binding validation',()=>{
  const s=resolveJourneyStation('knights',{kind:'atlas',id:'round-island-cave-reward'},true,poi('round-island-cave','unrelated'),content,graph());expect(s.reason).toBe('unverified_entrance');expect(s.endpoints).toEqual([]);
 });
 it('preserves offline original target identities without manufacturing endpoint coordinates',()=>{
  const s=resolveJourneyStation('offline',{kind:'atlas',id:'kalm-treasure'},false,null,content,null);
  expect(s).toMatchObject({id:'offline',target:{kind:'atlas',id:'kalm-treasure'},precision:'parent_place',reason:'workspace_missing',endpoints:[]});
  expect(resolveJourneyStation('offline-field',{kind:'atlas',id:'sunken-gelnika'},false,null,content,null).reason).toBe('field_only');
 });
 it('distinguishes an available place without Routing from an unverified place',()=>{
  expect(resolveJourneyStation('no-routing',{kind:'location',id:'kalm'},false,poi(),content,null)).toMatchObject({locationId:'kalm',reason:'routing_missing',endpoints:[]});
 });
 it('rejects missing or mismatched WM0 identity before accepting any nodes',()=>{
  for(const hash of [undefined,'bad','bb'.repeat(32)]){const p=poi();if(hash===undefined)delete p.sources['wm0.map'];else p.sources['wm0.map']=hash;expect(station('kalm-treasure',p).reason).toBe('source_stale');expect(station('kalm-treasure',p).endpoints).toEqual([]);}
 });
 it('does not silently discard one missing trigger lineage from an otherwise matching entrance',()=>{
  const p=poi();p.entrances[1].trigger_triangle_ids.push(99);expect(station('kalm-treasure',p)).toMatchObject({reason:'unverified_entrance',endpoints:[]});
 });
 it('rejects incomplete entrance associations and unverified source records',()=>{
  const missing=poi();missing.locations[0].entrance_ids.push('missing-door');expect(station('kalm-treasure',missing).reason).toBe('unverified_entrance');
  const unverified=poi();unverified.entrances[1].source_kind='nearest_point';expect(station('kalm-treasure',unverified).reason).toBe('unverified_entrance');
 });
});
