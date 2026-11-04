// SPDX-License-Identifier: GPL-3.0-only
import {checkCFG,CMUSC8_CFG,LEGACY_CFG} from './fieldProvenance';
import type {FieldDecoder} from './fieldProvenance';
import type {FieldPack} from './fieldContext';
import type {InteractionOwner} from './fieldInteraction';
import {inflateVisual} from './fieldCamera';
export const DIALOGUE_FILE='gaia-field-dialogue.bin',DIALOGUE_GENERATOR='field-dialogue-1',DIALOGUE_DECODER='field-cfg-v510-cmusc-stop';
export const DIALOGUE_LIMITS={pack:16_000_000,metadata:1_000_000,scene:2_000_000,records:16_384,entries:2112,cfg:65_535} as const;
export interface DialogueRecord{offset:number;opcode:number;raw:string;entryReachable:boolean;owners:number[];}
export interface DialogueText{id:number;offset:number;bytes:number|null;status:'valid'|'unavailable';reason:string|null;body:string|null;}
export interface DialogueScene{fieldId:number;name:string;memberSHA256:string;section1SHA256:string;section5SHA256:string|null;section8SHA256:string;section1Bytes:number;status:'complete'|'partial';codeStart:number;codeEnd:number;entries:InteractionOwner[];cfg:number[][];records:DialogueRecord[];stops:{offset:number;opcode:number;reason:string;entryReachable:boolean}[];uncoveredBytes:number;textTable:{status:'valid'|'unavailable';reason:string|null;at:number;end:number;declared:number|null;texts:DialogueText[]};}
interface DialogueSpan{fieldId:number;name:string;memberSHA256:string;section1SHA256:string;section5SHA256:string|null;section8SHA256:string;offset:number;bytes:number;rawBytes:number;sha256:string;}
export interface DialogueResource{scene:DialogueScene;sha256:string;sources:Record<string,string>;contextSHA256:string;generation:number;mode:'metadata-only'|'with-text';}
export const dialogueNames:Readonly<Record<number,string>>={1:'REQ',2:'REQSW',3:'REQEW',20:'IFUB',21:'IFUBL',22:'IFSW',23:'IFSWL',24:'IFUW',25:'IFUWL',64:'MESSAGE',72:'ASK'};
const widths:Record<number,number>={1:3,2:3,3:3,20:6,21:7,22:8,23:9,24:8,25:9,64:3,72:7};
const hash=(x:unknown):x is string=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),int=(x:unknown,a=0,b=65535):x is number=>Number.isSafeInteger(x)&&Number(x)>=a&&Number(x)<=b;
function check(ok:unknown):asserts ok{if(!ok)throw Error('Field dialogue evidence validation');}
const list=(x:unknown,n:number):any[]=>{check(Array.isArray(x)&&x.length<=n);return x;};
const object=(x:unknown,keys:string)=>{check(x&&typeof x==='object'&&!Array.isArray(x));const r=x as Record<string,any>;check(Object.keys(r).sort().join(' ')==keys.split(' ').sort().join(' '));return r;};
export function dialogueBytes(raw:string){check(typeof raw==='string'&&raw.length%2===0&&/^[a-f0-9]*$/.test(raw));return Uint8Array.from(raw.match(/../g)??[],s=>parseInt(s,16));}
const byteHash=async(b:Uint8Array<ArrayBuffer>)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
/** Safe symbolic Western preview. No HTML, variable evaluation, timing or game font. */
export function dialogueTokens(bytes:Uint8Array){
 const out:string[]=[],unknown:number[]=[],controls:Record<number,string>={224:'CHOICE',225:'TAB',226:', ',227:'."',228:'…"',230:'GLYPH:E6',231:'\n',232:'\n[PAGE]\n'},ext:Record<number,string>={210:'GRAY',211:'BLUE',212:'RED',213:'PURPLE',214:'GREEN',215:'CYAN',216:'YELLOW',217:'WHITE',218:'FLASH',219:'RAINBOW',220:'PAUSE',222:'NUM',223:'HEX',224:'SCROLL',225:'RNUM',233:'FIXED'};
 const u16=(p:number)=>bytes[p]|bytes[p+1]<<8,western=new TextDecoder('macintosh');let p=0;
 while(p<bytes.length){const c=bytes[p++];if(c===255)return {text:out.join(''),unknown,consumed:p};
  if(c<=0x5e)out.push(String.fromCharCode(c+32));
  else if(c>=0x60&&c<=0xd3&&![0x80,0x84,0x85,0x97,0x98,0x9a,0xaa,0xbb,0xc0,0xc1,0xd0,0xd2].includes(c))out.push(western.decode(new Uint8Array([c+32])));
  else if(c<0xe0||c===0xe6){out.push(`[GLYPH:${c.toString(16).toUpperCase()}]`);unknown.push(c);}
  else if(c===0xfe){check(p<bytes.length);const k=bytes[p++];if(k===0xdd){check(p+2<=bytes.length);out.push(`[WAIT:u16=${u16(p)}]`);p+=2;}else if(k===0xe2){check(p+4<=bytes.length);out.push(`[MEMORY:${u16(p)},${u16(p+2)}]`);p+=4;}else{check(k in ext);out.push(`[${ext[k]}]`);}}
  else if(c in controls)out.push(c===0xe7||c===0xe8||c>=0xe2&&c<=0xe4?controls[c]:`[${controls[c]}]`);
  else if(c>=0xea&&c<=0xf2)out.push(`[NAME:${c-0xea}]`);
  else if(c>=0xf3&&c<=0xf5)out.push(`[PARTY:${c-0xf3}]`);
  else if(c>=0xf6&&c<=0xf9)out.push(`[BUTTON:${['CIRCLE','TRIANGLE','SQUARE','CROSS'][c-0xf6]}]`);
  else check(false);
 }
 throw Error('Field dialogue missing terminator');
}
export function dialogueOperand(record:DialogueRecord){const b=dialogueBytes(record.raw),v=new DataView(b.buffer),op=b[0];
 if(op===64)return {textId:b[2],window:b[1]};
 if(op===72)return {textId:b[3],window:b[2],firstLine:b[4],lastLine:b[5],answer:{bank:b[1]&15,address:b[6],width:1},rawBanks:b[1]};
 if(op>=1&&op<=3)return {targetActor:b[1],slot:b[2]&31,priority:b[2]>>5};
 const size=op<=21?1:2,signed=op===22||op===23,read=(at:number)=>size===1?b[at]:signed?v.getInt16(at,true):v.getUint16(at,true),at=size===1?5:7;
 return {reads:[{bank:b[1]>>4,value:read(2),width:size,kind:b[1]>>4?'variable':'literal'},{bank:b[1]&15,value:read(2+size),width:size,kind:b[1]&15?'variable':'literal'}],operator:b[at-1],operatorName:['EQ','NE','GT','LT','GE','LE','AND','XOR','OR','BIT_SET','BIT_CLEAR'][b[at-1]]??'UNKNOWN',branch:record.offset+at+(op%2?v.getUint16(at,true):b[at])};
}
export function parseDialogueScene(value:unknown,span:DialogueSpan,mode:'metadata-only'|'with-text',decoder:FieldDecoder=LEGACY_CFG){
 const s=object(value,'fieldId name memberSHA256 section1SHA256 section8SHA256 section5SHA256 section1Bytes status codeStart codeEnd entries cfg records stops uncoveredBytes textTable');
 for(const k of ['fieldId','name','memberSHA256','section1SHA256','section8SHA256','section5SHA256'] as const)check(s[k]===span[k]);
 check(int(s.section1Bytes,32,8_000_000)&&int(s.codeStart,32,s.section1Bytes)&&int(s.codeEnd,s.codeStart,Math.min(s.section1Bytes,65535))&&['complete','partial'].includes(s.status));
 const entries=list(s.entries,DIALOGUE_LIMITS.entries) as InteractionOwner[];
 const entryKeys=new Set<string>();for(const value of entries){const e=object(value,'actor name slot entry kind');check(int(e.actor,0,63)&&int(e.slot,0,31)&&int(e.entry,s.codeStart,s.codeEnd-1)&&['table','main'].includes(e.kind)&&(e.kind!=='main'||e.slot===0)&&(e.name===null||typeof e.name==='string'&&/^[\x20-\x7e]{0,8}$/.test(e.name)));const key=e.actor+'/'+e.kind+'/'+e.slot;check(!entryKeys.has(key));entryKeys.add(key);}
 const stops=list(s.stops,4096);const stopped=new Set<number>();for(const value of stops){const r=object(value,'offset opcode reason entryReachable');check(int(r.offset,s.codeStart,s.codeEnd-1)&&int(r.opcode,0,255)&&['unsupported_opcode','unverified_boundary'].includes(r.reason)&&typeof r.entryReachable==='boolean'&&!stopped.has(r.offset));stopped.add(r.offset);}
 const cfg=list(s.cfg,DIALOGUE_LIMITS.cfg) as number[][],nodes=new Map<number,number[]>();let end=s.codeStart,total=0;
 for(const row of cfg){check(Array.isArray(row)&&row.length>=4&&row.length<=6&&int(row[0],end,s.codeEnd-1)&&int(row[1],1,s.codeEnd-row[0])&&int(row[2],0,255)&&(row[2]!==253||decoder===CMUSC8_CFG&&row[1]===8)&&[0,1].includes(row[3])&&new Set(row.slice(4)).size===row.length-4);end=row[0]+row[1];total+=row[1];nodes.set(row[0],row);}
 check(int(s.uncoveredBytes,0,s.codeEnd-s.codeStart)&&s.uncoveredBytes===s.codeEnd-s.codeStart-total&&s.status===((stops.length||s.uncoveredBytes)?'partial':'complete'));
 for(const row of cfg)for(const next of row.slice(4))check(int(next,s.codeStart,s.codeEnd-1)&&(nodes.has(next)||stopped.has(next)));
 const records=list(s.records,DIALOGUE_LIMITS.records) as DialogueRecord[];let previous=-1;
 for(const value of records){const r=object(value,'offset opcode raw entryReachable owners'),b=dialogueBytes(r.raw),n=nodes.get(r.offset);check(int(r.offset,s.codeStart,s.codeEnd-1)&&r.offset>previous&&r.opcode in widths&&b.length===widths[r.opcode]&&b[0]===r.opcode&&n&&n[1]===b.length&&n[2]===r.opcode&&typeof r.entryReachable==='boolean'&&n[3]===Number(r.entryReachable));previous=r.offset;const owners=list(r.owners,DIALOGUE_LIMITS.entries);check(owners.every((i,k)=>int(i,0,entries.length-1)&&(!k||i>owners[k-1]))&&r.entryReachable===!!owners.length);
  if(r.entryReachable&&r.opcode>=20&&r.opcode<=25){const operand=dialogueOperand(r as DialogueRecord),expected=[operand.branch!,...(r.offset+b.length<s.codeEnd?[r.offset+b.length]:[])];check(n.slice(4).join(',')===[...new Set(expected)].sort((a,b)=>a-b).join(','));}
 }
 check(records.length===cfg.filter(n=>n[2] in widths).length);
 // Re-derive ownership from the supplied, source-bound graph. Do not trust aliases on records.
 const ownership=new Map(records.map(r=>[r.offset,[] as number[]])),roots=new Map<number,number[]>();entries.forEach((e,i)=>{const a=roots.get(e.entry)??[];a.push(i);roots.set(e.entry,a);});let work=0;const reachable=new Set<number>();
 for(const [root,aliases]of roots){const seen=new Set([root]),todo=[root];for(const pc of todo){check(++work<=8_000_000);reachable.add(pc);const ids=ownership.get(pc);if(ids)ids.push(...aliases);for(const next of nodes.get(pc)?.slice(4)??[])if(!seen.has(next)){seen.add(next);todo.push(next);}}}
 for(const row of cfg)check(row[3]===Number(reachable.has(row[0])));
 for(const r of records)check(r.owners.join(',')===(ownership.get(r.offset)??[]).sort((a,b)=>a-b).join(','));
 const table=object(s.textTable,'status reason at end declared texts');check(['valid','unavailable'].includes(table.status)&&int(table.at,s.codeEnd,s.section1Bytes)&&int(table.end,0,s.section1Bytes)&&(table.declared===null||int(table.declared))&&(table.reason===null||['no_text_region','extra_bounds','table_bounds','table_count','text_pointer'].includes(table.reason)));
 const texts=list(table.texts,256) as DialogueText[],refs=new Set(records.filter(r=>r.entryReachable&&(r.opcode===64||r.opcode===72)).map(r=>dialogueOperand(r).textId));check(table.status==='valid'?table.reason===null&&table.declared===texts.length:!!table.reason&&texts.length===0);
 for(let i=0;i<texts.length;i++){const t=object(texts[i],'id offset bytes status reason body');check(t.id===i&&int(t.offset,table.at+2+2*texts.length,table.end-1)&&(!i||t.offset>texts[i-1].offset)&&['valid','unavailable'].includes(t.status));check(t.status==='valid'?t.reason===null&&int(t.bytes,1,table.end-t.offset):t.bytes===null&&['unknown_character','truncated_control','unknown_control','no_terminator','text_pointer_operand'].includes(t.reason));if(t.bytes!==null)check(t.offset+t.bytes<=table.end);
  if(t.body!==null){check(mode==='with-text'&&refs.has(i)&&t.status==='valid'&&typeof t.body==='string'&&t.body.length===t.bytes*2);const b=dialogueBytes(t.body);check(dialogueTokens(b).consumed===b.length);}
  if(mode==='with-text'&&refs.has(i)&&t.status==='valid')check(t.body!==null);
 }
 return s as DialogueScene;
}
export async function openFieldDialogue(file:File,fields:FieldPack,contextSHA256:string){
 check(file.name===DIALOGUE_FILE&&int(file.size,16,DIALOGUE_LIMITS.pack));const first=await file.slice(0,16).arrayBuffer();check(first.byteLength===16);const v=new DataView(first),length=v.getUint32(12,true);check(new TextDecoder().decode(first.slice(0,8))==='GAIADLG\0'&&[1,2].includes(v.getUint32(8,true))&&int(length,1,DIALOGUE_LIMITS.metadata)&&16+length<=file.size);
 const m=object(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await file.slice(16,16+length).arrayBuffer())),'schema version generator_revision decoder sourceLanguage mode sources contextSHA256 coverage scenes');check(m.schema==='gaiagis-field-dialogue'&&m.version===v.getUint32(8,true)&&m.sourceLanguage==='en'&&['metadata-only','with-text'].includes(m.mode)&&m.contextSHA256===contextSHA256&&hash(contextSHA256));
 const decoder=checkCFG(m,'field-dialogue',fields);if(m.version===1)check(m.decoder===DIALOGUE_DECODER);
 const sources=object(m.sources,'flevel.lgp maplist');check(sources.maplist==='d6ac24b79403a77feeb338450b7cb2169cdbcfa5d071a6cee4884e93b700bc29'&&sources['flevel.lgp']==='af695ccf7c681be222f5f716758160e39469ec02bc0af3dd6f20a5e9c2a34807'&&fields.archive==='flevel.lgp'&&Object.entries(sources).every(([k,h])=>hash(h)&&h===fields.sources[k]));const scenes=new Map<number,DialogueSpan>();let end=0;
 for(const value of list(m.scenes,2000)){const s=object(value,'fieldId name memberSHA256 section1SHA256 section8SHA256 section5SHA256 offset bytes rawBytes sha256');check(int(s.fieldId)&&!scenes.has(s.fieldId)&&fields.nodes.some(n=>n.id===s.fieldId&&n.name===s.name&&n.status==='available')&&[s.memberSHA256,s.section1SHA256,s.section8SHA256,s.sha256].every(hash)&&(s.section5SHA256===null||hash(s.section5SHA256))&&s.offset===end&&int(s.bytes,1,DIALOGUE_LIMITS.scene)&&int(s.rawBytes,1,DIALOGUE_LIMITS.scene));end+=s.bytes;scenes.set(s.fieldId,s as DialogueSpan);}
 check(16+length+end===file.size&&scenes.size===fields.nodes.filter(n=>n.status==='available').length);check(m.coverage&&typeof m.coverage==='object'&&Object.values(m.coverage).every(v=>int(v,0,1_000_000))&&m.coverage.fields===scenes.size);
 return {decoder,sources:sources as Record<string,string>,contextSHA256,mode:m.mode as 'metadata-only'|'with-text',coverage:m.coverage as Record<string,number>,scenes,async decode(id:number,signal?:AbortSignal){signal?.throwIfAborted();const s=scenes.get(id);check(s);const raw=await inflateVisual(await file.slice(16+length+s.offset,16+length+s.offset+s.bytes).arrayBuffer(),s.rawBytes,signal);signal?.throwIfAborted();check(await byteHash(raw)===s.sha256);return parseDialogueScene(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)),s,m.mode,decoder);}};
}
const requestIndexes=new WeakMap<DialogueScene,{targets:Map<number,{target:InteractionOwner|null;records:DialogueRecord[]}>;incoming:Map<number,DialogueRecord[]>}>();
function requestIndex(scene:DialogueScene){let index=requestIndexes.get(scene);if(index)return index;const tables=new Map<string,number>();scene.entries.forEach((e,i)=>{if(e.kind==='table')tables.set(e.actor+'/'+e.slot,i);});const messages=new Map<number,DialogueRecord[]>();for(const r of scene.records)if(r.entryReachable&&(r.opcode===64||r.opcode===72))for(const id of r.owners){const rows=messages.get(id)??[];rows.push(r);messages.set(id,rows);}const targets=new Map<number,{target:InteractionOwner|null;records:DialogueRecord[]}>(),incoming=new Map<number,DialogueRecord[]>();
 for(const r of scene.records)if(r.entryReachable&&r.opcode<=3){const o=dialogueOperand(r),id=tables.get(o.targetActor+'/'+o.slot),records=id===undefined?[]:messages.get(id)??[],target=id===undefined?null:scene.entries[id];targets.set(r.offset,{target,records});for(const message of records){const rows=incoming.get(message.offset)??[];rows.push(r);incoming.set(message.offset,rows);}}
 index={targets,incoming};requestIndexes.set(scene,index);return index;
}
export function requestDialogues(scene:DialogueScene,request:DialogueRecord){return requestIndex(scene).targets.get(request.offset)??{target:null,records:[]};}
export function incomingDialogueRequests(scene:DialogueScene,record:DialogueRecord){return requestIndex(scene).incoming.get(record.offset)??[];}
/** Bounded proof for this selected record/entry only. No values or cross-Actor calls. */
export function dialogueGuards(scene:DialogueScene,record:DialogueRecord,entry:number,budget=80_000){
 if(scene.status!=='complete'||!record.entryReachable||!record.owners.some(i=>scene.entries[i].entry===entry))return {status:'incomplete',proofs:[]};
 const nodes=new Map(scene.cfg.map(n=>[n[0],n.slice(4)]));let work=0;const reach=(start:number,skip=-1)=>{const seen=new Set<number>(),todo=[start];for(const pc of todo){if(pc===skip||seen.has(pc))continue;if(++work>budget)throw Error('budget');seen.add(pc);for(const next of nodes.get(pc)??[])if(!seen.has(next))todo.push(next);}return seen;};const proofs:DialogueRecord[]=[];
 try{for(const r of scene.records){if(r.opcode<20||r.opcode>25||!r.owners.some(i=>scene.entries[i].entry===entry))continue;const s=nodes.get(r.offset)??[];if(s.length!==2)continue;if(reach(s[0]).has(record.offset)===reach(s[1]).has(record.offset)||reach(entry,r.offset).has(record.offset))continue;proofs.push(r);}}catch{return {status:'limited',proofs};}return {status:'complete',proofs};
}
