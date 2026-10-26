// SPDX-License-Identifier: GPL-3.0-only
import {archiveKey,assertSourceAgreement,gameArchives} from './sourceRoles';
import type {FieldPack} from './fieldContext';
import bossProfiles from '../../../src/gaiagis/atlas_data/boss-evidence.json';

export const GAMEPLAY_FILE='gaia-gameplay.json',GAMEPLAY_LIMIT=20_000_000;
export interface GameplayOperand {name:string;kind:'literal'|'variable';bank:number|null;value:number;}
export interface GameplayOwner {actor:number;name:string|null;slot:number;entry:number;kind:'table'|'main';}
export interface GameplayRecord {id:string;kind:'item'|'materia'|'battle'|'flag';offset:number;opcode:number;raw:string;owners:GameplayOwner[];operands:GameplayOperand[];status:'static'|'unknown';position:null;flagLinks:never[];}
export interface GameplayScene {fieldId:number;name:string;status:'indexed'|'empty'|'partial'|'unavailable';memberSHA256:string|null;section1SHA256:string|null;section1Bytes:number;records:GameplayRecord[];stops:{offset:number|null;opcode:number|null;reason:string;entryReachable:boolean}[];reason:string|null;}
export interface GameplayEnemy {id:number;sceneId:number;slot:number;name:string;nameStatus:string;level:number;hp:number;mp:number;sourceOffset:number;}
export interface GameplayFormation {id:number;battleId:number;sceneId:number;slot:number;enemyIds:number[];status:string;}
export interface GameplayLink {battleId:number|null;formationId:number|null;fieldId?:number;recordId?:string;eventId?:string|null;sourceKind?:string;[key:string]:unknown;}
export interface GameplayBoss {entityId:string;fieldId:number;fieldName:string;recordId:string;formationId:number;sceneId:number;enemyId:number;memberSHA256:string;section1SHA256:string;sceneSHA256:string;sources:string[];evidence:'reviewed_static_profile';}
export interface GameplayPack {schema:'gaiagis-gameplay';version:1;generator_revision:'gameplay-1';sourceLanguage:string;sources:Record<string,string>;contextSHA256:string;atlasContentSHA256:string;
 field:{scenes:GameplayScene[];coverage:Record<string,number>};battle:{scenes:{id:number;sha256:string;enemyIds:number[]}[];formations:GameplayFormation[];enemies:GameplayEnemy[];names:{items:{id:number;name:string}[];materia:{id:number;name:string}[]};coverage:Record<string,number>;[key:string]:unknown};
 links:{worldBattles:GameplayLink[];fieldBattles:GameplayLink[];encounters:GameplayLink[];[key:string]:unknown};atlasLinks:{entityId:string;fieldIds:number[];relation:string}[];bossMappings:GameplayBoss[];
}
const hash=(x:unknown):x is string=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const integer=(x:unknown,min=0,max=Number.MAX_SAFE_INTEGER):x is number=>Number.isSafeInteger(x)&&Number(x)>=min&&Number(x)<=max;
function check(condition:unknown,message='Gameplay evidence validation'):asserts condition {if(!condition)throw Error(message);}
const list=(x:unknown,max:number):any[]=>{check(Array.isArray(x)&&x.length<=max);return x as any[];};
const text=(x:unknown,max=200):x is string=>typeof x==='string'&&x.length<=max&&!/[\x00-\x1f]/.test(x);
/** Independent fixed-width operands; does not evaluate banks or execute a script. */
export function gameplayOperands(raw:Uint8Array):GameplayOperand[]{
 const op=raw[0],length=({88:5,91:7,112:4,128:4,130:4,131:4} as Record<number,number>)[op];check(length&&raw.length===length,'Gameplay opcode width');
 const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),out:GameplayOperand[]=[];
 const add=(name:string,at:number,size:number,bank:number,target=false)=>out.push({name,kind:target||bank?'variable':'literal',bank,value:size===2?view.getUint16(at,true):raw[at]});
 const a=raw[1]>>4,b=raw[1]&15;
 if(op===88){add('item',2,2,a);add('quantity',4,1,b);}
 else if(op===91){add('materia',3,1,a);add('ap0',4,1,b);add('ap1',5,1,raw[2]>>4);add('ap2',6,1,raw[2]&15);}
 else if(op===112)add('formation',2,2,b);
 else {add('target',2,1,a,true);add(op===128?'value':'bit',3,1,b);}
 return out;
}
/** Optional private asset, pinned to the actual current Context and archive pair. */
export function parseGameplay(value:unknown,fields:FieldPack,contextSHA256:string,atlasSHA256:string):GameplayPack{
 const p=value as GameplayPack;check(p&&p.schema==='gaiagis-gameplay'&&p.version===1&&p.generator_revision==='gameplay-1');
 check(hash(p.contextSHA256)&&p.contextSHA256===contextSHA256&&hash(p.atlasContentSHA256)&&p.atlasContentSHA256===atlasSHA256,'Gameplay Context/Atlas fingerprint mismatch');
 check(p.sources&&Object.entries(p.sources).every(([k,v])=>/^[a-z0-9_.-]{1,100}$/.test(k)&&!['__proto__','constructor','prototype'].includes(k)&&hash(v)));
 assertSourceAgreement(fields.sources,p.sources);const key=archiveKey(fields.sources,'field')!;check(p.sources[key]===fields.sources[key]&&p.sources.maplist===fields.sources.maplist,'Gameplay Field source identity mismatch');
 check(Object.entries(gameArchives).some(([language,pair])=>language===p.sourceLanguage&&pair[1]===key),'Gameplay language mismatch');
 const fieldIds=new Set<number>(),recordIds=new Set<string>(),recordMap=new Map<string,{scene:GameplayScene;record:GameplayRecord}>();let records=0;
 for(const s of list(p.field?.scenes,2000)){
  check(integer(s.fieldId,0,65535)&&!fieldIds.has(s.fieldId)&&fields.nodes.some(n=>n.id===s.fieldId&&n.name===s.name),'Gameplay Field identity mismatch');fieldIds.add(s.fieldId);
  check(['indexed','empty','partial','unavailable'].includes(s.status)&&integer(s.section1Bytes,0,2_000_000));
  check(s.memberSHA256===null||hash(s.memberSHA256));check(s.section1SHA256===null||hash(s.section1SHA256));
  const stops=list(s.stops,65536);check(stops.every(r=>text(r.reason)&&typeof r.entryReachable==='boolean'));
  for(const r of list(s.records,4096)){
   check(++records<=150_000&&r.id===`${s.fieldId}:${r.offset}`&&!recordIds.has(r.id)&&integer(r.offset,0,s.section1Bytes-1)&&text(r.raw,14)&&/^(?:[a-f0-9]{2})+$/.test(r.raw));recordIds.add(r.id);recordMap.set(r.id,{scene:s,record:r});
   const raw=Uint8Array.from(r.raw.match(/../g)!, (x:string)=>parseInt(x,16)),expected=gameplayOperands(raw);check(raw[0]===r.opcode&&r.offset+raw.length<=s.section1Bytes);
   check(r.kind===({88:'item',91:'materia',112:'battle',128:'flag',130:'flag',131:'flag'} as Record<number,string>)[r.opcode]);
   check(Array.isArray(r.operands)&&r.operands.length===expected.length&&expected.every((o,i)=>['name','kind','bank','value'].every(k=>r.operands[i][k]===o[k as keyof GameplayOperand])),'Gameplay operands mismatch');
   check(r.position===null&&Array.isArray(r.flagLinks)&&r.flagLinks.length===0,'Unsupported gameplay position/claim flag');
   check(r.status==='unknown'||r.status==='static'&&s.status==='indexed'&&!stops.length&&r.kind!=='flag'&&expected.every(o=>o.kind==='literal'),'Incomplete CFG cannot prove a static grant');
   check(list(r.owners,2112).length>0&&r.owners.every((o:GameplayOwner)=>integer(o.actor,0,255)&&integer(o.slot,0,31)&&integer(o.entry,0,s.section1Bytes-1)&&['table','main'].includes(o.kind)&&(o.name===null||text(o.name))));
  }
 }
 check(fieldIds.size===fields.nodes.length,'Gameplay missing Field identities');
 const sceneIds=new Set<number>();for(const s of list(p.battle?.scenes,256)){check(integer(s.id,0,255)&&!sceneIds.has(s.id)&&hash(s.sha256));sceneIds.add(s.id);}
 if(sceneIds.size)check(hash(p.sources['scene.bin']),'Battle source identity missing');
 const enemyKeys=new Set<string>();for(const e of list(p.battle.enemies,768)){const k=`${e.sceneId}/${e.id}`;check(sceneIds.has(e.sceneId)&&integer(e.id,0,65534)&&!enemyKeys.has(k)&&integer(e.slot,0,2)&&text(e.name)&&integer(e.level,0,255)&&integer(e.hp,0,0xffffffff)&&integer(e.mp,0,65535)&&integer(e.sourceOffset,0,0x1e80));enemyKeys.add(k);}
 const formationIds=new Set<number>();for(const f of list(p.battle.formations,1024)){check(sceneIds.has(f.sceneId)&&integer(f.slot,0,3)&&f.id===f.sceneId*4+f.slot&&f.battleId===f.id&&!formationIds.has(f.id)&&['parsed','empty','unresolved_enemy'].includes(f.status));formationIds.add(f.id);check(list(f.enemyIds,6).every(id=>integer(id,0,65534)&&(f.status!=='parsed'||enemyKeys.has(`${f.sceneId}/${id}`))),'Formation Enemy identity mismatch');check(f.status!=='empty'||!f.enemyIds.length);}
 for(const rows of [p.battle.names?.items,p.battle.names?.materia]){const ids=new Set<number>();for(const n of list(rows,2048)){check(integer(n.id,0,65535)&&!ids.has(n.id)&&text(n.name));ids.add(n.id);}}
 for(const rows of [p.links?.worldBattles,p.links?.fieldBattles,p.links?.encounters])for(const l of list(rows,100_000)){check((l.battleId===null||integer(l.battleId,0,65535))&&(l.formationId===null||l.formationId===l.battleId&&formationIds.has(l.formationId)));if(l.recordId!==undefined)check(recordIds.has(l.recordId));}
 for(const l of p.links.fieldBattles){const row=l.recordId?recordMap.get(l.recordId):null;check(row&&row.scene.fieldId===l.fieldId&&row.record.kind==='battle'&&l.sourceKind==='field_script','Field battle source mismatch');const o=row.record.operands[0],literal=row.record.status==='static'&&o.kind==='literal'?o.value:null;check(l.battleId===literal&&(l.formationId===null||literal===l.formationId),'Unverified Field battle association');}
 for(const l of list(p.atlasLinks,2000))check(text(l.entityId,100)&&list(l.fieldIds,2000).every(id=>fieldIds.has(id))&&['authored_scene','verified_entrance_field'].includes(l.relation));
 const bossIds=new Set<string>();for(const m of list(p.bossMappings,2)){
  const profile=bossProfiles.find(x=>x.entityId===m.entityId),row=recordMap.get(m.recordId),f=p.battle.formations.find(f=>f.id===m.formationId),e=p.battle.enemies.find(e=>e.sceneId===m.sceneId&&e.id===m.enemyId),scene=p.battle.scenes.find(s=>s.id===m.sceneId);
  check(p.sourceLanguage==='en'&&profile&&!bossIds.has(m.entityId)&&m.evidence==='reviewed_static_profile','Unreviewed Boss semantics');bossIds.add(m.entityId);
  check(['entityId','fieldId','fieldName','recordId','formationId','sceneId','enemyId','memberSHA256','section1SHA256','sceneSHA256'].every(k=>m[k]===profile[k as keyof typeof profile])&&JSON.stringify(m.sources)===JSON.stringify(profile.sources),'Boss profile fingerprint mismatch');
  check(row&&row.scene.status==='indexed'&&!row.scene.stops.length&&row.scene.fieldId===m.fieldId&&row.scene.name===m.fieldName&&row.scene.memberSHA256===m.memberSHA256&&row.scene.section1SHA256===m.section1SHA256&&row.record.kind==='battle'&&row.record.status==='static'&&row.record.operands[0].kind==='literal'&&row.record.operands[0].value===m.formationId,'Boss Field proof mismatch');
  check(row.record.owners.length===1&&['actor','name','slot','entry','kind'].every(k=>row.record.owners[0][k as keyof GameplayOwner]===profile.owner[k as keyof typeof profile.owner]),'Boss Actor proof mismatch');
  check(scene?.sha256===m.sceneSHA256&&f?.status==='parsed'&&f.sceneId===m.sceneId&&f.enemyIds.length===1&&f.enemyIds[0]===m.enemyId&&e?.name===profile.enemyName&&e.nameStatus==='decoded','Boss Formation proof mismatch');
 }
 return p;
}
export class GameplayIndex {
 readonly scenes=new Map<number,GameplayScene>();readonly formations=new Map<number,GameplayFormation>();readonly enemies=new Map<string,GameplayEnemy>();readonly records=new Map<string,{scene:GameplayScene;record:GameplayRecord}>();
 readonly items=new Map<number,string>();readonly materia=new Map<number,string>();
 constructor(readonly pack:GameplayPack){for(const s of pack.field.scenes){this.scenes.set(s.fieldId,s);for(const r of s.records)this.records.set(r.id,{scene:s,record:r});}for(const f of pack.battle.formations)this.formations.set(f.id,f);for(const e of pack.battle.enemies)this.enemies.set(`${e.sceneId}/${e.id}`,e);for(const n of pack.battle.names.items)this.items.set(n.id,n.name);for(const n of pack.battle.names.materia)this.materia.set(n.id,n.name);}
 guideIds(fieldIds:number[]){return [...new Set([...this.pack.atlasLinks,...this.pack.bossMappings.map(m=>({entityId:m.entityId,fieldIds:[m.fieldId]}))].filter(l=>l.fieldIds.some(id=>fieldIds.includes(id))).map(l=>l.entityId))];}
}
