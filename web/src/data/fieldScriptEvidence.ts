// SPDX-License-Identifier: GPL-3.0-only
import type {FieldPack} from './fieldContext';
import {inflateVisual} from './fieldCamera';

/** Independent, optional evidence transport; it contains no executable script. */
export const SCRIPT_EVIDENCE_FILE='gaia-field-script-evidence.bin';
export const SCRIPT_EVIDENCE_GENERATOR='field-script-evidence-1';
// Full-archive maxima: 2,025,581 pack / 227,044 metadata / 197,283 scene
// bytes, 232 records and 2,507 owner references per scene. The independent
// evidence budgets have headroom without borrowing the Visual image budget.
export const SCRIPT_EVIDENCE_LIMITS={pack:4_000_000,metadata:512_000,scene:512_000,records:1024,entries:2112,owners:16_384} as const;
export const SCRIPT_OPCODES:Readonly<Record<number,{name:string;length:number}>>={
 44:{name:'BGPDH',length:5},45:{name:'BGSCR',length:7},223:{name:'MPPAL',length:11},
 224:{name:'BGON',length:4},225:{name:'BGOFF',length:4},226:{name:'BGROL',length:3},227:{name:'BGROL2',length:3},228:{name:'BGCLR',length:3},
 229:{name:'STPAL',length:5},230:{name:'LDPAL',length:5},231:{name:'CPPAL',length:5},232:{name:'RTPAL',length:7},233:{name:'ADPAL',length:10},234:{name:'MPPAL2',length:10},
 235:{name:'STPLS',length:5},236:{name:'LDPLS',length:5},237:{name:'CPPAL2',length:8},238:{name:'RTPAL2',length:8},239:{name:'ADPAL2',length:11},
};
export interface ScriptEntry {actor:number;name:string|null;slot:number;entry:number;kind:'table'|'main';}
export interface ScriptOperand {name:string;offset:number;bytes:1|2;signed:boolean;bank:number|null;value:number;kind:'literal'|'variable'|'unknown';}
export interface ScriptAssociation {group:number|null;stateBit:number|null;layer:number|null;palette:null;}
export interface ScriptEvidenceRecord {
 offset:number;length:number;opcode:number;raw:string;owners:number[];entryReachable:true;operands:ScriptOperand[];
 association:ScriptAssociation;confidence:'corroborated';runtime:'unknown';unknown:string[];
}
export interface ScriptRange {offset:number;bytes:number;}
export interface ScriptStop {offset:number|null;opcode:number|null;reason:'unsupported_opcode'|'unverified_boundary'|'invalid_script';entryReachable:boolean;owners:number[];}
export interface ScriptEvidenceScene {
 fieldId:number;name:string;section1Bytes:number;section8Bytes:number;section1SHA256:string;section8SHA256:string;
 status:'indexed'|'empty'|'partial'|'limited'|'invalid_source';reason:null|'bounded_cfg_stops'|'invalid_script';
 codeStart:number|null;codeEnd:number|null;entries:ScriptEntry[];decodedInstructions:number;reachableInstructions:number;decodedBytes:number;reachableBytes:number;
 uncovered:ScriptRange[];unreachable:ScriptRange[];records:ScriptEvidenceRecord[];stops:ScriptStop[];
}
export interface ScriptSceneSpan {fieldId:number;name:string;section1SHA256:string;section8SHA256:string;offset:number;bytes:number;rawBytes:number;sha256:string;}
const integer=(v:unknown,lo=0,hi=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=lo&&Number(v)<=hi;
const fingerprint=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const shape=(v:unknown,keys:string[])=>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Script evidence object');
 const row=v as Record<string,any>;if(Object.keys(row).length!==keys.length||keys.some(k=>!Object.hasOwn(row,k)))throw Error('Script evidence shape');return row;
};
const list=(v:unknown,max:number):any[]=>{if(!Array.isArray(v)||v.length>max)throw Error('Script evidence list budget');return v;};
const same=(a:unknown,b:unknown):boolean=>{
 if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const x=a as Record<string,unknown>,y=b as Record<string,unknown>,keys=Object.keys(x);return keys.length===Object.keys(y).length&&keys.every(k=>Object.hasOwn(y,k)&&same(x[k],y[k]));
};
const span=(offset:unknown,bytes:unknown,total:number)=>integer(offset,0,total)&&integer(bytes,0,total)&&bytes<=total-offset;
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),n=>n.toString(16).padStart(2,'0')).join('');

