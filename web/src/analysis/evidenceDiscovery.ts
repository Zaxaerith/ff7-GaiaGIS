// SPDX-License-Identifier: GPL-3.0-only
import {nearName} from '../data/nameSearch';
import type {EncounterResource} from '../data/encounters';
import type {GameplayIndex,GameplayRecord} from '../data/gameplay';
import {validateEncounterRelations} from './encounterGeography';
import type {FieldEventIndex,FieldEventInput,FieldEventRow} from './fieldEventEvidence';

export const evidencePageSize=50,evidenceResultLimit=500;
export const evidenceCategories=['all','places','fields','gameplay','encounters','scripts'] as const;
export type EvidenceCategory=typeof evidenceCategories[number];
type LocalKind='triangle'|'gateway'|'line'|'trigger'|'instruction'|'event'|'dialogue'|'if'|'ask'|'req'|'text'|'actor'|'slot'|'entry';
type GlobalKind='location'|'atlas'|'entrance'|'face'|'item'|'materia'|'formation'|'enemy'|'set';
type AliasFilter={actor?:number;slot?:number;entry?:number;ownerKind?:'main'|'table'};
export type EvidenceQuery=
 |{type:'name';name:string}
 |{type:'global';kind:GlobalKind;id:string}
 |{type:'field';field:string;key?:{kind:LocalKind;id:number};aliases:AliasFilter}
 |{type:'error';reason:'syntax'|'scope'|'enemy'|'limit'|'category'};
export type FieldEvidenceKey=
 |{kind:'triangle'|'gateway';id:number}
 |{kind:'row';key:string}
 |{kind:'instruction';offset:number;opcode:number}
 |{kind:'owner';actor?:number;entry?:number;slot?:number;ownerKind?:'main'|'table'};
export type EvidenceTarget=
 |{kind:'navigation';key:string}
 |{[K in 'entrance'|'location'|'atlas'|'set'|'enemy']:{kind:K;id:string}}['entrance'|'location'|'atlas'|'set'|'enemy']
 |{[K in 'face'|'item'|'materia'|'formation']:{kind:K;id:number}}['face'|'item'|'materia'|'formation']
 |{kind:'field';id:number;record?:FieldEvidenceKey};

const local=new Set<string>(['triangle','gateway','line','trigger','instruction','event','dialogue','if','ask','req','text','actor','slot','entry']);
const global=new Set<string>(['location','atlas','entrance','face','item','materia','formation','enemy','set']);
const numeric=(value:string)=>/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)<=0xffffffff;
const canonicalNumber=(value:string)=>String(Number(value));
const identity=(value:string)=>/^[a-zA-Z0-9_.-]+$/.test(value);

export function parseEvidenceQuery(raw:string):EvidenceQuery {
 const value=raw.trim();
 if([...value].length>256)return {type:'error',reason:'limit'};
 if(!value.includes(':'))return /^\d+$/.test(value)?{type:'error',reason:'category'}:{type:'name',name:value};
 const tokens=value.split(/\s+/);
 if(tokens.length>8)return {type:'error',reason:'limit'};
 const terms=new Map<string,string>();
 for(const token of tokens){
  const [,key,id]=/^([a-z]+):(.+)$/i.exec(token)??[];
  if(!key||terms.has(key.toLowerCase()))return {type:'error',reason:'syntax'};
  terms.set(key.toLowerCase(),id);
 }
 const field=terms.get('field');
 if(field===undefined){
  const [kind,id]=[...terms][0];
  if([...terms.keys()].some(k=>local.has(k)||k==='kind'))return {type:'error',reason:'scope'};
  if(terms.size!==1||!global.has(kind))return {type:'error',reason:'syntax'};
  if(kind==='enemy'||kind==='set'){
   const separator=kind==='enemy'?'/':':',parts=id.split(separator);
   if(parts.length!==2||!parts.every(numeric))return {type:'error',reason:kind==='enemy'?'enemy':'syntax'};
   return {type:'global',kind,id:parts.map(canonicalNumber).join(separator)};
  }
  if(['location','entrance','atlas'].includes(kind))return identity(id)?{type:'global',kind:kind as GlobalKind,id}:{type:'error',reason:'syntax'};
  return numeric(id)?{type:'global',kind:kind as GlobalKind,id:canonicalNumber(id)}:{type:'error',reason:'syntax'};
 }
 if(!identity(field)||/^\d+$/.test(field)&&!numeric(field))return {type:'error',reason:'syntax'};
 const aliases:AliasFilter={};let key:Extract<EvidenceQuery,{type:'field'}>['key'];
 for(const [name,id]of terms){
  if(name==='field')continue;
  if(name==='kind'&&(id==='main'||id==='table')){aliases.ownerKind=id;continue;}
  if(!local.has(name)||!numeric(id)||name==='text'&&Number(id)>255||name==='slot'&&Number(id)>31)return {type:'error',reason:'syntax'};
  if(name==='actor'||name==='slot'||name==='entry'){aliases[name]=Number(id);continue;}
  if(key)return {type:'error',reason:'syntax'};
  key={kind:name as LocalKind,id:Number(id)};
 }
 if((key?.kind==='triangle'||key?.kind==='gateway'||key?.kind==='trigger')&&Object.keys(aliases).length)return {type:'error',reason:'syntax'};
 return {type:'field',field:/^\d+$/.test(field)?canonicalNumber(field):field.toLowerCase(),key,aliases};
}

