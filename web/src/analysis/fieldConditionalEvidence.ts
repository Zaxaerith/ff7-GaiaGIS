// SPDX-License-Identifier: GPL-3.0-only
import {CMUSC8_CFG,fieldDecoder,checkCFG} from '../data/fieldProvenance';
import type {FieldEventInput} from './fieldEventEvidence';
import type {DialogueRecord,DialogueScene} from '../data/fieldDialogue';
import type {GameplayRecord,GameplayScene} from '../data/gameplay';
import type {InteractionOwner} from '../data/fieldInteraction';

/** Static, current-Field evidence only. No condition values, scheduling or positions. */
export const FIELD_CONDITIONAL_REVISION='field-conditional-1';
export const CONDITIONAL_LIMITS=Object.freeze({maxRootNodes:8192,maxTotalVisits:8_000_000,maxBitsetBytes:32*1024*1024,maxRelations:100_000,maxOperations:100_000_000});
export interface ConditionalOptions {
 maxRootNodes?:number;maxTotalVisits?:number;maxBitsetBytes?:number;maxRelations?:number;maxOperations?:number;
 signal?:AbortSignal;/** Useful to cooperative callers; worker cancellation terminates the worker. */shouldAbort?:()=>boolean;
}
export interface ConditionalIdentity {
 analysisRevision:string;decoder:typeof CMUSC8_CFG;generation:number;fieldId:number;fieldName:string;
 contextSHA256:string;dialogueSHA256:string;gameplaySHA256:string|null;memberSHA256:string;
 section1SHA256:string;section5SHA256:string|null;section8SHA256:string;
}
export interface ConditionalRoot {entry:number;aliases:InteractionOwner[];status:'accepted'|'rejected';reason:string|null;nodes:number;edges:number;}
export type ConditionalEventKind='MESSAGE'|'ASK'|'STITM'|'SMTRA'|'BATTLE'|'REQ'|'REQSW'|'REQEW';
export interface ConditionalEvent {key:string;offset:number;opcode:number;kind:ConditionalEventKind;owners:InteractionOwner[];owningRoots:number[];entryReachable:boolean;}
export interface ConditionalControl {
 root:number;ifOffset:number;successor:number;successors:[number,number];targetOffset:number;
 standard:true;strong:boolean;core:boolean;
 basis:{targetPostdominatesSuccessor:true;targetPostdominatesIf:false;ifDominatesTarget:boolean};
}
export interface ConditionalAskLink {
 root:number;askOffset:number;ifOffset:number;bank:number;address:number;width:number;
 status:'local'|'candidate';reason:string|null;/** Complete strict interior of all ASK-to-IF paths; never an offset interval. */corridor:number[];
}
export interface ConditionalRequestLink {
 sourceOffset:number;opcode:number;priority:number;sourceOwners:InteractionOwner[];targetActor:number;slot:number;
 targetEntry:number|null;status:'resolved'|'missing'|'ambiguous';targetEventOffsets:number[];
}
export interface ConditionalStats {
 complete:boolean;nodes:number;edges:number;rawRoots:number;aliases:number;acceptedRoots:number;rejectedRoots:number;
 qualifiedRoots:number;cyclicRoots:number;rootVisits:number;maxRootNodes:number;peakBitsetBytes:number;operations:number;relations:number;
 standardRelations:number;strongRelations:number;coreRelations:number;coreEvents:number;
 eventCounts:Record<string,number>;ifCounts:Record<string,number>;qualifiedIfs:number;
 askCandidates:number;askLocalPairs:number;requestCount:number;requestTargets:number;requestEventPairs:number;
}
export interface ConditionalResult {
 status:'complete'|'unavailable'|'limited'|'cancelled';complete:boolean;identity:ConditionalIdentity|null;problems:string[];
 roots:ConditionalRoot[];events:ConditionalEvent[];controls:ConditionalControl[];askLinks:ConditionalAskLink[];requestLinks:ConditionalRequestLink[];stats:ConditionalStats;
}
type SceneMetadata=Omit<DialogueScene,'textTable'>;
type SourceHeader={sha256:string;contextSHA256?:string;generation?:number;sources:Record<string,string>;decoder?:string};
interface RelatedHeader extends SourceHeader {
 kind:'interaction'|'script';fieldId:number;name:string;section1SHA256:string;section8SHA256:string;section5SHA256?:string|null;
 section1Bytes:number;entries?:InteractionOwner[];owners?:InteractionOwner[];
}
/** Only the selected scene and source metadata cross the worker boundary. No textTable, mesh, global Gameplay index or global item/enemy name tables. */
export interface FieldConditionalInput {
 fieldId:number;generation:number;contextSHA256:string;
 context:{version:number;scriptDecoder?:typeof CMUSC8_CFG|'legacy-stop';archive:string;sources:Record<string,string>};
 node:{id:number;name:string;status:string}|null;meshSection5SHA256:string|null;
 dialogue:(SourceHeader&{scene:SceneMetadata})|null;
 gameplay:(SourceHeader&{version:number;generator_revision:string;scene:GameplayScene|null})|null;
 related:RelatedHeader[];
}
const ownerCopy=(o:InteractionOwner):InteractionOwner=>({actor:o.actor,name:o.name,slot:o.slot,entry:o.entry,kind:o.kind});
const ownerKey=(o:InteractionOwner)=>[o.actor,o.kind,o.slot,o.entry,o.name].join('/');
const sourceCopy=(s:Record<string,string>)=>Object.fromEntries(Object.entries(s));
/** Projection deliberately enumerates fields instead of spreading an asset (which could carry private text). */
export function toFieldConditionalInput(input:FieldEventInput):FieldConditionalInput {
 const p=input.fields.pack,node=input.fields.nodes.get(input.fieldId),d=input.dialogue,g=input.gameplay,gs=g?.index.scenes.get(input.fieldId),related:RelatedHeader[]=[];
 const a=input.interaction;
 if(a)related.push({kind:'interaction',sha256:a.sha256,contextSHA256:a.contextSHA256,decoder:a.decoder,sources:sourceCopy(a.sources),fieldId:a.scene.fieldId,name:a.scene.name,section1SHA256:a.scene.section1SHA256,section8SHA256:a.scene.section8SHA256,section5SHA256:a.scene.section5SHA256,section1Bytes:a.scene.section1Bytes,owners:a.scene.records.flatMap(r=>(r.owners??[]).map(ownerCopy))});
 const s=input.script;
 if(s)related.push({kind:'script',sha256:s.sha256,contextSHA256:s.contextSHA256,decoder:s.decoder,sources:sourceCopy(s.sources),fieldId:s.scene.fieldId,name:s.scene.name,section1SHA256:s.scene.section1SHA256,section8SHA256:s.scene.section8SHA256,section1Bytes:s.scene.section1Bytes,entries:s.scene.entries.map(ownerCopy)});
 return {fieldId:input.fieldId,generation:input.generation,contextSHA256:input.contextSHA256,context:{version:p.version,scriptDecoder:p.scriptDecoder,archive:p.archive,sources:sourceCopy(p.sources)},node:node?{id:node.id,name:node.name,status:node.status}:null,meshSection5SHA256:input.mesh===null?null:input.meshSHA256,
  dialogue:d?{sha256:d.sha256,contextSHA256:d.contextSHA256,generation:d.generation,sources:sourceCopy(d.sources),scene:{fieldId:d.scene.fieldId,name:d.scene.name,memberSHA256:d.scene.memberSHA256,section1SHA256:d.scene.section1SHA256,section5SHA256:d.scene.section5SHA256,section8SHA256:d.scene.section8SHA256,section1Bytes:d.scene.section1Bytes,status:d.scene.status,codeStart:d.scene.codeStart,codeEnd:d.scene.codeEnd,uncoveredBytes:d.scene.uncoveredBytes,entries:d.scene.entries.map(ownerCopy),cfg:d.scene.cfg.map(r=>r.slice()),records:d.scene.records.map(r=>({offset:r.offset,opcode:r.opcode,raw:r.raw,entryReachable:r.entryReachable,owners:r.owners.slice()})),stops:d.scene.stops.map(r=>({offset:r.offset,opcode:r.opcode,reason:r.reason,entryReachable:r.entryReachable}))}}:null,
  gameplay:g?{sha256:g.sha256,contextSHA256:g.contextSHA256,generation:g.generation,sources:sourceCopy(g.index.pack.sources),decoder:g.index.pack.decoder,version:g.index.pack.version,generator_revision:g.index.pack.generator_revision,scene:gs?{fieldId:gs.fieldId,name:gs.name,status:gs.status,memberSHA256:gs.memberSHA256,section1SHA256:gs.section1SHA256,section1Bytes:gs.section1Bytes,reason:gs.reason,records:gs.records.map(r=>({id:r.id,kind:r.kind,offset:r.offset,opcode:r.opcode,raw:r.raw,owners:r.owners.map(ownerCopy),operands:r.operands.map(o=>({name:o.name,kind:o.kind,bank:o.bank,value:o.value})),status:r.status,position:r.position,flagLinks:r.flagLinks.slice()})),stops:gs.stops.map(r=>({offset:r.offset,opcode:r.opcode,reason:r.reason,entryReachable:r.entryReachable}))}:null}:null,related};
}
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const int=(v:unknown,min=0,max=65535):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
class EvidenceFailure extends Error {constructor(readonly status:ConditionalResult['status'],readonly code:string){super(code);}}
function need(condition:unknown,code:string):asserts condition {if(!condition)throw new EvidenceFailure('unavailable',code);}
const kinds:Readonly<Record<number,ConditionalEventKind>>={1:'REQ',2:'REQSW',3:'REQEW',64:'MESSAGE',72:'ASK',88:'STITM',91:'SMTRA',112:'BATTLE'};
const dialogueWidths:Readonly<Record<number,number>>={1:3,2:3,3:3,20:6,21:7,22:8,23:9,24:8,25:9,64:3,72:7};
const gameplayWidths:Readonly<Record<number,number>>={88:5,91:7,112:4,128:4,130:4,131:4};
// Same reviewed decoder boundary widths; variable SPECIAL/KAWAI are checked separately.
const widths=[1,3,3,3,3,3,3,2,2,15,6,6,0,0,2,1,2,3,2,3,6,7,8,9,8,9,0,0,0,0,0,0,11,2,5,3,3,9,2,2,1,1,2,2,5,7,2,10,4,4,4,2,2,4,5,8,6,6,6,4,1,1,1,1,3,5,6,2,0,5,0,5,7,4,2,2,0,5,0,5,10,6,4,2,2,3,7,7,5,5,5,7,8,10,8,1,10,2,5,6,6,1,9,1,9,2,7,9,1,4,3,6,4,2,3,4,4,8,4,5,4,5,3,3,3,3,2,3,4,5,4,4,4,4,5,4,5,4,5,4,5,4,5,4,5,4,5,4,5,3,3,3,3,3,4,5,6,7,7,11,2,2,3,3,2,11,9,9,6,6,2,4,1,6,3,3,5,5,4,3,6,6,2,4,5,4,3,5,5,4,0,2,11,8,15,12,1,3,3,2,2,2,4,3,3,3,2,2,13,2,2,16,10,10,4,4,3,1,15,2,4,1,1,11,4,4,3,3,3,5,5,5,7,10,10,5,5,8,8,11,2,5,14,2,2,2,2,4,2,1,3,2,2,8,3,1];
const terminal=new Set([0,7,96,255]),branch=new Set([20,21,22,23,24,25,48,49,50,203,204]),jump=new Set([16,17,18,19]);
function rawBytes(raw:string,width:number,opcode:number):number[]{need(typeof raw==='string'&&raw.length===width*2&&/^[a-f0-9]+$/.test(raw),'record_bytes');const out=Array.from({length:width},(_,i)=>parseInt(raw.slice(i*2,i*2+2),16));need(out[0]===opcode,'record_opcode');return out;}
const word=(b:number[],at:number)=>b[at]|b[at+1]<<8;
function ifReads(r:DialogueRecord){const b=rawBytes(r.raw,dialogueWidths[r.opcode],r.opcode),width=r.opcode<=21?1:2;return [{bank:b[1]>>4,address:width===1?b[2]:word(b,2),width},{bank:b[1]&15,address:width===1?b[3]:word(b,4),width}];}
function ifSuccessors(r:DialogueRecord,end:number){const b=rawBytes(r.raw,dialogueWidths[r.opcode],r.opcode),at=r.opcode<=21?5:7;return [...new Set([r.offset+at+(r.opcode%2?word(b,at):b[at]),...(r.offset+b.length<end?[r.offset+b.length]:[])])].sort((a,b)=>a-b);}
function gameplayOperands(b:number[]){const out:{name:string;kind:'variable'|'literal';bank:number;value:number}[]=[],add=(name:string,at:number,size:number,bank:number,target=false)=>out.push({name,kind:bank||target?'variable':'literal',bank,value:size===1?b[at]:word(b,at)}),a=b[1]>>4,c=b[1]&15;
 if(b[0]===88){add('item',2,2,a);add('quantity',4,1,c);}else if(b[0]===91){add('materia',3,1,a);add('ap0',4,1,c);add('ap1',5,1,b[2]>>4);add('ap2',6,1,b[2]&15);}else if(b[0]===112)add('formation',2,2,c);else{add('target',2,1,a,true);add(b[0]===128?'value':'bit',3,1,c);}return out;
}
function stats():ConditionalStats{return {complete:false,nodes:0,edges:0,rawRoots:0,aliases:0,acceptedRoots:0,rejectedRoots:0,qualifiedRoots:0,cyclicRoots:0,rootVisits:0,maxRootNodes:0,peakBitsetBytes:0,operations:0,relations:0,standardRelations:0,strongRelations:0,coreRelations:0,coreEvents:0,eventCounts:{},ifCounts:{},qualifiedIfs:0,askCandidates:0,askLocalPairs:0,requestCount:0,requestTargets:0,requestEventPairs:0};}
function emptyResult():ConditionalResult{return {status:'unavailable',complete:false,identity:null,problems:[],roots:[],events:[],controls:[],askLinks:[],requestLinks:[],stats:stats()};}
interface Prepared {
 scene:SceneMetadata;nodes:Map<number,number[]>;records:Map<number,DialogueRecord>;gameplay:Map<number,GameplayRecord>;
 aliases:Map<number,InteractionOwner[]>;roots:Map<number,number[]>;reachable:Set<number>;events:ConditionalEvent[];
}
function runBudget(result:ConditionalResult,options:ConditionalOptions){
 const limits:Record<keyof typeof CONDITIONAL_LIMITS,number>={...CONDITIONAL_LIMITS};
 for(const key of Object.keys(limits) as (keyof typeof limits)[]){const n=options[key];if(n!==undefined){need(int(n,0,limits[key]),'invalid_budget');limits[key]=n;}}
 const check=()=>{if(options.signal?.aborted||options.shouldAbort?.())throw new EvidenceFailure('cancelled','cancelled');};
 const tick=(n=1)=>{check();result.stats.operations+=n;if(result.stats.operations>limits.maxOperations)throw new EvidenceFailure('limited','operation_limit');};
 const output=(n=1)=>{tick(n);result.stats.relations+=n;if(result.stats.relations>limits.maxRelations)throw new EvidenceFailure('limited','relation_limit');};
 return {limits,check,tick,output};
}
type Budget=ReturnType<typeof runBudget>;
function validateIdentity(input:FieldConditionalInput,result:ConditionalResult){
 const c=input.context,d=input.dialogue,n=input.node;
 need(c&&int(c.version,6,65535),'legacy_context');
 need(c.archive==='flevel.lgp'&&fieldDecoder(c)===CMUSC8_CFG,'decoder');
 need(int(input.fieldId)&&int(input.generation,0,Number.MAX_SAFE_INTEGER)&&hash(input.contextSHA256),'context_identity');
 need(n&&n.id===input.fieldId&&n.status==='available'&&typeof n.name==='string','field_identity');
 need(d,'missing_dialogue');
 const sources=(s:Record<string,string>)=>!!s&&Object.entries(s).every(([k,v])=>hash(v)&&(!(k in c.sources)||v===c.sources[k]))&&[c.archive,'maplist'].every(k=>s[k]===c.sources[k]&&hash(s[k]));
 const header=(h:SourceHeader)=>hash(h.sha256)&&h.contextSHA256===input.contextSHA256&&sources(h.sources);
 need(header(d)&&d.generation===input.generation,'dialogue_identity');
 const s=d.scene;
 need(s&&s.fieldId===input.fieldId&&s.name===n.name&&[s.memberSHA256,s.section1SHA256,s.section8SHA256].every(hash)&&(s.section5SHA256===null||hash(s.section5SHA256)),'dialogue_sections');
 need(input.meshSection5SHA256===null||hash(input.meshSection5SHA256)&&input.meshSection5SHA256===s.section5SHA256,'mesh_section');
 if(input.gameplay){const g=input.gameplay,gs=g.scene;need(header(g)&&g.generation===input.generation,'gameplay_identity');checkCFG(g,'gameplay',c);need(gs&&gs.fieldId===input.fieldId&&gs.name===n.name&&gs.memberSHA256===s.memberSHA256&&gs.section1SHA256===s.section1SHA256&&gs.section1Bytes===s.section1Bytes,'gameplay_sections');}
 for(const h of input.related){need(header(h)&&h.decoder===CMUSC8_CFG&&h.fieldId===input.fieldId&&h.name===n.name&&h.section1SHA256===s.section1SHA256&&h.section8SHA256===s.section8SHA256&&h.section1Bytes===s.section1Bytes&&(h.kind!=='interaction'||h.section5SHA256===s.section5SHA256),'related_identity');}
 result.identity={analysisRevision:FIELD_CONDITIONAL_REVISION,decoder:CMUSC8_CFG,generation:input.generation,fieldId:input.fieldId,fieldName:n.name,contextSHA256:input.contextSHA256,dialogueSHA256:d.sha256,gameplaySHA256:input.gameplay?.sha256??null,memberSHA256:s.memberSHA256,section1SHA256:s.section1SHA256,section5SHA256:s.section5SHA256,section8SHA256:s.section8SHA256};
 return s;
}
function prepare(input:FieldConditionalInput,result:ConditionalResult,b:Budget):Prepared {
 b.check();const scene=validateIdentity(input,result),nodes=new Map<number,number[]>(),records=new Map<number,DialogueRecord>(),gameplay=new Map<number,GameplayRecord>(),aliases=new Map<number,InteractionOwner[]>(),roots=new Map<number,number[]>(),reachable=new Set<number>();
 need(int(scene.section1Bytes,32,8_000_000)&&int(scene.codeStart,32,65535)&&int(scene.codeEnd,scene.codeStart,Math.min(scene.section1Bytes,65535)),'code_bounds');
 need(Array.isArray(scene.cfg)&&scene.cfg.length<=65535&&Array.isArray(scene.entries)&&scene.entries.length<=2112&&Array.isArray(scene.records)&&scene.records.length<=16384&&Array.isArray(scene.stops)&&scene.stops.length<=4096,'scene_limits');
 const validOwner=(o:InteractionOwner)=>o&&int(o.actor,0,63)&&int(o.slot,0,31)&&int(o.entry,scene.codeStart,scene.codeEnd-1)&&(o.kind==='table'||o.kind==='main'&&o.slot===0)&&(o.name===null||typeof o.name==='string'&&/^[\x20-\x7e]{0,8}$/.test(o.name));
 const keys=new Set<string>(),owners=new Set<string>();
 for(const o of scene.entries){b.tick();need(validOwner(o),'entry_identity');const key=o.actor+'/'+o.kind+'/'+o.slot;need(!keys.has(key),'duplicate_entry');keys.add(key);owners.add(ownerKey(o));const a=aliases.get(o.entry)??[];a.push(ownerCopy(o));aliases.set(o.entry,a);}
 for(const h of input.related){for(const o of h.owners??[]){b.tick();need(owners.has(ownerKey(o)),'related_owner');}if(h.entries){need(h.entries.length===scene.entries.length,'related_entries');const found=new Set(h.entries.map(ownerKey));need(found.size===owners.size&&[...owners].every(k=>found.has(k)),'related_entries');}}
 let end=scene.codeStart,total=0;
 for(const row of scene.cfg){b.tick();need(Array.isArray(row)&&row.length>=4&&row.length<=6&&int(row[0],end,scene.codeEnd-1)&&int(row[1],1,scene.codeEnd-row[0])&&int(row[2],0,255)&&(row[3]===0||row[3]===1)&&new Set(row.slice(4)).size===row.length-4,'cfg_boundary');
  const op=row[2],size=row[1];need(op===15?[2,3,4,6].includes(size):op===40?size>=3:widths[op]>0&&size===widths[op],'cfg_width');
  need(row.slice(4).every(v=>int(v,scene.codeStart,scene.codeEnd-1)),'cfg_target');nodes.set(row[0],row);end=row[0]+size;total+=size;
 }
 need(int(scene.uncoveredBytes,0,scene.codeEnd-scene.codeStart)&&scene.uncoveredBytes===scene.codeEnd-scene.codeStart-total&&scene.status===((scene.stops.length||scene.uncoveredBytes)?'partial':'complete'),'cfg_coverage');
 const stopped=new Set<number>();
 for(const s of scene.stops){b.tick();need(int(s.offset,scene.codeStart,scene.codeEnd-1)&&int(s.opcode,0,255)&&['unsupported_opcode','unverified_boundary'].includes(s.reason)&&typeof s.entryReachable==='boolean'&&!stopped.has(s.offset)&&!nodes.has(s.offset),'stop_boundary');need(!scene.cfg.some(n=>{b.tick();return s.offset>=n[0]&&s.offset<n[0]+n[1];}),'stop_overlap');stopped.add(s.offset);}
 for(const row of scene.cfg)for(const target of row.slice(4)){b.tick();need(nodes.has(target)||stopped.has(target),'cfg_unknown_target');}
 let last=-1;
 for(const r of scene.records){b.tick();need(r.offset>last&&int(r.offset,scene.codeStart,scene.codeEnd-1)&&Object.hasOwn(dialogueWidths,r.opcode)&&typeof r.entryReachable==='boolean'&&Array.isArray(r.owners)&&r.owners.length<=scene.entries.length,'dialogue_record');last=r.offset;const bytes=rawBytes(r.raw,dialogueWidths[r.opcode],r.opcode),n=nodes.get(r.offset);need(n&&n[1]===bytes.length&&n[2]===r.opcode&&n[3]===Number(r.entryReachable),'dialogue_record_node');need(r.owners.every((id,i)=>int(id,0,scene.entries.length-1)&&(!i||id>r.owners[i-1]))&&r.entryReachable===!!r.owners.length,'dialogue_owners');
  if(r.opcode>=20&&r.opcode<=25&&r.entryReachable)need(n.slice(4).join(',')===ifSuccessors(r,scene.codeEnd).join(','),'if_successors');records.set(r.offset,r);
 }
 need(records.size===scene.cfg.filter(n=>Object.hasOwn(dialogueWidths,n[2])).length,'missing_dialogue_record');
 const gs=input.gameplay?.scene;
 need(gs||!scene.cfg.some(n=>n[3]===1&&Object.hasOwn(gameplayWidths,n[2])),'missing_gameplay');
 if(gs){need(Array.isArray(gs.records)&&gs.records.length<=4096&&['indexed','empty','partial','unavailable'].includes(gs.status)&&Array.isArray(gs.stops),'gameplay_records');
  for(const r of gs.records){b.tick();need(!gameplay.has(r.offset)&&r.id===input.fieldId+':'+r.offset&&Object.hasOwn(gameplayWidths,r.opcode),'gameplay_record');const bytes=rawBytes(r.raw,gameplayWidths[r.opcode],r.opcode),n=nodes.get(r.offset),expected=gameplayOperands(bytes);need(n&&n[1]===bytes.length&&n[2]===r.opcode&&n[3]===1,'gameplay_record_node');need(r.kind===({88:'item',91:'materia',112:'battle',128:'flag',130:'flag',131:'flag'} as Record<number,string>)[r.opcode]&&r.position===null&&Array.isArray(r.flagLinks)&&!r.flagLinks.length,'gameplay_record_claim');need(Array.isArray(r.operands)&&r.operands.length===expected.length&&expected.every((o,i)=>Object.entries(o).every(([k,v])=>v===r.operands[i][k as keyof typeof o])),'gameplay_operands');need(r.status==='unknown'||r.status==='static'&&gs.status==='indexed'&&!gs.stops.length&&r.kind!=='flag'&&expected.every(o=>o.kind==='literal'),'gameplay_status');need(Array.isArray(r.owners)&&r.owners.length>0&&r.owners.length<=2112&&r.owners.every(o=>validOwner(o)&&owners.has(ownerKey(o)))&&new Set(r.owners.map(ownerKey)).size===r.owners.length,'gameplay_owners');gameplay.set(r.offset,r);
  }
  need(gameplay.size===scene.cfg.filter(n=>n[3]===1&&Object.hasOwn(gameplayWidths,n[2])).length,'missing_gameplay_record');
 }
 const ownership=new Map<number,number[]>();
 for(const [entry] of aliases){const seen=new Set<number>([entry]),queue=[entry];for(const pc of queue){b.tick();if(++result.stats.rootVisits>b.limits.maxTotalVisits)throw new EvidenceFailure('limited','total_visit_limit');if(seen.size>b.limits.maxRootNodes)throw new EvidenceFailure('limited','root_node_limit');reachable.add(pc);const rs=ownership.get(pc)??[];rs.push(entry);ownership.set(pc,rs);for(const next of nodes.get(pc)?.slice(4)??[])if(!seen.has(next)){seen.add(next);queue.push(next);}}roots.set(entry,queue);result.stats.maxRootNodes=Math.max(result.stats.maxRootNodes,queue.length);}
 for(const n of scene.cfg){b.tick();need(n[3]===Number(reachable.has(n[0])),'cfg_reachability');}for(const s of scene.stops){b.tick();need(s.entryReachable===reachable.has(s.offset),'stop_reachability');}
 for(const r of records.values()){b.tick(r.owners.length+1);const expected=(ownership.get(r.offset)??[]).flatMap(root=>aliases.get(root)!).map(ownerKey).sort(),actual=r.owners.map(i=>ownerKey(scene.entries[i])).sort();need(expected.join('|')===actual.join('|'),'dialogue_owner_accounting');}
 for(const r of gameplay.values()){b.tick(r.owners.length+1);const expected=(ownership.get(r.offset)??[]).flatMap(root=>aliases.get(root)!).map(ownerKey).sort();need(expected.join('|')===r.owners.map(ownerKey).sort().join('|'),'gameplay_owner_accounting');}
 const events:ConditionalEvent[]=[];
 for(const r of records.values())if(Object.hasOwn(kinds,r.opcode))events.push({key:(r.opcode<=3?'request:':'dialogue:')+r.offset,offset:r.offset,opcode:r.opcode,kind:kinds[r.opcode],owners:r.owners.map(i=>ownerCopy(scene.entries[i])),owningRoots:ownership.get(r.offset)?.slice()??[],entryReachable:r.entryReachable});
 for(const r of gameplay.values())if(Object.hasOwn(kinds,r.opcode))events.push({key:'gameplay:'+r.id,offset:r.offset,opcode:r.opcode,kind:kinds[r.opcode],owners:r.owners.map(ownerCopy),owningRoots:ownership.get(r.offset)?.slice()??[],entryReachable:true});
 events.sort((a,c)=>a.offset-c.offset);result.events=events;
 result.stats.nodes=nodes.size;result.stats.edges=scene.cfg.reduce((n,r)=>n+r.length-4,0);result.stats.rawRoots=roots.size;result.stats.aliases=scene.entries.length;
 for(const r of records.values())if(r.opcode>=20&&r.opcode<=25){const key=['IFUB','IFUBL','IFSW','IFSWL','IFUW','IFUWL'][r.opcode-20];result.stats.ifCounts[key]=(result.stats.ifCounts[key]??0)+1;if(r.entryReachable&&nodes.get(r.offset)!.length===6)result.stats.qualifiedIfs++;}
 for(const r of events)if(r.entryReachable)result.stats.eventCounts[r.kind]=(result.stats.eventCounts[r.kind]??0)+1;
 return {scene,nodes,records,gameplay,aliases,roots,reachable,events};
}
interface RootGraph {offsets:number[];index:Map<number,number>;successors:number[][];predecessors:number[][];order:number[];reason:string|null;edges:number;}
function rootGraph(p:Prepared,offsets:number[],b:Budget):RootGraph {
 const index=new Map(offsets.map((pc,i)=>[pc,i])),successors:number[][]=offsets.map(()=>[]),predecessors:number[][]=offsets.map(()=>[]),order:number[]=[];
 let reason:string|null=null,edges=0;
 for(let i=0;i<offsets.length;i++){
  b.tick();const pc=offsets[i],n=p.nodes.get(pc);if(!n){reason??=p.scene.stops.some(s=>s.offset===pc)?'stop':'unknown_target';continue;}
  const next=n.slice(4);edges+=next.length;
  if(terminal.has(n[2])){if(next.length)reason??='terminal_successor';}
  else if(!next.length)reason??='nonterminal_leaf';
  // The source decoder records both edges as a set. When both land on
  // fallthrough the root still has a complete edge, but the node cannot
  // issue a two-successor control relation.
  else if(branch.has(n[2])&&!next.includes(pc+n[1]))reason??='unverified_branch';
  else if(!branch.has(n[2])&&!jump.has(n[2])&&(next.length!==1||next[0]!==pc+n[1]))reason??='invalid_fallthrough';
  else if(jump.has(n[2])&&next.length!==1)reason??='invalid_jump';
  for(const to of next){b.tick();const j=index.get(to);if(j===undefined){reason??='unknown_target';continue;}successors[i].push(j);predecessors[j].push(i);}
 }
 const indegree=predecessors.map(a=>a.length),todo:number[]=[];for(let i=0;i<indegree.length;i++)if(!indegree[i])todo.push(i);
 for(const i of todo){b.tick();order.push(i);for(const j of successors[i])if(!--indegree[j])todo.push(j);}
 if(order.length!==offsets.length)reason??='cycle';
 return {offsets,index,successors,predecessors,order,reason,edges};
}
/** Three matrices are scoped to one root and never escape to results or another root. */
function withRootBits(graph:RootGraph,result:ConditionalResult,b:Budget,visit:(has:(matrix:'dom'|'pdom'|'reach',from:number,to:number)=>boolean)=>void){
 const n=graph.offsets.length,words=Math.ceil((n+1)/32),cells=(n+1)*words,bytes=cells*3*Uint32Array.BYTES_PER_ELEMENT;
 if(bytes>b.limits.maxBitsetBytes)throw new EvidenceFailure('limited','bitset_limit');
 result.stats.peakBitsetBytes=Math.max(result.stats.peakBitsetBytes,bytes);b.tick(cells*3);
 const dom=new Uint32Array(cells),pdom=new Uint32Array(cells),reach=new Uint32Array(cells);
 const set=(matrix:Uint32Array,row:number,bit:number)=>{matrix[row*words+(bit>>>5)]|=1<<(bit&31);};
 for(const i of graph.order){
  const ps=graph.predecessors[i];b.tick(words*Math.max(1,ps.length));
  if(ps.length){dom.copyWithin(i*words,ps[0]*words,(ps[0]+1)*words);for(let k=1;k<ps.length;k++)for(let w=0;w<words;w++)dom[i*words+w]&=dom[ps[k]*words+w];}set(dom,i,i);
 }
 set(pdom,n,n);set(reach,n,n);
 for(let at=graph.order.length-1;at>=0;at--){
  const i=graph.order[at],ss=graph.successors[i].length?graph.successors[i]:[n];b.tick(words*(ss.length*2+1));
  pdom.copyWithin(i*words,ss[0]*words,(ss[0]+1)*words);
  for(let k=1;k<ss.length;k++)for(let w=0;w<words;w++)pdom[i*words+w]&=pdom[ss[k]*words+w];set(pdom,i,i);
  for(const s of ss)for(let w=0;w<words;w++)reach[i*words+w]|=reach[s*words+w];set(reach,i,i);
 }
 const matrices={dom,pdom,reach};visit((matrix,from,to)=>!!(matrices[matrix][from*words+(to>>>5)]&(1<<(to&31))));
 // Nothing holding these matrices is retained: visit may only append scalar identities to result.
}
const noWrite=new Set([20,21,22,23,24,25,16,17,18,19,64,0,7,96,255]);
interface AskCandidate {ask:DialogueRecord;condition:DialogueRecord;bank:number;address:number;width:number;}
/** Stream the Cartesian match: never allocate ASK × IF before checking the output cap. */
function* askCandidates(p:Prepared,offsets:number[],b:Budget):Generator<AskCandidate>{
 const asks=offsets.map(pc=>p.records.get(pc)).filter((r):r is DialogueRecord=>!!r&&r.opcode===72),ifs=offsets.map(pc=>p.records.get(pc)).filter((r):r is DialogueRecord=>!!r&&r.opcode>=20&&r.opcode<=25);
 for(const ask of asks){const bytes=rawBytes(ask.raw,7,72),bank=bytes[1]&15,address=bytes[6];if(!bank)continue;
  for(const condition of ifs){b.tick();const read=ifReads(condition).find(r=>r.bank===bank&&r.address===address);if(read)yield {ask,condition,bank,address,width:read.width};}
 }
}
function scanAskRoot(p:Prepared,entry:number,graph:RootGraph,candidates:Iterable<AskCandidate>,result:ConditionalResult,b:Budget,has?:((matrix:'dom'|'pdom'|'reach',from:number,to:number)=>boolean)){
 for(const {ask,condition,bank,address,width} of candidates){
  b.tick();let reason:string|null=null;const a=graph.index.get(ask.offset)!,i=graph.index.get(condition.offset)!,corridor:number[]=[];
  if(width!==1)reason='width_mismatch';
  else if(!has)reason='root_rejected';
  else if(!has('reach',a,i))reason='no_forward_path';
  else if(graph.successors[i].length!==2)reason='not_two_successors';
  else if(!has('dom',i,a))reason='ask_not_dominator';
  else{
   let unknown=false,overwrite=false;
   for(let k=0;k<graph.offsets.length;k++){
    b.tick();if(k===a||k===i||!has('reach',a,k)||!has('reach',k,i))continue;const pc=graph.offsets[k],op=p.nodes.get(pc)![2];corridor.push(pc);
    if(noWrite.has(op))continue;
    if(op===72){const bytes=rawBytes(p.records.get(pc)!.raw,7,72);if((bytes[1]&15)===bank&&bytes[6]===address)overwrite=true;else unknown=true;}
    else if(op===128||op===130||op===131){const writer=p.gameplay.get(pc);if(writer){const bytes=rawBytes(writer.raw,4,op);if((bytes[1]>>4)===bank&&bytes[2]===address)overwrite=true;else unknown=true;}else unknown=true;}
    else unknown=true;
   }
   if(overwrite)reason='known_overwrite';else if(unknown)reason='unknown_side_effect';
  }
  b.output(1+corridor.length);result.askLinks.push({root:entry,askOffset:ask.offset,ifOffset:condition.offset,bank,address,width,status:reason?'candidate':'local',reason,corridor:corridor.sort((a,c)=>a-c)});
 }
}
function analyzeRoots(p:Prepared,result:ConditionalResult,b:Budget){
 for(const [entry,offsets] of p.roots){
  b.check();const graph=rootGraph(p,offsets,b),candidates=askCandidates(p,offsets,b),accepted=!graph.reason;
  b.output();result.roots.push({entry,aliases:p.aliases.get(entry)!.map(ownerCopy),status:accepted?'accepted':'rejected',reason:graph.reason,nodes:offsets.length,edges:graph.edges});
  if(!accepted){result.stats.rejectedRoots++;if(graph.reason==='cycle')result.stats.cyclicRoots++;scanAskRoot(p,entry,graph,candidates,result,b);continue;}
  result.stats.acceptedRoots++;
  const ifs=offsets.filter(pc=>{const row=p.nodes.get(pc)!;return row[2]>=20&&row[2]<=25&&row.length===6;}),targets=p.events.filter(e=>e.owningRoots.includes(entry));
  if(ifs.length)result.stats.qualifiedRoots++;
  // Terminal-only roots need no quadratic allocations; every accepted root is still fully checked.
  if(!ifs.length&&!offsets.some(pc=>p.records.get(pc)?.opcode===72))continue;
  withRootBits(graph,result,b,has=>{
   for(const pc of ifs){const i=graph.index.get(pc)!,ss=graph.successors[i],successors:[number,number]=[offsets[ss[0]],offsets[ss[1]]];
    for(const s of ss)for(const target of targets){b.tick();const t=graph.index.get(target.offset)!;if(t===i||!has('pdom',s,t)||has('pdom',i,t))continue;const strong=has('dom',t,i);b.output();result.controls.push({root:entry,ifOffset:pc,successor:offsets[s],successors,targetOffset:target.offset,standard:true,strong,core:false,basis:{targetPostdominatesSuccessor:true,targetPostdominatesIf:false,ifDominatesTarget:strong}});}
   }
   scanAskRoot(p,entry,graph,candidates,result,b,has);
  });
 }
 const key=(c:ConditionalControl)=>c.ifOffset+'/'+c.successor+'/'+c.targetOffset,strong=new Map<string,Set<number>>(),events=new Map(p.events.map(e=>[e.offset,e]));
 for(const c of result.controls){b.tick();if(c.strong){const roots=strong.get(key(c))??new Set<number>();roots.add(c.root);strong.set(key(c),roots);}}
 const coreKeys=new Set<string>(),coreEvents=new Set<number>();
 for(const c of result.controls){b.tick();if(c.strong&&events.get(c.targetOffset)!.owningRoots.every(root=>strong.get(key(c))!.has(root))){c.core=true;coreKeys.add(key(c));coreEvents.add(c.targetOffset);}}
 result.stats.standardRelations=result.controls.length;result.stats.strongRelations=result.controls.filter(c=>c.strong).length;result.stats.coreRelations=coreKeys.size;result.stats.coreEvents=coreEvents.size;
 result.stats.askCandidates=new Set(result.askLinks.map(a=>a.askOffset+'/'+a.ifOffset)).size;result.stats.askLocalPairs=new Set(result.askLinks.filter(a=>a.status==='local').map(a=>a.askOffset+'/'+a.ifOffset)).size;
}
function requestLinks(p:Prepared,result:ConditionalResult,b:Budget){
 const tables=new Map<string,InteractionOwner[]>(),targets=new Set<string>();
 for(const e of p.scene.entries)if(e.kind==='table'){b.tick();const key=e.actor+'/'+e.slot,entries=tables.get(key)??[];entries.push(e);tables.set(key,entries);}
 for(const source of p.events){if(source.opcode<1||source.opcode>3||!source.entryReachable)continue;b.tick();const bytes=rawBytes(p.records.get(source.offset)!.raw,3,source.opcode),targetActor=bytes[1],slot=bytes[2]&31,priority=bytes[2]>>5,entries=tables.get(targetActor+'/'+slot)??[],targetEntry=entries.length===1?entries[0].entry:null;
  const targetEventOffsets=targetEntry===null?[]:p.events.filter(e=>{b.tick();return e.owningRoots.includes(targetEntry);}).map(e=>e.offset);
  b.output(1+targetEventOffsets.length);result.requestLinks.push({sourceOffset:source.offset,opcode:source.opcode,priority,sourceOwners:source.owners.map(ownerCopy),targetActor,slot,targetEntry,status:entries.length===1?'resolved':entries.length?'ambiguous':'missing',targetEventOffsets});
  if(targetEntry!==null)targets.add(targetActor+'/'+slot+'/'+targetEntry);result.stats.requestEventPairs+=targetEventOffsets.length;
 }
 result.stats.requestCount=result.requestLinks.length;result.stats.requestTargets=targets.size;
}
function failed(result:ConditionalResult,error:unknown):ConditionalResult {
 const failure=error instanceof EvidenceFailure?error:new EvidenceFailure('unavailable','invalid_input');
 result.status=failure.status;result.complete=false;result.problems=[failure.code];result.roots=[];result.events=[];result.controls=[];result.askLinks=[];result.requestLinks=[];
 result.stats.complete=false;result.stats.acceptedRoots=0;result.stats.rejectedRoots=0;result.stats.qualifiedRoots=0;result.stats.cyclicRoots=0;result.stats.standardRelations=0;result.stats.strongRelations=0;result.stats.coreRelations=0;result.stats.coreEvents=0;result.stats.askCandidates=0;result.stats.askLocalPairs=0;result.stats.requestCount=0;result.stats.requestTargets=0;result.stats.requestEventPairs=0;
 return result;
}
/** Pure synchronous entry point. Any global budget/cancellation removes ALL provisional evidence. */
export function analyzeFieldConditionalSnapshot(input:FieldConditionalInput,options:ConditionalOptions={}):ConditionalResult {
 const result=emptyResult();try{const b=runBudget(result,options),p=prepare(input,result,b);analyzeRoots(p,result,b);requestLinks(p,result,b);b.check();result.status='complete';result.complete=true;result.stats.complete=true;return result;}catch(error){return failed(result,error);}
}
export function analyzeFieldConditionalEvidence(input:FieldEventInput,options:ConditionalOptions={}):ConditionalResult {
 try{return analyzeFieldConditionalSnapshot(toFieldConditionalInput(input),options);}catch(error){return failed(emptyResult(),error);}
}