/** Reject ambiguous duplicate keys before interpreting a small, bounded document. */
function evidenceJSON(bytes:ArrayBuffer|Uint8Array){
 const text=new TextDecoder('utf8',{fatal:true}).decode(bytes),stack:({keys:Set<string>;key:boolean}|null)[]=[];
 for(const token of text.matchAll(/"(?:[^"\\]|\\[\s\S])*"|[{}\[\],:]|[^\s{}\[\],:]+/g)){
  const value=token[0],current=stack.at(-1);
  if(value==='{'){if(stack.length>=32)throw Error('Script evidence JSON depth');stack.push({keys:new Set(),key:true});}
  else if(value==='['){if(stack.length>=32)throw Error('Script evidence JSON depth');stack.push(null);}
  else if(value==='}'||value===']')stack.pop();
  else if(value===','){if(current)current.key=true;}
  else if(value.startsWith('"')&&current?.key){const key=JSON.parse(value);if(current.keys.has(key))throw Error('Script evidence duplicate JSON key');current.keys.add(key);current.key=false;}
 }
 return JSON.parse(text);
}

export function parseScriptEvidenceHeader(buffer:ArrayBuffer,total:number,fields:FieldPack,contextSHA256:string){
 const v=new DataView(buffer);if(!integer(total,16,SCRIPT_EVIDENCE_LIMITS.pack)||v.byteLength<16||new TextDecoder().decode(buffer.slice(0,8))!=='GAIASCR\0'||v.getUint32(8,true)!==1)throw Error('Script evidence header');
 const length=v.getUint32(12,true),base=16+length;
 if(!length||length>SCRIPT_EVIDENCE_LIMITS.metadata||base>total||v.byteLength!==base)throw Error('Script evidence metadata bounds');
 const meta=shape(evidenceJSON(buffer.slice(16)),['schema','version','generator_revision','sources','contextSHA256','scenes']);
 if(meta.schema!=='gaiagis-field-script-evidence'||meta.version!==1||meta.generator_revision!==SCRIPT_EVIDENCE_GENERATOR)throw Error('Script evidence schema');
 const sources=shape(meta.sources,['flevel.lgp','maplist']);if(Object.entries(sources).some(([key,h])=>!fingerprint(h)||h!==fields.sources[key])||!fingerprint(contextSHA256)||meta.contextSHA256!==contextSHA256)throw Error('Script evidence Context/source identity mismatch');
 const scenes=new Map<number,ScriptSceneSpan>();let end=0;
 for(const value of list(meta.scenes,2000)){
  const s=shape(value,['fieldId','name','section1SHA256','section8SHA256','offset','bytes','rawBytes','sha256']);
  if(!integer(s.fieldId,0,65535)||scenes.has(s.fieldId)||typeof s.name!=='string'||!/^[A-Za-z0-9_-]{1,20}$/.test(s.name)||!fields.nodes.some(n=>n.id===s.fieldId&&n.name===s.name&&n.status==='available')||![s.section1SHA256,s.section8SHA256,s.sha256].every(fingerprint))throw Error('Script evidence scene identity');
  if(s.offset!==end||!integer(s.bytes,1,SCRIPT_EVIDENCE_LIMITS.scene)||!integer(s.rawBytes,1,SCRIPT_EVIDENCE_LIMITS.scene)||!span(end,s.bytes,total-base))throw Error('Script evidence scene span');
  end+=s.bytes;scenes.set(s.fieldId,s as ScriptSceneSpan);
 }
 if(base+end!==total||fields.nodes.filter(n=>n.status==='available').some(n=>!scenes.has(n.id)))throw Error('Script evidence trailing/missing Field data');
 return {base,scenes,sources:sources as Record<string,string>,contextSHA256};
}

