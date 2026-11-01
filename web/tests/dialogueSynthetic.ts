// SPDX-License-Identifier: GPL-3.0-only
import type {DialogueScene} from '../src/data/fieldDialogue';
export const dialogueHash='a'.repeat(64);
/** Original synthetic dialogue/CFG; never copied from a game member. */
export function syntheticDialogue():DialogueScene{
 const entries=[{actor:0,name:'ACT',slot:1,entry:106,kind:'table' as const},{actor:0,name:'ACT',slot:2,entry:106,kind:'table' as const},{actor:0,name:'ACT',slot:3,entry:119,kind:'table' as const},{actor:0,name:'ACT',slot:4,entry:130,kind:'table' as const}];
 const cfg=[[106,7,72,1,113],[113,6,20,1,119,129],[119,3,64,1,122],[122,1,0,1],[123,3,64,0,126],[126,1,0,0],[127,1,0,0],[128,1,0,0],[129,1,0,1],[130,3,3,1,133],[133,1,0,1]];
 return {fieldId:0,name:'synth',memberSHA256:dialogueHash,section1SHA256:dialogueHash,section8SHA256:dialogueHash,section5SHA256:dialogueHash,section1Bytes:160,status:'complete',codeStart:106,codeEnd:134,entries,cfg,
 records:[{offset:106,opcode:72,raw:'48050000000107',entryReachable:true,owners:[0,1]},{offset:113,opcode:20,raw:'14500702000b',entryReachable:true,owners:[0,1]},{offset:119,opcode:64,raw:'400001',entryReachable:true,owners:[0,1,2]},{offset:123,opcode:64,raw:'400000',entryReachable:false,owners:[]},{offset:130,opcode:3,raw:'0300c1',entryReachable:true,owners:[3]}],stops:[],uncoveredBytes:0,textTable:{status:'valid',reason:null,at:134,end:160,declared:3,texts:[{id:0,offset:142,bytes:2,status:'valid',reason:null,body:'21ff'},{id:1,offset:144,bytes:2,status:'valid',reason:null,body:'22ff'},{id:2,offset:146,bytes:2,status:'valid',reason:null,body:null}]}};
}
export const syntheticSpan=(s:DialogueScene)=>({fieldId:s.fieldId,name:s.name,memberSHA256:s.memberSHA256,section1SHA256:s.section1SHA256,section8SHA256:s.section8SHA256,section5SHA256:s.section5SHA256,offset:0,bytes:10,rawBytes:100,sha256:dialogueHash});
