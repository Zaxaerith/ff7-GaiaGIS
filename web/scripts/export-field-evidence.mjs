// SPDX-License-Identifier: GPL-3.0-only
import {createHash} from 'node:crypto';
import {lstat,readFile,realpath} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadProduction} from './field-evidence-runtime.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const MAX_BYTES=8_000_000, MAX_ROWS=250_000;
const files={
 context:['gaia-field-context.json',8_000_000],walkmesh:['gaia-field-walkmesh.bin',32_000_000],
 interaction:['gaia-field-interaction.bin',8_000_000],dialogue:['gaia-field-dialogue.bin',16_000_000],
 gameplay:['gaia-gameplay.json',20_000_000],script:['gaia-field-script-evidence.bin',4_000_000],
};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
const owner=o=>[o.actor,o.kind,o.slot,o.entry];
const eventKind={1:'REQ',2:'REQSW',3:'REQEW',64:'MESSAGE',72:'ASK',88:'STITM',91:'SMTRA',112:'BATTLE'};
const rowTables=['script_actors','script_entries','script_entry_aliases','script_instructions','script_instruction_owners',
 'script_conditions','script_events','gameplay_events','dialogue_references','event_interaction_candidates','conditional_roots',
 'conditional_controls','ask_if_relations','request_edges','request_target_events'];
const emptyTables=()=>Object.fromEntries(rowTables.map(name=>[name,[]]));

async function bytesAt(folder,name,max){
 const path=join(folder,name),info=await lstat(path);
 if(!info.isFile()||await realpath(path)!==path||info.size<1||info.size>max)throw Error('source_file');
 const bytes=await readFile(path);
 if(bytes.length!==info.size)throw Error('source_size');
 return bytes;
}

function project(m,input,index,result){
 const tables=emptyTables(),scene=input.dialogue?.scene;
 const instructions=new Map(),aliases=new Map(),owners=new Map();
 const roots=new Map(result.roots.map(r=>[r.entry,r]));
 const addAlias=o=>aliases.set(JSON.stringify(owner(o)),owner(o));
 for(const o of scene?.entries??input.script?.scene.entries??[])addAlias(o);
 for(const row of scene?.cfg??[])instructions.set(row[0],row.slice());
 const textStatus=new Map((scene?.textTable.texts??[]).map(r=>[r.id,r]));
 const strictOffsets=new Set();
 const actorLines=new Map(),byLine=new Map();
 for(const row of index.rows){
  if(row.section!==1)continue;
  const r=row.record,source=instructions.get(row.offset);
  if(!source)instructions.set(row.offset,[row.offset,r.raw.length/2,r.opcode,Number(row.owners.length>0)]);
  else if(source[2]!==r.opcode||source[1]!==r.raw.length/2)throw Error('instruction_identity');
  for(const o of row.owners){
   addAlias(o);
   const keys=[row.offset,...owner(o)];
   owners.set(JSON.stringify(keys),keys);
  }
  if(row.channel==='dialogue'){
   const d=m.dialogue.dialogueOperand(r),entry=textStatus.get(d.textId);
   tables.dialogue_references.push([row.offset,row.kind,d.textId,scene.textTable.status,entry?.status??'unavailable',
    entry?.reason??(!entry?scene.textTable.reason??'missing_text_id':null),JSON.stringify(d)]);
  }
  if(row.channel==='condition')tables.script_conditions.push([row.offset,JSON.stringify(m.dialogue.dialogueOperand(r))]);
  if(row.channel==='gameplay')tables.gameplay_events.push([r.id,row.offset,r.kind,r.status,JSON.stringify(r.operands)]);
  if(eventKind[r.opcode]&&!strictOffsets.has(row.offset)){
   strictOffsets.add(row.offset);
   tables.script_events.push([row.offset,eventKind[r.opcode],Number(row.owners.length>0)]);
  }
  if(row.channel==='interaction'&&row.kind==='line'){
   byLine.set(row.offset,row);
   for(const actor of new Set(row.owners.map(o=>o.actor))){
    const group=actorLines.get(actor)??[];
    group.push(row.offset);actorLines.set(actor,group);
   }
  }
 }
 const entries=[...new Set([...aliases.values()].map(x=>x[3]))].sort((a,b)=>a-b);
 tables.script_actors=[...new Set([...aliases.values()].map(x=>x[0]))].sort((a,b)=>a-b).map(x=>[x]);
 tables.script_entries=entries.map(entry=>[entry,roots.get(entry)?.nodes??null,roots.get(entry)?.edges??null]);
 tables.script_entry_aliases=[...aliases.values()];
 const stops=new Set(scene?.stops.map(r=>r.offset)??[]);
 tables.script_instructions=[...instructions.values()].sort((a,b)=>a[0]-b[0]).map(([offset,width,op,reachable,a=null,b=null])=>
  [offset,width,op,reachable,a,b,instructions.has(a)&&!stops.has(a)?a:null,instructions.has(b)&&!stops.has(b)?b:null,
   !scene?'not_indexed':a!==null&&stops.has(a)||b!==null&&stops.has(b)?'unverified':'verified']);
 tables.script_instruction_owners=[...owners.values()];
 let candidateWork=0;
 for(const row of index.rows){
  if(row.section!==1||!strictOffsets.has(row.offset)||!['dialogue','request','gameplay'].includes(row.channel))continue;
  const exact=new Set(row.owners.map(m.events.eventOwnerKey));
  const lines=new Set();
  for(const actor of new Set(row.owners.map(o=>o.actor)))for(const line of actorLines.get(actor)??[]){
   if(++candidateWork>MAX_ROWS)throw Error('row_limit');lines.add(line);
  }
  for(const line of lines)tables.event_interaction_candidates.push([row.offset,input.fieldId,line,
   byLine.get(line).owners.some(o=>exact.has(m.events.eventOwnerKey(o)))?'same_entry':'same_actor']);
 }
 tables.conditional_roots=result.roots.map(r=>[r.entry,r.status,r.reason]);
 tables.conditional_controls=result.controls.map(r=>[r.root,r.ifOffset,r.successor,r.targetOffset,1,Number(r.strong),Number(r.core),JSON.stringify(r.basis)]);
 tables.ask_if_relations=result.askLinks.map(r=>[r.root,r.askOffset,r.ifOffset,r.bank,r.address,r.width,r.status,r.reason,JSON.stringify(r.corridor)]);
 tables.request_edges=result.requestLinks.map(r=>[r.sourceOffset,r.opcode,r.priority,r.targetActor,r.slot,r.targetEntry,r.status]);
 tables.request_target_events=result.requestLinks.flatMap(r=>r.targetEventOffsets.map(t=>[r.sourceOffset,t]));
 if(Object.values(tables).reduce((n,rows)=>n+rows.length,0)>MAX_ROWS)throw Error('row_limit');
 return tables;
}

