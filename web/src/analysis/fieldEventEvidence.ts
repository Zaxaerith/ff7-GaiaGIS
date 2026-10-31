// SPDX-License-Identifier: GPL-3.0-only
import {gatewayRelation,WalkmeshNetwork} from '../data/fieldContext';
import type {FieldIndex,FieldWalkmesh} from '../data/fieldContext';
import type {InteractionScene,InteractionRecord,InteractionOwner} from '../data/fieldInteraction';
import {SCRIPT_OPCODES} from '../data/fieldScriptEvidence';
import type {ScriptEvidenceScene,ScriptEvidenceRecord} from '../data/fieldScriptEvidence';
import type {GameplayRecord,GameplayResource} from '../data/gameplay';

export interface EventAsset<T>{scene:T;sha256:string;sources:Record<string,string>;}
export interface FieldEventInput {
 fields:FieldIndex;fieldId:number;contextSHA256:string;walkmeshSHA256:string;meshSHA256:string;generation:number;mesh:FieldWalkmesh;
 interaction?:EventAsset<InteractionScene>|null;script?:EventAsset<ScriptEvidenceScene>|null;gameplay?:GameplayResource|null;
}
export interface FieldEventRow {
 key:string;channel:'interaction'|'script'|'gameplay';kind:string;section:1|8;offset:number;owners:readonly InteractionOwner[];
 geometry:'surface'|'xy_only'|'disjoint'|'variable'|'no_geometry'|'unknown';candidates:readonly number[];
 record:InteractionRecord|ScriptEvidenceRecord|GameplayRecord;
}
export interface FieldEventFilter {channel?:string;kind?:string;actor?:number;slot?:number;entry?:number;offset?:number;geometry?:string;triangle?:number;}
export const eventOwnerKey=(o:InteractionOwner)=>`${o.actor}/${o.kind}/${o.slot}/${o.entry}`;
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
/** Per-scene read-only adapter. Raw records and their position/flag claims stay untouched. */
export function createFieldEventIndex(input:FieldEventInput){
 const {fields,fieldId,mesh}=input,node=fields.nodes.get(fieldId),sources=fields.pack.sources;
 if(!node||node.status!=='available'||![input.contextSHA256,input.walkmeshSHA256,input.meshSHA256].every(hash)||!Number.isSafeInteger(input.generation)||input.generation<0)throw Error('Field event source identity');
 const rows:FieldEventRow[]=[],problems:string[]=[],actors=new Map<number,Set<FieldEventRow>>(),contacts=new Map<number,FieldEventRow[]>();
 let section1:string|null=null,section8:string|null=null;
 const sameSources=(s:Record<string,string>)=>[fields.pack.archive,'maplist'].every(k=>hash(s[k])&&s[k]===sources[k]);
 const sceneIdentity=(s:{fieldId:number;name:string;section1SHA256:string|null})=>s.fieldId===fieldId&&s.name===node.name&&hash(s.section1SHA256);
 const push=(r:FieldEventRow)=>{rows.push(r);for(const actor of new Set(r.owners.map(o=>o.actor))){let set=actors.get(actor);if(!set)actors.set(actor,set=new Set());set.add(r);}for(const id of r.candidates){const list=contacts.get(id)??[];list.push(r);contacts.set(id,list);}};
 const interaction=input.interaction;
 if(interaction){const s=interaction.scene;let valid=hash(interaction.sha256)&&sameSources(interaction.sources)&&sceneIdentity(s)&&hash(s.section8SHA256)&&s.section5SHA256===input.meshSHA256&&s.triangles===mesh.triangles;
  // Reuse the exact predicate once per scene; filtering never recomputes contacts.
  if(valid)for(const r of s.records)if(r.geometry&&r.a&&r.b){const candidates:number[]=[],relation=gatewayRelation(mesh,r.a,r.b,candidates);if(relation!==r.geometry.relation||candidates.join(',')!==r.geometry.candidates.join(',')){valid=false;break;}}
  if(!valid)problems.push('interaction');else{section1=s.section1SHA256;section8=s.section8SHA256;for(const r of s.records)push({key:'interaction:'+r.key,channel:'interaction',kind:r.kind,section:r.kind==='trigger'?8:1,offset:r.offset,owners:r.owners??[],geometry:r.geometry?.relation??(r.kind==='sline'&&!r.static?'variable':'no_geometry'),candidates:r.geometry?.relation==='surface'?[...r.geometry.candidates]:[],record:r});}
 }
 const script=input.script;
 if(script){const s=script.scene;if(!hash(script.sha256)||!sameSources(script.sources)||!sceneIdentity(s)||!hash(s.section8SHA256)||section1!==null&&section1!==s.section1SHA256||section8!==null&&section8!==s.section8SHA256)problems.push('script');
  else{section1=s.section1SHA256;section8=s.section8SHA256;for(const r of s.records)push({key:'script:'+r.offset,channel:'script',kind:SCRIPT_OPCODES[r.opcode].name,section:1,offset:r.offset,owners:r.owners.map(id=>s.entries[id]),geometry:'no_geometry',candidates:[],record:r});}
 }
 const gameplay=input.gameplay,s=gameplay?.index.scenes.get(fieldId);
 if(gameplay){if(!hash(gameplay.sha256)||gameplay.generation!==input.generation||gameplay.contextSHA256!==input.contextSHA256||!sameSources(gameplay.index.pack.sources)||!s||!sceneIdentity(s)||section1!==null&&s.section1SHA256!==section1)problems.push('gameplay');
  else{section1=s.section1SHA256;for(const r of s.records)push({key:'gameplay:'+r.id,channel:'gameplay',kind:r.kind,section:1,offset:r.offset,owners:r.owners,geometry:'no_geometry',candidates:[],record:r});}
 }
 rows.sort((a,b)=>a.section-b.section||a.offset-b.offset||a.channel.localeCompare(b.channel));
 return {input,rows,problems,section1SHA256:section1,section8SHA256:section8,
  query(f:FieldEventFilter={}){const source=f.triangle===undefined?rows:contacts.get(f.triangle)??[];return source.filter(r=>(!f.channel||r.channel===f.channel)&&(!f.kind||r.kind===f.kind)&&(f.offset===undefined||r.offset===f.offset)&&(!f.geometry||r.geometry===f.geometry)&&([f.actor,f.slot,f.entry].every(v=>v===undefined)||r.owners.some(o=>(f.actor===undefined||o.actor===f.actor)&&(f.slot===undefined||o.slot===f.slot)&&(f.entry===undefined||o.entry===f.entry))));},
  relations(row:FieldEventRow){const same=new Set(row.owners.map(eventOwnerKey)),related=new Set(row.owners.flatMap(o=>[...actors.get(o.actor)??[]]));return rows.filter(r=>r!==row&&related.has(r)).map(r=>({row:r,relation:r.owners.some(o=>same.has(eventOwnerKey(o)))?'same_entry' as const:'same_actor' as const}));},
 };
}
export type FieldEventIndex=ReturnType<typeof createFieldEventIndex>;
/** Select a shortest-hop witness, then original Triangle ID. No coordinate/Actor inference. */
export function fieldEventPath(row:FieldEventRow,network:WalkmeshNetwork,start:number){
 if(row.geometry!=='surface'||!row.candidates.length)return {status:'no_geometry' as const,reachable:[],unreachable:[],path:null};
 const reach=network.reach(start),reachable=row.candidates.filter(id=>reach.distance[id]>=0),unreachable=row.candidates.filter(id=>reach.distance[id]<0);
 const candidates=[...reachable].sort((a,b)=>reach.distance[a]-reach.distance[b]||a-b);
 for(const end of candidates){const path=network.path(start,end);if(!path.steps.some(e=>e.mismatch))return {status:'connected' as const,reachable,unreachable,path};}
 return {status:reachable.length?'access_mismatch' as const:'not_connected' as const,reachable,unreachable,path:null};
}