function indices(value:unknown,entries:ScriptEntry[],required=false){
 const result=list(value,SCRIPT_EVIDENCE_LIMITS.entries);
 if(required&&!result.length||result.some((id,i)=>!integer(id,0,entries.length-1)||i>0&&result[i-1]>=id))throw Error('Script evidence owner identity');
 return result as number[];
}
function ranges(value:unknown,start:number,end:number){
 let previous=start,total=0;
 const result=list(value,65535).map(value=>{const r=shape(value,['offset','bytes']);if(!integer(r.offset,start,end)||!integer(r.bytes,1,end-start)||r.offset<previous||!span(r.offset,r.bytes,end))throw Error('Script evidence coverage range');previous=r.offset+r.bytes;total+=r.bytes;return r as ScriptRange;});
 return {result,total};
}

/** Independently read fixed operands. No value is fetched from a game bank. */
export function decodeScriptOperands(raw:Uint8Array){
 const opcode=raw[0],definition=SCRIPT_OPCODES[opcode];if(!definition||raw.length!==definition.length)throw Error('Script evidence opcode/width');
 const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),operands:ScriptOperand[]=[],association:ScriptAssociation={group:null,stateBit:null,layer:null,palette:null},unknown=['runtime_execution_unknown'];
 type Field=[name:string,offset:number,bytes?:1|2,signed?:boolean,bankByte?:number,nibble?:0|1];
 const layouts:Partial<Record<number,Field[]>>={
  44:[['layer',2],['depth',3,2,true,1,0]],45:[['layer',2],['xOperand',3,2,true,1,0],['yOperand',5,2,true,1,1]],
  224:[['group',2,1,false,1,0],['stateBit',3,1,false,1,1]],225:[['group',2,1,false,1,0],['stateBit',3,1,false,1,1]],
  226:[['group',2,1,false,1,1]],227:[['group',2,1,false,1,1]],228:[['group',2,1,false,1,1]],
  229:[['paletteIdOperand',2,1,false,1,0],['bufferPosition',3,1,false,1,1],['countMinusOne',4]],
  230:[['bufferPosition',2,1,false,1,0],['paletteIdOperand',3,1,false,1,1],['countMinusOne',4]],
  231:[['sourceBuffer',2,1,false,1,0],['targetBuffer',3,1,false,1,1],['countMinusOne',4]],
  232:[['sourceBuffer',3,1,false,1,0],['targetBuffer',4,1,false,1,1],['startOperand',5,1,false,2,1],['endOperand',6]],
  235:[['paletteIdOperand',1],['bufferPosition',2],['startOperand',3],['countMinusOne',4]],
  236:[['bufferPosition',1],['paletteIdOperand',2],['startOperand',3],['countMinusOne',4]],
  237:[['sourceBufferOperand',3],['targetBufferOperand',4],['sourcePositionOperand',5,1,false,1,0],['targetPositionOperand',6,1,false,1,1],['countOperand',7,1,false,2,1]],
  238:[['sourceBufferOperand',3],['targetBufferOperand',4],['sourcePositionOperand',5,1,false,1,0],['targetPositionOperand',6,1,false,1,1],['startOperand',7,1,false,2,1]],
 };
 if(opcode===233||opcode===234)layouts[opcode]=[...['sourceBuffer','targetBuffer','blueOperand','greenOperand','redOperand'].map((name,i):Field=>[name,4+i,1,false,1+Math.floor(i/2),i%2 as 0|1]),['countMinusOne',9]];
 if(opcode===223||opcode===239)layouts[opcode]=[['sourceBufferOperand',4],['targetBufferOperand',5],...['startOperand','blueOperand','greenOperand','redOperand'].map((name,i):Field=>[name,6+i,1,false,1+Math.floor(i/2),i%2 as 0|1]),['countOperand',10,1,false,3,1]];
 for(const [name,offset,bytes=1,signed=false,bankByte,nibble=0]of layouts[opcode]!) {
  const bank=bankByte===undefined?null:nibble===0?raw[bankByte]>>4:raw[bankByte]&15,value=bytes===1?view.getUint8(offset):signed?view.getInt16(offset,true):view.getUint16(offset,true);
  const kind=opcode===44&&name==='depth'&&raw[1]!==0?'unknown':bank===null||bank===0?'literal':'variable';operands.push({name,offset,bytes,signed,bank,value,kind});
 }
 const literal=(name:string)=>{const p=operands.find(p=>p.name===name);return p?.kind==='literal'?p.value:null;};
 if(opcode===224||opcode===225){association.group=literal('group');const bit=literal('stateBit');association.stateBit=bit!==null&&bit<8?bit:null;if(bit!==null&&bit>=8)unknown.push('state_bit_outside_tile_mask');}
 else if(opcode>=226&&opcode<=228){association.group=literal('group');if(opcode!==228)unknown.push('state_rotation_not_spatial_scroll');}
 else if(opcode===44||opcode===45){const layer=literal('layer');association.layer=layer===2||layer===3?layer:null;if(association.layer===null)unknown.push('layer_operand_outside_research_layers');if(opcode===44&&raw[1]!==0)unknown.push('bgpdh_bank_selection_conflict');if(opcode===45)unknown.push('scroll_units_timing_and_initial_position_unknown');}
 else if([233,234,223,239].includes(opcode))unknown.push('palette_arithmetic_not_evaluated');
 else if(opcode===237||opcode===238)unknown.push('extended_palette_semantics_unconfirmed');
 if(opcode>=229||opcode===223)unknown.push('palette_work_buffer_not_section4_identity');
 if(operands.some(p=>p.kind==='variable'))unknown.push('runtime_variable_not_evaluated');
 return {operands,association,confidence:'corroborated' as const,runtime:'unknown' as const,unknown};
}