async function exportEvidence(directory,fieldId,software,m){
 const known=await realpath(directory);
 if(known!==directory||!Number.isInteger(fieldId)||fieldId<0||fieldId>65535||!/^[0-9]+[.][0-9]+[.][0-9]+$/.test(software))throw Error('request');
 const manifestBytes=await bytesAt(known,'gaia-workspace.json',100_000),manifest=m.workspace.parseManifest(json(manifestBytes));
 const records=new Map(manifest.assets.map(r=>[r.filename,r]));
 const assets={},bytes={},observed={};
 async function source(role){
  const [name,cap]=files[role],record=records.get(name);
  if(!record){assets[role]=['unavailable','not_registered',null,null,null];return null;}
  assets[role]=['unavailable','source_rejected',record.sha256,record.bytes,record.generator_version];
  try{
   const value=await bytesAt(known,name,cap);
   const digest=sha(value);observed[role]=[digest,value.length];
   if(value.length!==record.bytes||digest!==record.sha256)return null;
   bytes[role]=value;return new File([value],name);
  }catch(error){
   if(error.code==='ENOENT')assets[role][1]='file_missing';
   return null;
  }
 }
 const use=role=>{assets[role][0]='available';assets[role][1]=null;};
 const context=await source('context'),walk=await source('walkmesh');
 if(!context||!walk)throw Error('mandatory_source');
 const fields=new m.context.FieldIndex(m.context.parseFieldPack(json(bytes.context))),node=fields.nodes.get(fieldId);
 if(node?.status!=='available')throw Error('field_identity');
 const contextSHA256=assets.context[2],pack=await m.context.openWalkmeshPack(walk,fields.pack);
 const mesh=await pack.decode(fieldId),row=pack.scenes.get(fieldId),offset=16+bytes.walkmesh.readUInt32LE(12)+row.offset;
 const meshSHA256=sha(bytes.walkmesh.subarray(offset,offset+row.bytes));
 use('context');use('walkmesh');
 const generation=1,input={fields,fieldId,contextSHA256,walkmeshSHA256:assets.walkmesh[2],meshSHA256,generation,mesh};
 async function optional(role,decode){
  const file=await source(role);if(!file)return;
  try{input[role]=await decode(file);use(role);}catch{assets[role][1]='reader_rejected';}
 }
 await optional('interaction',async file=>{
  const p=await m.interaction.openFieldInteraction(file,fields.pack,contextSHA256);
  return {scene:await p.decode(fieldId,mesh),sources:p.sources,decoder:p.decoder,contextSHA256:p.contextSHA256,sha256:assets.interaction[2]};
 });
 await optional('dialogue',async file=>{
  const p=await m.dialogue.openFieldDialogue(file,fields.pack,contextSHA256);
  return {scene:await p.decode(fieldId),sources:p.sources,contextSHA256,mode:p.mode,generation,sha256:assets.dialogue[2]};
 });
 await optional('gameplay',async()=>{
  const atlas=await bytesAt(join(ROOT,'src/gaiagis/atlas_data'),'content.json',4_000_000);
  const game=m.gameplay.parseGameplay(json(bytes.gameplay),fields.pack,contextSHA256,sha(Buffer.from(atlas.toString('utf8').replace(/\r\n/g,'\n'))));
  return {index:new m.gameplay.GameplayIndex(game),contextSHA256,generation,sha256:assets.gameplay[2]};
 });
 await optional('script',async file=>{
  const p=await m.script.openFieldScriptEvidence(file,fields.pack,contextSHA256);
  return {scene:await p.decode(fieldId),sources:p.sources,decoder:p.decoder,contextSHA256:p.contextSHA256,sha256:assets.script[2]};
 });
 const first=m.events.createFieldEventIndex(input);
 for(const role of first.problems){delete input[role];assets[role][0]='unavailable';assets[role][1]='scene_conflict';}
 const index=first.problems.length?m.events.createFieldEventIndex(input):first;
 const dialogue=input.dialogue?.scene,gameplay=input.gameplay?.index.scenes.get(fieldId);
 const analysisAt=performance.now(),result=m.engine.analyzeFieldConditionalEvidence(input),analysisMs=performance.now()-analysisAt;
 const projectionAt=performance.now(),tables=project(m,input,index,result),projectionMs=performance.now()-projectionAt;
 const identity={
  fieldId,name:node.name,archive:fields.pack.archive,archiveSHA256:fields.pack.sources[fields.pack.archive],
  maplistSHA256:fields.pack.sources.maplist,manifestSHA256:sha(manifestBytes),contextSHA256,
  decoder:fields.pack.scriptDecoder??'legacy-stop',memberSHA256:dialogue?.memberSHA256??gameplay?.memberSHA256??null,
  section1SHA256:index.section1SHA256,section5SHA256:meshSHA256,section8SHA256:index.section8SHA256,
 };
 return {schema:'gaiagis-local-field-evidence',version:1,software,identity,assets,observed,tables,
  run:{revision:m.engine.FIELD_CONDITIONAL_REVISION,status:result.status,complete:result.complete,problems:result.problems,
   stats:result.complete?result.stats:null,budget:m.engine.CONDITIONAL_LIMITS},
  timing:{analysisMs,projectionMs}};
}

