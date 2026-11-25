// SPDX-License-Identifier: GPL-3.0-only
import {describe,expect,it} from 'vitest';
import {beginEvidenceNavigation,beginPublicNavigation,browsingEvidence,evidenceStoryVisible} from '../src/app/evidenceSession';
import {evidenceRank,evidenceTerms,findFieldEvidence,gameplayDiscovery,literalAcquisition,parseEvidenceQuery,verifiedFieldOwners} from '../src/analysis/evidenceDiscovery';
import type {EvidenceQuery} from '../src/analysis/evidenceDiscovery';
import type {FieldEventRow} from '../src/analysis/fieldEventEvidence';
import type {GameplayIndex,GameplayRecord} from '../src/data/gameplay';

describe('qualified spatial evidence identities',()=>{
 it.each([
  ['face:0',{type:'global',kind:'face',id:'0'}],
  ['formation:000',{type:'global',kind:'formation',id:'0'}],
  ['enemy:0/74',{type:'global',kind:'enemy',id:'0/74'}],
  ['enemy:9/74',{type:'global',kind:'enemy',id:'9/74'}],
  ['set:00:0',{type:'global',kind:'set',id:'0:0'}],
  ['field:0',{type:'field',field:'0',key:undefined,aliases:{}}],
  ['field:Test_1 actor:0 slot:4 entry:3107 kind:table',{type:'field',field:'test_1',key:undefined,aliases:{actor:0,slot:4,entry:3107,ownerKind:'table'}}],
  ['field:3 triangle:0',{type:'field',field:'3',key:{kind:'triangle',id:0},aliases:{}}],
 ])('resolves %s without truthy/default IDs',(text,expected)=>expect(parseEvidenceQuery(text)).toEqual(expected));
 it.each([
  ['74','category'],['enemy:74','enemy'],['line:0','scope'],['field:3 text:300','syntax'],
  ['field:3 slot:32','syntax'],['field:3 field:4','syntax'],['formation:0x10','syntax'],
  ['field:3 trigger:0 actor:2','syntax'],['monster:4','syntax'],['field:3 line:0 if:0','syntax'],['x'.repeat(257),'limit'],
 ])('rejects %s without falling back to names',(text,reason)=>expect(parseEvidenceQuery(text)).toEqual({type:'error',reason}));
 it('ranks internal identity ahead of aliases, prefix and fuzzy matching',()=>{
  expect(evidenceRank('Test_1','test_1',evidenceTerms(['Other']))).toBe(0);
  expect(evidenceRank('mythril','',evidenceTerms(['Mine','mythril']))).toBe(1);
  expect(evidenceRank('mythril','',evidenceTerms(['Mythril Mine']))).toBe(2);
  expect(evidenceRank('mythril','',evidenceTerms(['Old Mythril Mine']))).toBe(3);
 });
});

describe('source-scoped discovery',()=>{
 const owner={actor:0,slot:0,entry:4,kind:'table' as const,name:null};
 const field=(id:number,kind:string)=>{
  const record={offset:8,opcode:kind==='IFUB'?20:225,owners:[0],raw:'',entryReachable:true};
  const row:FieldEventRow={kind,owners:[owner],offset:8,section:1,channel:kind==='IFUB'?'condition':'script',key:kind,geometry:'no_geometry',candidates:[],record};
  return {id,input:{dialogue:null,script:null},rows:[row],problems:[],query:(filter:{offset?:number}={})=>filter.offset===undefined||filter.offset===8?[row]:[]};
 };
 it('keeps shared offsets scoped by Field and returns only matched branch kinds',()=>{
  const scoped=(text:string)=>parseEvidenceQuery(text) as Extract<EvidenceQuery,{type:'field'}>;
  expect(findFieldEvidence(field(1,'IFUB'),scoped('field:1 if:8')).map(row=>row.kind)).toEqual(['IFUB']);
  expect(findFieldEvidence(field(2,'BGOFF'),scoped('field:2 if:8'))).toEqual([]);
  expect(findFieldEvidence(field(2,'BGOFF'),scoped('field:2 instruction:8')).map(row=>row.kind)).toEqual(['BGOFF']);
  expect(verifiedFieldOwners(field(2,'BGOFF'))).toEqual([owner]);
 });
 it('links only static literal acquisitions to the appropriate dictionary',()=>{
  const record={id:'x',kind:'item',opcode:88,status:'static',operands:[{name:'item',kind:'literal',bank:0,value:0}]} as GameplayRecord;
  expect(literalAcquisition(record)).toEqual({kind:'item',id:0});
  expect(literalAcquisition({...record,opcode:91})).toBeNull();
  expect(literalAcquisition({...record,operands:[{...record.operands[0],kind:'variable',bank:1}]})).toBeNull();
  const index={records:new Map([['x',{record}]]),pack:{links:{fieldBattles:[{formationId:0,recordId:'battle'}]}}} as unknown as GameplayIndex;
  const result=gameplayDiscovery(index);
  expect(result.acquisitions.get('item:0')).toEqual(['x']);
  expect(result.acquisitions.has('materia:0')).toBe(false);
  expect(result.battles.get(0)).toEqual(['battle']);
 });
 it('keeps private navigation context until an explicit public opening',()=>{
  beginPublicNavigation();
  expect(browsingEvidence()).toBe(false);
  beginEvidenceNavigation();
  expect(browsingEvidence()).toBe(true);
  expect(evidenceStoryVisible('hide-major')).toBe(false);
  expect(evidenceStoryVisible('hide-all')).toBe(false);
  expect(evidenceStoryVisible('show-all')).toBe(true);
  beginPublicNavigation();
  expect(browsingEvidence()).toBe(false);
 });
});