/** Validate persisted interpretation against bounded source instruction bytes. */
export function parseScriptEvidenceScene(value:unknown,source:ScriptSceneSpan):ScriptEvidenceScene {
 const s=shape(value,['fieldId','name','section1Bytes','section8Bytes','section1SHA256','section8SHA256','status','reason','codeStart','codeEnd','entries','decodedInstructions','reachableInstructions','decodedBytes','reachableBytes','uncovered','unreachable','records','stops']);
 if(s.fieldId!==source.fieldId||s.name!==source.name||s.section1SHA256!==source.section1SHA256||s.section8SHA256!==source.section8SHA256||!integer(s.section1Bytes,32,8_000_000)||![536,740].includes(s.section8Bytes)||!['indexed','empty','partial','limited','invalid_source'].includes(s.status))throw Error('Script evidence payload identity');
 const invalid=s.status==='invalid_source';
 if(invalid?(s.reason!=='invalid_script'||s.codeStart!==0||s.codeEnd!==0):(!integer(s.codeStart,32,65535)||!integer(s.codeEnd,s.codeStart,Math.min(65535,s.section1Bytes))||s.reason!==(['partial','limited'].includes(s.status)?'bounded_cfg_stops':null)))throw Error('Script evidence code bounds/status');
 const start=invalid?0:s.codeStart,end=invalid?0:s.codeEnd,codeBytes=end-start;
 const entries:ScriptEntry[]=[],entryKeys=new Set<string>();
 for(const value of list(s.entries,SCRIPT_EVIDENCE_LIMITS.entries)){
  const e=shape(value,['actor','name','slot','entry','kind']),key=[e.actor,e.slot,e.entry,e.kind].join(':');
  if(!integer(e.actor,0,63)||!integer(e.slot,0,31)||!integer(e.entry,start,end-1)||!['table','main'].includes(e.kind)||e.kind==='main'&&e.slot!==0||e.name!==null&&(typeof e.name!=='string'||!/^[\x20-\x7e]{0,8}$/.test(e.name))||entryKeys.has(key))throw Error('Script evidence entry');
  const previous=entries.at(-1);if(previous&&(e.actor<previous.actor||e.actor===previous.actor&&(previous.kind==='main'||e.kind==='table'&&e.slot<=previous.slot)))throw Error('Script evidence entry order');
  entryKeys.add(key);entries.push(e as ScriptEntry);
 }
 for(const name of ['decodedInstructions','reachableInstructions','decodedBytes','reachableBytes'])if(!integer(s[name],0,codeBytes))throw Error('Script evidence instruction accounting');
 if(s.reachableInstructions>s.decodedInstructions||s.reachableBytes>s.decodedBytes||s.decodedInstructions>s.decodedBytes||s.reachableInstructions>s.reachableBytes)throw Error('Script evidence reachable accounting');
 const uncovered=ranges(s.uncovered,start,end),unreachable=ranges(s.unreachable,start,end);
 if(uncovered.total!==codeBytes-s.decodedBytes||unreachable.total!==codeBytes-s.reachableBytes)throw Error('Script evidence coverage accounting');
 if(uncovered.result.some(g=>!unreachable.result.some(u=>u.offset<=g.offset&&g.bytes<=u.offset+u.bytes-g.offset)))throw Error('Script evidence reachable coverage outside decoded code');
 const records:ScriptEvidenceRecord[]=[];let lastEnd=start,ownerBudget=0;
 for(const value of list(s.records,SCRIPT_EVIDENCE_LIMITS.records)){
  const r=shape(value,['offset','length','opcode','raw','owners','entryReachable','operands','association','confidence','runtime','unknown']),opcode=SCRIPT_OPCODES[r.opcode];
  if(!integer(r.opcode,0,255)||!opcode||r.length!==opcode.length||!integer(r.offset,start,end)||r.offset<lastEnd||!span(r.offset,r.length,end)||r.entryReachable!==true||r.confidence!=='corroborated'||r.runtime!=='unknown'||typeof r.raw!=='string'||r.raw.length!==r.length*2||!/^[a-f0-9]+$/.test(r.raw))throw Error('Script evidence instruction');
  lastEnd=r.offset+r.length;const bytes=Uint8Array.from(r.raw.match(/../g)!,n=>parseInt(n,16)),raw=new DataView(bytes.buffer);
  if(bytes[0]!==r.opcode)throw Error('Script evidence raw opcode');
  r.owners=indices(r.owners,entries,true);ownerBudget+=r.owners.length;if(ownerBudget>SCRIPT_EVIDENCE_LIMITS.owners)throw Error('Script evidence owner budget');
  const names=new Set<string>();let operandEnd=1;
  for(const value of list(r.operands,10)){
   const p=shape(value,['name','offset','bytes','signed','bank','value','kind']);
   if(typeof p.name!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(p.name)||names.has(p.name)||!integer(p.offset,operandEnd,r.length-1)||![1,2].includes(p.bytes)||!span(p.offset,p.bytes,r.length)||typeof p.signed!=='boolean'||p.signed&&p.bytes!==2||p.bank!==null&&!integer(p.bank,0,15)||!['literal','variable','unknown'].includes(p.kind))throw Error('Script evidence operand');
   const observed=p.bytes===1?raw.getUint8(p.offset):p.signed?raw.getInt16(p.offset,true):raw.getUint16(p.offset,true);
   if(p.value!==observed||p.kind==='literal'&&p.bank!==null&&p.bank!==0||p.kind==='variable'&&(p.bank===null||p.bank===0))throw Error('Script evidence operand bytes/bank');
   operandEnd=p.offset+p.bytes;names.add(p.name);
  }
  const a=shape(r.association,['group','stateBit','layer','palette']);
  if(a.group!==null&&!integer(a.group,0,255)||a.stateBit!==null&&!integer(a.stateBit,0,7)||a.layer!==null&&!integer(a.layer,0,3)||a.palette!==null)throw Error('Script evidence association');
  if(list(r.unknown,16).some(v=>typeof v!=='string'||!v.length||v.length>256))throw Error('Script evidence unknown semantics');
  const expected=decodeScriptOperands(bytes);for(const [key,value]of Object.entries(expected))if(!same(r[key],value))throw Error('Script evidence operand/association mismatch');
  if([...uncovered.result,...unreachable.result].some(g=>r.offset<g.offset+g.bytes&&g.offset<lastEnd))throw Error('Script evidence target in uncovered/unreachable range');
  records.push(r as ScriptEvidenceRecord);
 }
 const stops:ScriptStop[]=[],stopIds=new Set<number|null>();
 for(const value of list(s.stops,4096)){
  const stop=shape(value,['offset','opcode','reason','entryReachable','owners']);
  if(typeof stop.entryReachable!=='boolean'||!['unsupported_opcode','unverified_boundary','invalid_script'].includes(stop.reason)||(stop.reason==='invalid_script'?(stop.offset!==null||stop.opcode!==null||!invalid||stop.entryReachable||stop.owners.length):(!integer(stop.offset,start,end-1)||!integer(stop.opcode,0,255)||!uncovered.result.some(g=>g.offset<=stop.offset&&stop.offset<g.offset+g.bytes)))||stopIds.has(stop.offset))throw Error('Script evidence stop');
  stopIds.add(stop.offset);
  stop.owners=indices(stop.owners,entries,stop.entryReachable);if(!stop.entryReachable&&stop.owners.length)throw Error('Script evidence unreachable stop owner');ownerBudget+=stop.owners.length;if(ownerBudget>SCRIPT_EVIDENCE_LIMITS.owners)throw Error('Script evidence owner budget');
  stops.push(stop as ScriptStop);
 }
 const incomplete=!!(stops.length||uncovered.result.length),expectedStatus=incomplete?(records.length?'partial':'limited'):(records.length?'indexed':'empty');
 if(invalid?(entries.length||records.length||stops.length!==1||stops[0].reason!=='invalid_script'):(records.length>s.reachableInstructions||records.reduce((n,r)=>n+r.length,0)>s.reachableBytes||s.status!==expectedStatus))throw Error('Script evidence result accounting');
 return {...s,entries,records,stops,uncovered:uncovered.result,unreachable:unreachable.result} as ScriptEvidenceScene;
}