try{
 const [major,minor]=process.versions.node.split('.').map(Number);
 if(major<22||major===22&&minor<12){process.exitCode=10;}
 else{
  const [stage,directory,id,software]=process.argv.slice(2);
  if(!stage||await realpath(stage)!==stage||!stage.startsWith(join(ROOT,'output')+(process.platform==='win32'?'\\':'/')))throw Error('staging');
  const selfTest=directory==='--self-test';
  const {modules}=await loadProduction(stage,undefined,selfTest);
  if(selfTest){
   const input=modules.synthetic.conditionalFixture();
   const r=modules.engine.analyzeFieldConditionalSnapshot(modules.engine.toFieldConditionalInput(input));
   const out=project(modules,input,modules.events.createFieldEventIndex(input),r);
   if(r.status!=='complete'||r.stats.coreEvents!==2||out.conditional_controls.length!==2||
      out.conditional_controls.some(row=>![38,43].includes(row[3])||!row[6]))throw Error('self_test');
   process.stdout.write(JSON.stringify({node:process.versions.node,status:r.status,core:r.stats.coreEvents}));
  }else{
   const out=JSON.stringify(await exportEvidence(directory,Number(id),software,modules));
   if(Buffer.byteLength(out)>MAX_BYTES){process.exitCode=11;}else process.stdout.write(out);
  }
 }
}catch(error){
 // Exit status travels to the parent. Do not emit workspace paths or reader payloads.
 process.exitCode=error?.message==='row_limit'?11:12;
}
