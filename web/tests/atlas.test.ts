// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import curated from '../../src/gaiagis/atlas_data/content.json';
import {parseAtlasContent,parseAtlasPack,searchAtlas,resolveBinding,atlasAnchor,spoilerVisible,validateAtlasPoi} from '../src/data/atlas';
import type {AtlasPack,AtlasEntity} from '../src/data/atlas';
import type {PoiDataset} from '../src/data/poi';

const content=parseAtlasContent(curated);
const entity=content.entities.find(e=>e.id==='midgar')!;
const poi={sources:{'wm0.map':'a'.repeat(64)},locations:[{id:'midgar',primary_entrance:'entry-1',entrance_ids:['entry-1'],field_names:['synthetic']}],entrances:[{id:'entry-1',location_id:'midgar',source_kind:'derived_from_entry_trigger',longitude:1,latitude:2,height:0}]} as unknown as PoiDataset;
const clone=()=>structuredClone(curated);
describe('Atlas schema and provenance',()=>{
 it('accepts the authored five-locale dataset and all named identities',()=>{expect(content.entities).toHaveLength(58);expect(content.entities.filter(e=>e.spatialBinding.kind==='location')).toHaveLength(34);});
 for(const [name,mutate]of [
  ['source missing',(c:ReturnType<typeof clone>)=>{c.entities[0].sources=[];}],
  ['broken source',(c:ReturnType<typeof clone>)=>{c.entities[0].sources=['missing'];}],
  ['invalid type',(c:ReturnType<typeof clone>)=>{c.entities[0].kind='made-up';}],
  ['duplicate',(c:ReturnType<typeof clone>)=>{c.entities.push(c.entities[0]);}],
  ['relation',(c:ReturnType<typeof clone>)=>{c.entities[0].relatedEntities=['missing'];}],
  ['spoiler',(c:ReturnType<typeof clone>)=>{c.entities[0].spoilerLevel='wrong';}],
  ['unsafe URL',(c:ReturnType<typeof clone>)=>{c.sources[0].url='javascript:alert(1)';}],
  ['locale missing',(c:ReturnType<typeof clone>)=>{delete (c.entities[0].summary as Partial<typeof c.entities[0]['summary']>).ja;}],
 ] as const)it('rejects '+name,()=>{const c=clone();mutate(c);expect(()=>parseAtlasContent(c)).toThrow();});
 it('rejects a public coordinate and unsourced fact',()=>{const c=clone();Object.assign(c.entities[0].spatialBinding,{longitude:1});expect(()=>parseAtlasContent(c)).toThrow();const d=clone();d.entities[0].facts=[{kind:'reward',text:d.entities[0].summary,spoilerLevel:'minor',sources:[]}];expect(()=>parseAtlasContent(d)).toThrow();});
});
describe('Atlas search and spoilers',()=>{
 it('ranks one-edit misspellings after literal names without broad matching',()=>{expect(searchAtlas(content,'Midgr','en').some(e=>e.id==='midgar')).toBe(true);expect(searchAtlas(content,'Mxxgar','en')).toHaveLength(0);});
 it('finds names, internal aliases, localized aliases and rewards',()=>{for(const query of ['Midgar','mds5_5','米德加','ミッドガル','미드가르'])expect(searchAtlas(content,query,'zh-CN').some(e=>e.id==='midgar')).toBe(true);expect(searchAtlas(content,'Knights of the Round','en').some(e=>e.id==='round-island-cave')).toBe(true);});
 it('normalizes accents, HP variants and category/region search',()=>{expect(searchAtlas(content,'HP<->MP','en').some(e=>e.id==='hp-mp-cave')).toBe(true);expect(searchAtlas(content,'materia_cave','en').filter(e=>e.kind==='materia_cave')).toHaveLength(4);expect(searchAtlas(content,'northern','en').length).toBeGreaterThan(0);});
 it('keeps major reward terms out of parent search until explicitly shown',()=>{expect(searchAtlas(content,'Black Materia','en')).toHaveLength(0);expect(searchAtlas(content,'Black Materia','en','show-all').some(e=>e.id==='temple-of-the-ancients')).toBe(true);expect(spoilerVisible('major')).toBe(false);expect(spoilerVisible('minor','hide-all')).toBe(false);});
 it('filters discoveries, category and region independently',()=>{expect(searchAtlas(content,'','en','hide-major','collectibles').every(e=>e.tags.includes('collectible'))).toBe(true);expect(searchAtlas(content,'','en','hide-major','places','wutai','town').map(e=>e.id)).toEqual(['wutai']);});
 it('ranks the current locale name before canonical matches',()=>{const a=structuredClone(entity),b=structuredClone(entity);a.id='a';a.localizedNames.ja='試験';b.id='b';b.canonicalName='試験';b.localizedNames.ja='別名';expect(searchAtlas({...content,entities:[b,a]},'試験','ja')[0].id).toBe('a');});
});
describe('Atlas spatial rigor',()=>{
 it('resolves only through verified local identity',()=>{const b=resolveBinding(entity,poi);expect(b.precision).toBe('entrance_level');expect(atlasAnchor(b,poi)?.entrance.id).toBe('entry-1');expect(resolveBinding(entity,null).marker).toBe(false);});
 for(const kind of ['parent_location','field_parent','non_spatial','unresolved'] as const)it('does not emit a '+kind+' point',()=>{const e={...entity,spatialBinding:{kind,locationId:kind.includes('parent')?'midgar':undefined,fieldNames:kind==='field_parent'?['synthetic']:undefined}} as AtlasEntity;const b=resolveBinding(e,poi);expect(b.marker).toBe(false);expect(atlasAnchor(b,poi)).toBeNull();expect(Object.keys(b)).not.toContain('longitude');if(kind.includes('parent'))expect(atlasAnchor(b,poi,true)?.location.id).toBe('midgar');});
 it('rejects a fake marker in a private pack and mismatched or missing POI source',()=>{const c={...content,entities:[{...entity,relatedEntities:[],relatedLocations:[],collectibles:[],secrets:[]}],exclusions:[]};const b=resolveBinding(entity,poi);const pack={schema:'gaiagis-atlas',version:1,curated_sha256:'a'.repeat(64),content:c,sources:poi.sources,bindings:{midgar:b}} as AtlasPack;parseAtlasPack(pack);validateAtlasPoi(pack,poi);expect(()=>validateAtlasPoi(pack,{...poi,sources:{'wm0.map':'b'.repeat(64)}})).toThrow();expect(()=>validateAtlasPoi({...pack,sources:{}},poi)).toThrow();b.precision='parent_place';expect(()=>parseAtlasPack(pack)).toThrow();});
 it('rejects a changed entrance reference even if its string has a valid shape',()=>{const c={...content,entities:[{...entity,relatedEntities:[],relatedLocations:[],collectibles:[],secrets:[]}],exclusions:[]},b=resolveBinding(entity,poi);b.entranceId='entry-fake';b.relatedEntrances.push('entry-fake');const pack={schema:'gaiagis-atlas',version:1,curated_sha256:'a'.repeat(64),content:c,sources:poi.sources,bindings:{midgar:b}} as AtlasPack;parseAtlasPack(pack);expect(()=>validateAtlasPoi(pack,poi)).toThrow();});
});