/** Header plus File slices only; callers own/discard the currently decoded scene. */
export async function openFieldScriptEvidence(file:File,fields:FieldPack,contextSHA256:string){
 if(file.name!==SCRIPT_EVIDENCE_FILE||!integer(file.size,16,SCRIPT_EVIDENCE_LIMITS.pack))throw Error('Script evidence file bounds');
 const first=await file.slice(0,16).arrayBuffer();if(first.byteLength!==16)throw Error('Script evidence truncated header');
 const length=new DataView(first).getUint32(12,true);if(length>SCRIPT_EVIDENCE_LIMITS.metadata||!span(16,length,file.size))throw Error('Script evidence metadata budget');
 const header=parseScriptEvidenceHeader(await file.slice(0,16+length).arrayBuffer(),file.size,fields,contextSHA256);
 return {scenes:header.scenes,sources:header.sources,contextSHA256,async decode(id:number,signal?:AbortSignal){
  signal?.throwIfAborted();const s=header.scenes.get(id);if(!s)throw Error('Script evidence scene unavailable');
  const compressed=await file.slice(header.base+s.offset,header.base+s.offset+s.bytes).arrayBuffer();signal?.throwIfAborted();
  const bytes=await inflateVisual(compressed,s.rawBytes,signal);if(await hash(bytes)!==s.sha256)throw Error('Script evidence scene fingerprint mismatch');signal?.throwIfAborted();
  return parseScriptEvidenceScene(evidenceJSON(bytes),s);
 }};
}

export interface ScriptEvidenceFilter {actor?:number;slot?:number;opcode?:number;group?:number;layer?:number;offset?:number;}
export function filterScriptEvidence(scene:ScriptEvidenceScene,filter:ScriptEvidenceFilter){
 return scene.records.filter(r=>(filter.opcode===undefined||r.opcode===filter.opcode)&&(filter.group===undefined||r.association.group===filter.group)&&(filter.layer===undefined||r.association.layer===filter.layer)&&(filter.offset===undefined||r.offset===filter.offset)&&r.owners.some(id=>{const e=scene.entries[id];return (filter.actor===undefined||e.actor===filter.actor)&&(filter.slot===undefined||e.slot===filter.slot);}));
}
