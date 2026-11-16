// SPDX-License-Identifier: GPL-3.0-only
// Original byte-level examples only; no shipped dialogue, coordinates or archive data.
import {FieldIndex} from '../src/data/fieldContext';
import {GameplayIndex,gameplayOperands} from '../src/data/gameplay';
import {CMUSC8_CFG} from '../src/data/fieldProvenance';
import type {DialogueResource,DialogueRecord} from '../src/data/fieldDialogue';
import type {GameplayRecord,GameplayScene,GameplayPack} from '../src/data/gameplay';
import type {InteractionOwner} from '../src/data/fieldInteraction';
import type {FieldEventInput} from '../src/analysis/fieldEventEvidence';

export interface SyntheticInstruction {offset:number;bytes:number[];next:number[];}
export const instruction=(offset:number,bytes:number[],...next:number[]):SyntheticInstruction=>({offset,bytes,next});
export const entry=(offset:number,actor=0,slot=0):InteractionOwner=>({actor,name:'SYNTH',slot,entry:offset,kind:'table'});
export const syntheticHash=(digit:string)=>digit.repeat(64);
const source={'flevel.lgp':'af695ccf7c681be222f5f716758160e39469ec02bc0af3dd6f20a5e9c2a34807',maplist:'d6ac24b79403a77feeb338450b7cb2169cdbcfa5d071a6cee4884e93b700bc29'};
const dialogueOps=new Set([1,2,3,20,21,22,23,24,25,64,72]),gameplayOps=new Set([88,91,112,128,130,131]);
export function conditionalFixture(instructions:SyntheticInstruction[]=[
 instruction(32,[20,16,5,0,0,6],38,43),instruction(38,[64,0,0],41),instruction(41,[16,4],46),
 instruction(43,[64,0,1],46),instruction(46,[64,0,2],49),instruction(49,[0]),
],entries:InteractionOwner[]=[entry(32)],stops:{offset:number;opcode:number;reason:'unsupported_opcode'|'unverified_boundary'}[]=[]):FieldEventInput {
 const nodes=[...instructions].sort((a,b)=>a.offset-b.offset),map=new Map(nodes.map(n=>[n.offset,n])),reach=entries.map(e=>{const seen=new Set<number>([e.entry]),todo=[e.entry];for(const pc of todo)for(const next of map.get(pc)?.next??[])if(!seen.has(next)){seen.add(next);todo.push(next);}return seen;});
 const ownerIds=(offset:number)=>reach.flatMap((set,i)=>set.has(offset)?[i]:[]),raw=(n:SyntheticInstruction)=>n.bytes.map(b=>b.toString(16).padStart(2,'0')).join('');
 const codeEnd=Math.max(...nodes.map(n=>n.offset+n.bytes.length),...stops.map(s=>s.offset+1)),covered=nodes.reduce((sum,n)=>sum+n.bytes.length,0),uncoveredBytes=codeEnd-32-covered;
 const fields=new FieldIndex({schema:'gaiagis-field-context',version:6,scriptDecoder:CMUSC8_CFG,coordinateSpace:'FieldLocalIdentity',archive:'flevel.lgp',sources:{...source},nodes:[{id:0,name:'synth',status:'available',saveId:null}],edges:[],exits:[],unresolved:[],bindings:[],scriptTransitions:'bounded_mapjump'});
 const records:DialogueRecord[]=nodes.filter(n=>dialogueOps.has(n.bytes[0])).map(n=>({offset:n.offset,opcode:n.bytes[0],raw:raw(n),entryReachable:!!ownerIds(n.offset).length,owners:ownerIds(n.offset)}));
 const dialogue:DialogueResource={sha256:syntheticHash('d'),sources:{...source},contextSHA256:syntheticHash('a'),generation:1,mode:'metadata-only',scene:{fieldId:0,name:'synth',memberSHA256:syntheticHash('b'),section1SHA256:syntheticHash('c'),section5SHA256:null,section8SHA256:syntheticHash('e'),section1Bytes:codeEnd,status:uncoveredBytes||stops.length?'partial':'complete',codeStart:32,codeEnd,uncoveredBytes,entries:entries.map(e=>({...e})),cfg:nodes.map(n=>[n.offset,n.bytes.length,n.bytes[0],Number(!!ownerIds(n.offset).length),...n.next]),records,stops:stops.map(s=>({...s,entryReachable:!!ownerIds(s.offset).length})),textTable:{status:'valid',reason:null,at:codeEnd,end:codeEnd,declared:0,texts:[]}}};
 const gameplayRecords:GameplayRecord[]=nodes.filter(n=>gameplayOps.has(n.bytes[0])&&ownerIds(n.offset).length).map(n=>{const opcode=n.bytes[0],operands=gameplayOperands(new Uint8Array(n.bytes)),kind=({88:'item',91:'materia',112:'battle'} as Record<number,GameplayRecord['kind']>)[opcode]??'flag';return {id:'0:'+n.offset,kind,offset:n.offset,opcode,raw:raw(n),owners:ownerIds(n.offset).map(i=>({...entries[i]})),operands,status:kind!=='flag'&&operands.every(o=>o.kind==='literal')?'static':'unknown',position:null,flagLinks:[]};});
 const gs:GameplayScene={fieldId:0,name:'synth',status:gameplayRecords.length?'indexed':'empty',memberSHA256:dialogue.scene.memberSHA256,section1SHA256:dialogue.scene.section1SHA256,section1Bytes:codeEnd,records:gameplayRecords,stops:[],reason:null};
 const pack:GameplayPack={schema:'gaiagis-gameplay',version:2,generator_revision:'gameplay-2',decoder:CMUSC8_CFG,sourceLanguage:'en',sources:{...source},contextSHA256:syntheticHash('a'),atlasContentSHA256:syntheticHash('f'),field:{scenes:[gs],coverage:{}},battle:{scenes:[],formations:[],enemies:[],names:{items:[],materia:[]},coverage:{}},links:{worldBattles:[],fieldBattles:[],encounters:[]},atlasLinks:[],bossMappings:[]};
 return {fields,fieldId:0,contextSHA256:syntheticHash('a'),walkmeshSHA256:syntheticHash('f'),meshSHA256:syntheticHash('f'),generation:1,mesh:null,dialogue,gameplay:{index:new GameplayIndex(pack),sha256:syntheticHash('f'),contextSHA256:syntheticHash('a'),generation:1}};
}
