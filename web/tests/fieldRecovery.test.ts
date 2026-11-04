// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect,vi} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {FieldIndex,parseFieldPack,openWalkmeshPack} from '../src/data/fieldContext';
import type {FieldPack} from '../src/data/fieldContext';
import {CMUSC8_CFG,LEGACY_CFG,EN_FIELD_SHA,EN_MAPLIST_SHA,checkCFG,fieldDecoder} from '../src/data/fieldProvenance';
import {openFieldDialogue} from '../src/data/fieldDialogue';
import {openFieldInteraction} from '../src/data/fieldInteraction';
import {openFieldScriptEvidence} from '../src/data/fieldScriptEvidence';
import {parseGameplay,GameplayIndex} from '../src/data/gameplay';
import {preflightFieldCFG,WorkspaceLoader,parseManifest,fileHash} from '../src/app/workspace';
import {createFieldEventIndex} from '../src/analysis/fieldEventEvidence';
import {FieldGatewayNetwork} from '../src/analysis/fieldGateway';
const hash=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const sources={'flevel.lgp':EN_FIELD_SHA,maplist:EN_MAPLIST_SHA};
const legacy={version:3,sources},recovered={version:6,scriptDecoder:CMUSC8_CFG as typeof CMUSC8_CFG,sources};
describe('explicit Field CFG profiles',()=>{
 it('does not promote legacy by language or an unchanged Section hash',()=>{expect(fieldDecoder(legacy)).toBe(LEGACY_CFG);expect(fieldDecoder(recovered)).toBe(CMUSC8_CFG);expect(()=>fieldDecoder({...recovered,sources:{...sources,'flevel.lgp':'a'.repeat(64)}})).toThrow();expect(()=>fieldDecoder({...recovered,sources:{...sources,maplist:'a'.repeat(64)}})).toThrow();});
 it.each(['field-interaction','field-script-evidence','field-dialogue','gameplay'])('rejects both directions of mixed %s CFG provenance',kind=>{
  const old={version:1,generator_revision:kind+'-1'},next={version:2,generator_revision:kind+'-2',decoder:CMUSC8_CFG};
  expect(checkCFG(old,kind,legacy)).toBe(LEGACY_CFG);expect(checkCFG(next,kind,recovered)).toBe(CMUSC8_CFG);
  expect(()=>checkCFG(old,kind,recovered)).toThrow();expect(()=>checkCFG(next,kind,legacy)).toThrow();expect(()=>checkCFG({...next,decoder:LEGACY_CFG},kind,recovered)).toThrow();
 });
 it('does not adopt geometry or destroy the prior session on a missing declared new CFG member',async()=>{
  const context={schema:'gaiagis-field-context',version:6,scriptDecoder:CMUSC8_CFG as typeof CMUSC8_CFG,coordinateSpace:'FieldLocalIdentity',archive:'flevel.lgp',sources:{...sources,'world_us.lgp':'a'.repeat(64),'wm0.map':'a'.repeat(64),'wm0.ev':'a'.repeat(64),'field.tbl':'a'.repeat(64)},nodes:[],edges:[],exits:[],unresolved:[],bindings:[],scriptTransitions:'bounded_mapjump',scriptEdges:[],scriptExits:[],scriptUnresolved:[],nativeRelations:[],entrances:[],gateways:[],section1Recoveries:[]};
  // Field Context requires 128 table entries for v3+, so use a genuine old
  // Context when available for the adoption gate below instead of fake geometry.
  expect(()=>checkCFG({version:1,generator_revision:'field-interaction-1'},'field-interaction',context)).toThrow();
  const adopt=vi.fn(),loader=new WorkspaceLoader(()=>{});loader.register('geometry',adopt);
  const files=[new File(['{}'],'gaia-meta.json'),new File([new Uint8Array(16)],'gaia-mesh.bin'),new File([JSON.stringify(context)],'gaia-field-context.json'),new File(['{}'],'gaia-field-interaction.bin')];
  await loader.load(files);expect(adopt).not.toHaveBeenCalled();
 });
});
const live=new URL('../../output/local-workspace/',import.meta.url),candidate=new URL('../../output/local-workspace/.build/field-cfg-candidate/',import.meta.url);
const selected=existsSync(new URL('gaia-field-context.json',candidate))?candidate:live;
const available=existsSync(new URL('gaia-field-dialogue.bin',selected))&&existsSync(new URL('gaia-field-context.json',selected))&&JSON.parse(readFileSync(new URL('gaia-field-context.json',selected)).toString()).scriptDecoder===CMUSC8_CFG;
describe.skipIf(!available)('private recovered EN CFG group (no text in test output)',()=>{
 it('strictly reads all new formats, preserved source geometry and recovered references',async()=>{
  const bytes=(name:string)=>readFileSync(new URL(name,existsSync(new URL(name,selected))?selected:live));
  const file=(name:string)=>new File([bytes(name)],name),context=bytes('gaia-field-context.json'),fields=parseFieldPack(JSON.parse(context.toString())),contextSHA=hash(context);
  expect(fields.scriptDecoder).toBe(CMUSC8_CFG);expect(fields.version).toBe(6);
  const dialogue=await openFieldDialogue(file('gaia-field-dialogue.bin'),fields,contextSHA),interaction=await openFieldInteraction(file('gaia-field-interaction.bin'),fields,contextSHA),script=await openFieldScriptEvidence(file('gaia-field-script-evidence.bin'),fields,contextSHA);
  expect(dialogue.coverage).toMatchObject({MESSAGE:13126,ASK:904,complete:702,MESSAGE_unreachable:44,ASK_unreachable:4,validTables:697,textBodies:12437,texts:56046});
  const gp=parseGameplay(JSON.parse(bytes('gaia-gameplay.json').toString()),fields,contextSHA,hash(readFileSync(new URL('../../src/gaiagis/atlas_data/content.json',import.meta.url),'utf8').replace(/\r\n/g,'\n')));
  expect(gp.field.coverage).toMatchObject({records:13267,partial:0,unavailable:20,staticItem:458,staticMateria:178,staticBattle:202});
  expect(gp.field.scenes.flatMap(s=>s.records).every(r=>r.position===null&&r.flagLinks.length===0)).toBe(true);
  const battle=gp.field.scenes.find(s=>s.fieldId===612)!.records.find(r=>r.offset===2165)!;expect(battle.raw).toBe('70008c02');expect(gp.links.fieldBattles.find(r=>r.recordId===battle.id)).toMatchObject({status:'matched',formationId:652});
  const wm=await openWalkmeshPack(file('gaia-field-walkmesh.bin'),fields),index=new FieldIndex(fields);
  for(const [id,offset,opcode] of [[199,1888,64],[343,2117,64],[345,13631,72]]){
   const d=await dialogue.decode(id),s=await script.decode(id),mesh=await wm.decode(id),i=await interaction.decode(id,mesh);
   expect(d.status).toBe('complete');expect(d.records.find(r=>r.offset===offset)?.opcode).toBe(opcode);expect(s.stops).toEqual([]);expect(i.stops).toEqual([]);
   const event=createFieldEventIndex({fields:index,fieldId:id,contextSHA256:contextSHA,walkmeshSHA256:hash(bytes('gaia-field-walkmesh.bin')),meshSHA256:i.section5SHA256!,generation:1,mesh,interaction:{scene:i,sha256:hash(bytes('gaia-field-interaction.bin')),sources:interaction.sources,decoder:interaction.decoder,contextSHA256:interaction.contextSHA256},script:{scene:s,sha256:hash(bytes('gaia-field-script-evidence.bin')),sources:script.sources,decoder:script.decoder,contextSHA256:script.contextSHA256},dialogue:{scene:d,sha256:hash(bytes('gaia-field-dialogue.bin')),sources:dialogue.sources,contextSHA256:contextSHA,generation:1,mode:dialogue.mode},gameplay:{index:new GameplayIndex(gp),sha256:hash(bytes('gaia-gameplay.json')),contextSHA256:contextSHA,generation:1}});
   expect(event.problems).toEqual([]);expect(event.query({channel:'dialogue',offset})[0].candidates).toEqual([]);
  }
  expect((await dialogue.decode(155)).textTable.texts[49]).toMatchObject({status:'unavailable',reason:'no_terminator',body:null});
  for(const id of [281,285,723,724,777])expect((await dialogue.decode(id)).textTable.status).toBe('unavailable');
  const solver=new FieldGatewayNetwork({index,pack:wm,poi:null,identity:{contextSHA256:contextSHA,walkmeshSHA256:hash(bytes('gaia-field-walkmesh.bin')),generation:1,archive:fields.archive,sources:fields.sources},current:()=>true});
  try{const result=await solver.solve({kind:'arrival',fromField:195,gateway:5},198,1);expect(result.status).toBe('success');expect(result.states[0].triangle).toBe(2);}finally{solver.dispose();}
 },60000);
 it('rejects old evidence on new Context before adoption and accepts a consistent old group',async()=>{
  const make=(name:string,root:URL)=>new File([readFileSync(new URL(name,root))],name),ctx=readFileSync(new URL('gaia-field-context.json',selected)),contextFile=new File([ctx],'gaia-field-context.json');
  const files=new Map([contextFile,...['gaia-field-interaction.bin','gaia-field-script-evidence.bin','gaia-gameplay.json','gaia-field-dialogue.bin'].map(n=>make(n,selected))].map(f=>[f.name,f]));
  await expect(preflightFieldCFG({files,manifest:null,issues:{}})).resolves.toBeUndefined();
  const manifest=parseManifest(JSON.parse(readFileSync(new URL('gaia-workspace.json',selected)).toString()));
  const missing=new Map(files);missing.delete('gaia-field-script-evidence.bin');
  await expect(preflightFieldCFG({files:missing,manifest,issues:{'field-script-evidence':{status:'missing',bytes:0}}})).rejects.toThrow();
  const adopt=vi.fn(),loader=new WorkspaceLoader(()=>{});loader.register('geometry',adopt);
  const wrong=new Map(files);wrong.set('gaia-field-interaction.bin',new File(['{}'],'gaia-field-interaction.bin'));
  await loader.load([...wrong.values(),new File(['{}'],'gaia-meta.json'),new File([new Uint8Array(16)],'gaia-mesh.bin')]);
  expect(adopt).not.toHaveBeenCalled();
  // A missing or checksum-failed declared Context must also stop adoption,
  // not skip the group gate and dispose the previous geometry/session.
  for(const mode of ['missing','checksum'] as const){
   const core=[new File(['{}'],'gaia-meta.json'),new File([new Uint8Array(16)],'gaia-mesh.bin')];
   const m={...manifest,assets:manifest.assets.filter(a=>a.filename==='gaia-field-context.json')};
   for(const f of core)m.assets.push({filename:f.name,type:f.name==='gaia-meta.json'?'metadata':'geometry',mapId:'WM0',sha256:await fileHash(f),bytes:f.size,dependencies:[]});
   const entry=m.assets.find(a=>a.filename==='gaia-field-context.json')!;entry.dependencies=[];
   if(mode==='checksum')entry.sha256='0'.repeat(64);
   const rejected:unknown[]=[],keep=vi.fn(),owner=new WorkspaceLoader((...args)=>rejected.push(args));owner.register('geometry',keep);
   await owner.load([...core,...(mode==='missing'?[]:[contextFile]),new File([JSON.stringify(m)],'gaia-workspace.json')]);
   expect(keep).not.toHaveBeenCalled();expect(rejected).toContainEqual(['field-context',expect.objectContaining({status:'incompatible'})]);
  }
  if(selected!==live&&JSON.parse(readFileSync(new URL('gaia-field-context.json',live)).toString()).version<6){
   for(const n of ['gaia-field-interaction.bin','gaia-field-script-evidence.bin','gaia-gameplay.json','gaia-field-dialogue.bin']){const mixed=new Map(files);mixed.set(n,make(n,live));await expect(preflightFieldCFG({files:mixed,manifest:null,issues:{}})).rejects.toThrow();}
   const old=new Map([...files.keys()].map(n=>[n,make(n,live)]));await expect(preflightFieldCFG({files:old,manifest:null,issues:{}})).resolves.toBeUndefined();
   old.delete('gaia-field-dialogue.bin');await expect(preflightFieldCFG({files:old,manifest:null,issues:{}})).resolves.toBeUndefined();
  }
 },30000);
});