const normalize=(s:string)=>s.normalize('NFKD').replace(/\p{M}/gu,'').replace(/[↔<>\s_-]+/g,' ').trim().toLowerCase();
export const evidenceTerms=(terms:readonly string[])=>terms.map(normalize);
export function evidenceRank(query:string,internal:string,terms:readonly string[]){
 const q=normalize(query);
 if(!q)return 0;
 if(internal&&normalize(internal)===q)return 0;
 if(terms.includes(q))return 1;
 if(terms.some(term=>term.startsWith(q)))return 2;
 if(terms.some(term=>term.includes(q)))return 3;
 return terms.some(term=>nearName(q,term))?4:Infinity;
}

export function literalAcquisition(record:GameplayRecord){
 const kind=record.kind;
 if(record.status!=='static'||!(kind==='item'&&record.opcode===88||kind==='materia'&&record.opcode===91))return null;
 const operand=record.operands.find(value=>value.name===kind&&value.kind==='literal'&&value.bank===0);
 return operand?{kind:kind as 'item'|'materia',id:operand.value}:null;
}

export function gameplayDiscovery(index:GameplayIndex){
 const acquisitions=new Map<string,string[]>(),battles=new Map<number,string[]>();
 for(const {record}of index.records.values()){
  const item=literalAcquisition(record);
  if(item)append(acquisitions,item.kind+':'+item.id,record.id);
 }
 for(const link of index.pack.links.fieldBattles){
  if(link.formationId!==null&&link.recordId)append(battles,link.formationId,link.recordId);
 }
 return {acquisitions,battles};
}
function append<K>(map:Map<K,string[]>,key:K,id:string){
 const list=map.get(key);
 if(list)list.push(id);
 else map.set(key,[id]);
}

export function encounterDiscovery(resource:EncounterResource,index:GameplayIndex|null){
 const relations=validateEncounterRelations(resource,index);
 return {relations,sets:new Map(resource.data.encounter_sets.map(set=>[set.id,set]))};
}

export function findFieldEvidence(index:Pick<FieldEventIndex,'rows'|'query'>,query:Extract<EvidenceQuery,{type:'field'}>){
 const {key,aliases}=query;
 if(!key)return index.query(aliases);
 const {kind,id}=key;
 if(kind==='triangle')return index.query({triangle:id});
 if(kind==='text')return index.query({...aliases,textId:id});
 if(kind==='trigger')return index.rows.filter(row=>row.channel==='interaction'&&row.kind==='trigger'&&'key' in row.record&&row.record.key==='trigger:'+id);
 return index.query({...aliases,offset:id}).filter(row=>matchesFieldKind(kind,row));
}
export function verifiedFieldOwners(index:Pick<FieldEventIndex,'rows'|'problems'>&{input:Pick<FieldEventInput,'dialogue'|'script'>}){
 const owners=new Map<string,FieldEventRow['owners'][number]>();
 const {dialogue,script}=index.input;
 const rows=index.rows.flatMap(row=>row.owners);
 if(dialogue&&!index.problems.includes('dialogue'))rows.push(...dialogue.scene.entries);
 if(script&&!index.problems.includes('script'))rows.push(...script.scene.entries);
 for(const row of rows)owners.set([row.actor,row.kind,row.slot,row.entry].join('/'),row);
 return [...owners.values()];
}
function matchesFieldKind(kind:LocalKind,row:FieldEventRow){
 switch(kind){
  case 'line':return row.channel==='interaction'&&['line','sline','linon'].includes(row.kind);
  case 'if':return row.channel==='condition';
  case 'ask':return row.channel==='dialogue'&&row.kind==='ASK';
  case 'req':return row.channel==='request';
  case 'event':return row.channel==='gameplay';
  case 'dialogue':return row.channel==='dialogue';
  case 'instruction':return row.section===1;
  default:return false;
 }
}
