// SPDX-License-Identifier: GPL-3.0-only
/** Optional local verifier. No install discovery, asset generation, or Workspace writes. */
import {createHash} from 'node:crypto';
import {loadProduction} from './field-evidence-runtime.mjs';
import {createReadStream} from 'node:fs';
import {lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile} from 'node:fs/promises';

import {dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const WORKSPACE=join(ROOT,'output/local-workspace');
const OUT=join(ROOT,'output/dev/current/conditional-evidence');
const BASELINE=join(ROOT,'output/dev/current/research/v5.13-field-conditional-geography-statistics.csv');
const ATLAS=join(ROOT,'src/gaiagis/atlas_data/content.json');

const INPUTS=[
  ['gaia-workspace.json',100_000],['gaia-field-context.json',8_000_000],
  ['gaia-field-dialogue.bin',16_000_000],['gaia-gameplay.json',20_000_000],
  ['gaia-field-interaction.bin',8_000_000],['gaia-field-script-evidence.bin',4_000_000],
  ['gaia-field-walkmesh.bin',32_000_000],
];
const IF_NAMES=['IFUB','IFUBL','IFSW','IFSWL','IFUW','IFUWL'];
const CSV_HEADER='fieldId,name,nodes,edges,roots,maxRootNodes,work,strictPairs,strictEvents,IFUB,IFUBL,IFSW,IFSWL,IFUW,IFUWL,acceptedRoots,cyclicRoots,cfg_ms,cfg_peak_bytes';
const CSV_COUNTS={nodes:'nodes',edges:'edges',rawRoots:'roots',maxRootNodes:'maxRootNodes',rootVisits:'work',coreRelations:'strictPairs',coreEvents:'strictEvents',acceptedRoots:'acceptedRoots',cyclicRoots:'cyclicRoots'};
const SUM_KEYS=['nodes','edges','rawRoots','aliases','acceptedRoots','rejectedRoots','cyclicRoots','qualifiedRoots','rootVisits','standardRelations','strongRelations','coreRelations','coreEvents','qualifiedIfs','askCandidates','askLocalPairs','requestCount','requestTargets','requestEventPairs'];
const EXPECTED={fields:702,nodes:343587,edges:307205,rawRoots:58603,aliases:347593,acceptedRoots:54545,rejectedRoots:4058,cyclicRoots:4058,qualifiedRoots:5152,rootVisits:340900,ifTotal:21474,qualifiedIfs:21295,coreRelations:11621,coreEvents:11621,fieldsWithCore:532,askCandidates:4976,askWidthMatchedCandidates:4976,askLocalPairs:771,requestCount:19944,requestResolved:19944,requestTargets:13692,multiSourceRequestTargets:2413,requestEventPairs:23970,coreRequestSources:6361,coreRequestEventPairs:9281};
const EXPECTED_IF={IFUB:14885,IFUBL:758,IFSW:5514,IFSWL:140,IFUW:174,IFUWL:3};
const ENGINE_PROBLEMS=new Set(('legacy_context decoder context_identity field_identity missing_dialogue dialogue_identity dialogue_sections mesh_section gameplay_identity gameplay_sections related_identity code_bounds scene_limits entry_identity duplicate_entry related_owner related_entries cfg_boundary cfg_width cfg_target cfg_coverage stop_boundary stop_overlap cfg_unknown_target dialogue_record record_bytes record_opcode dialogue_record_node dialogue_owners if_successors missing_dialogue_record gameplay_records gameplay_record gameplay_record_node gameplay_record_claim gameplay_operands gameplay_status gameplay_owners missing_gameplay_record cfg_reachability stop_reachability dialogue_owner_accounting gameplay_owner_accounting invalid_budget invalid_input cancelled total_visit_limit root_node_limit bitset_limit operation_limit relation_limit').split(' '));
const observed=new Map();
class VerificationFailure extends Error {constructor(code,details){super(code);this.code=code;this.details=details;}}
const fail=code=>{throw new VerificationFailure(code);};
const requireThat=(ok,code)=>{if(!ok)fail(code);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const inside=(base,path)=>{const rel=relative(base,path);return rel!==''&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep);};
const numeric=n=>{requireThat(integer(n),'invalid_numeric_result');return n;};
let stage='arguments',currentField=null,temp=null;

function options(){
  const args=process.argv.slice(2);
  if(args.length===1&&(args[0]==='--help'||args[0]==='-h'))return {help:true};
  if(args.length===1&&args[0]==='--all')return {all:true,fields:null};
  if(args.length===2&&args[0]==='--fields'&&/^\d+(,\d+)*$/.test(args[1])){
    const fields=args[1].split(',').map(Number);
    requireThat(fields.length<=16&&fields.every(n=>integer(n)&&n<=65535)&&new Set(fields).size===fields.length,'invalid_fields');
    return {all:false,fields:fields.sort((a,b)=>a-b)};
  }
  fail('usage_choose_all_or_fields');
}

async function bounded(path,max){
  const s=await stat(path);
  requireThat(s.isFile()&&s.size>0&&s.size<=max,'input_size');
  return readFile(path);
}
async function fileDigest(path){
  requireThat((await lstat(path)).isFile()&&await realpath(path)===path,'observed_not_regular');
  const hash=createHash('sha256');let bytes=0;
  for await(const chunk of createReadStream(path)){hash.update(chunk);bytes+=chunk.length;}
  return {sha256:hash.digest('hex'),bytes};
}
function remember(path,value){
  const fingerprint={sha256:sha(value),bytes:value.length},prior=observed.get(path);
  requireThat(!prior||prior.sha256===fingerprint.sha256&&prior.bytes===fingerprint.bytes,'input_changed_during_load');
  observed.set(path,fingerprint);return fingerprint;
}
async function verifyObserved(){
  for(const [path,before]of observed){const after=await fileDigest(path);requireThat(after.sha256===before.sha256&&after.bytes===before.bytes,'observed_file_changed_during_run');}
  return {checkedFiles:observed.size,workspaceFiles:INPUTS.filter(([name])=>observed.has(join(WORKSPACE,name))).length,unchanged:true};
}
function parseBaseline(bytes){
  const lines=bytes.toString('utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  requireThat(lines.shift()===CSV_HEADER,'baseline_header');
  const keys=CSV_HEADER.split(','),rows=new Map();
  for(const line of lines){
    const values=line.split(',');requireThat(values.length===keys.length,'baseline_row');
    const row=Object.fromEntries(keys.map((key,i)=>[key,key==='name'?values[i]:Number(values[i])]));
    requireThat(integer(row.fieldId)&&!rows.has(row.fieldId)&&keys.filter(k=>k!=='name').every(k=>Number.isFinite(row[k])&&row[k]>=0),'baseline_values');
    requireThat(Object.values(CSV_COUNTS).concat(IF_NAMES).every(k=>integer(row[k])),'baseline_counts');
    rows.set(row.fieldId,row);
  }
  requireThat(rows.size===702,'baseline_coverage');return rows;
}

const memory=()=>{const m=process.memoryUsage();return {rss:m.rss,heapUsed:m.heapUsed,external:m.external,arrayBuffers:m.arrayBuffers};};
const delta=(after,before)=>Object.fromEntries(Object.keys(before).map(k=>[k,after[k]-before[k]]));
const add=(target,key,n)=>{target[key]=(target[key]??0)+numeric(n);};
function countResult(result){
  if(result?.status!=='complete'||result.complete!==true||result.stats?.complete!==true){
    const status=['complete','unavailable','limited','cancelled'].includes(result?.status)?result.status:'unknown';
    const problems=Array.isArray(result?.problems)?[...new Set(result.problems.map(code=>ENGINE_PROBLEMS.has(code)?code:'unrecognized_engine_problem'))]:[];
    throw new VerificationFailure('analysis_incomplete',{status,problems});
  }
  const counts=Object.fromEntries(SUM_KEYS.map(k=>[k,numeric(result.stats[k])]));
  counts.maxRootNodes=numeric(result.stats.maxRootNodes);
  counts.peakBitsetAccountedBytes=numeric(result.stats.peakBitsetBytes);
  counts.operations=numeric(result.stats.operations);
  counts.ifCounts=Object.fromEntries(IF_NAMES.map(k=>[k,numeric(result.stats.ifCounts[k]??0)]));
  counts.ifTotal=Object.values(counts.ifCounts).reduce((a,b)=>a+b,0);
  counts.eventCounts={};for(const kind of ['MESSAGE','ASK','STITM','SMTRA','BATTLE','REQ','REQSW','REQEW'])counts.eventCounts[kind]=numeric(result.stats.eventCounts[kind]??0);
  requireThat(result.roots.length===counts.rawRoots&&new Set(result.roots.map(r=>numeric(r.entry))).size===counts.rawRoots,'root_accounting');
  requireThat(result.roots.reduce((n,r)=>n+numeric(r.nodes),0)===counts.rootVisits&&Math.max(0,...result.roots.map(r=>r.nodes))===counts.maxRootNodes,'root_visit_accounting');
  requireThat(result.roots.reduce((n,r)=>n+r.aliases.length,0)===counts.aliases&&result.roots.filter(r=>r.status==='accepted').length===counts.acceptedRoots&&result.roots.filter(r=>r.status==='rejected').length===counts.rejectedRoots&&result.roots.filter(r=>r.reason==='cycle').length===counts.cyclicRoots,'root_status_accounting');
  const controlKey=c=>[numeric(c.ifOffset),numeric(c.successor),numeric(c.targetOffset)].join('/');
  requireThat(result.controls.length===counts.standardRelations&&result.controls.filter(c=>c.strong).length===counts.strongRelations&&new Set(result.controls.filter(c=>c.core).map(controlKey)).size===counts.coreRelations,'control_accounting');
  const coreOffsets=new Set(result.controls.filter(c=>c.core).map(c=>numeric(c.targetOffset)));
  requireThat(coreOffsets.size===counts.coreEvents,'core_event_accounting');
  const askKey=a=>[numeric(a.askOffset),numeric(a.ifOffset)].join('/');
  counts.askWidthMatchedCandidates=new Set(result.askLinks.filter(a=>a.width===1).map(askKey)).size;
  requireThat(new Set(result.askLinks.map(askKey)).size===counts.askCandidates&&new Set(result.askLinks.filter(a=>a.status==='local').map(askKey)).size===counts.askLocalPairs,'ask_accounting');
  const requestTargets=new Map();counts.requestResolved=0;counts.coreRequestSources=0;counts.coreRequestEventPairs=0;
  const seen=new Set();let pairs=0;
  for(const r of result.requestLinks){
    requireThat(integer(r.sourceOffset)&&!seen.has(r.sourceOffset),'request_source_accounting');seen.add(r.sourceOffset);
    requireThat(Array.isArray(r.targetEventOffsets)&&r.targetEventOffsets.every(integer)&&new Set(r.targetEventOffsets).size===r.targetEventOffsets.length,'request_event_accounting');
    pairs+=r.targetEventOffsets.length;
    if(r.status==='resolved'){counts.requestResolved++;const target=[numeric(r.targetActor),numeric(r.slot),numeric(r.targetEntry)].join('/');requestTargets.set(target,(requestTargets.get(target)??0)+1);}
    if(coreOffsets.has(r.sourceOffset)){counts.coreRequestSources++;counts.coreRequestEventPairs+=r.targetEventOffsets.length;}
  }
  counts.multiSourceRequestTargets=[...requestTargets.values()].filter(n=>n>1).length;
  requireThat(seen.size===counts.requestCount&&requestTargets.size===counts.requestTargets&&pairs===counts.requestEventPairs,'request_totals');
  return counts;
}
function compare(fieldId,actual,expected,keys,mismatches){
  for(const [metric,column]of Object.entries(keys))if(actual[metric]!==expected[column])mismatches.push({fieldId,metric,expected:expected[column],actual:actual[metric]});
}

function checkReferenceCase(id,result,interaction){
  const core=(root,condition,successor,target)=>result.controls.some(c=>c.root===root&&c.ifOffset===condition&&c.successor===successor&&c.targetOffset===target&&c.core);
  const line=(offset,entry,triangles)=>interaction.records.some(r=>r.kind==='line'&&r.offset===offset&&r.owners?.some(o=>o.entry===entry)&&r.geometry?.relation==='surface'&&r.geometry.candidates.join()===triangles.join());
  if(id===66){
    requireThat(core(1715,1722,1730,1740)&&core(1715,1722,1745,1755),'fship_distinct_branches');
  }else if(id===67){
    requireThat(result.roots.some(r=>r.entry===1392&&r.status==='rejected'&&r.reason==='cycle')&&result.controls.every(c=>c.root!==1392),'fship_cycle_rejected');
  }else if(id===74){
    const request=result.requestLinks.find(r=>r.sourceOffset===2295);
    requireThat(core(2274,2274,2282,2295)&&request?.opcode===3&&request.targetActor===12&&request.slot===4&&request.targetEntry===3107&&request.priority===6&&request.targetEventOffsets.join()==='3117,3147','fship_one_hop');
    requireThat(result.controls.every(c=>c.root!==3107||![3117,3147].includes(c.targetOffset))&&line(2258,2258,[6,9,19,24,36,40,70,71]),'fship_target_scope_and_line');
  }else if(id===93){
    requireThat(result.askLinks.some(a=>a.root===1606&&a.askOffset===1616&&a.ifOffset===1841&&a.bank===5&&a.address===2&&a.width===1&&a.status==='candidate'&&a.reason==='known_overwrite'&&a.corridor.includes(1834)),'blackbg1_overwrite');
  }else if(id===198){
    requireThat(core(1728,1840,1855,1870)&&core(1728,1840,1855,1875)&&line(1708,1708,[18,19]),'mkt_ia_control_and_line');
  }else if(id===349){
    requireThat(core(1167,1234,1240,1253)&&core(1167,1234,1258,1271)&&result.controls.every(c=>c.ifOffset!==1234||c.targetOffset!==1274),'psdun_branch_and_join');
    requireThat(result.askLinks.some(a=>a.root===1167&&a.askOffset===1227&&a.ifOffset===1234&&a.bank===5&&a.address===7&&a.width===1&&a.status==='local'&&!a.corridor.length),'psdun_local_address');
  }
}

async function main(){
  const opt=options();
  if(opt.help){console.log('Usage: node web/scripts/check-conditional-evidence.mjs --fields 345,493 | --all\nReads only the existing output/local-workspace and local research CSV. Writes private numeric reports and temporary public-source transpilation under output/dev/current/conditional-evidence. --all is the explicit one-shot 702-Field acceptance mode. No installation scan or rebuild.');return;}
  stage='input_paths';
  requireThat(await realpath(ROOT)===ROOT&&await realpath(WORKSPACE)===WORKSPACE,'workspace_symlink');
  requireThat(await realpath(BASELINE)===BASELINE&&await realpath(ATLAS)===ATLAS,'reference_symlink');
  const bytes=new Map(),before={};
  for(const [name,max]of INPUTS){const path=join(WORKSPACE,name);requireThat((await lstat(path)).isFile(),'input_not_regular');const value=await bounded(path,max);bytes.set(name,value);before[name]=remember(path,value);}
  const baselineBytes=await bounded(BASELINE,1_000_000),baselineBefore=remember(BASELINE,baselineBytes).sha256,baseline=parseBaseline(baselineBytes);
  const atlasBytes=await bounded(ATLAS,4_000_000),atlasContentHash=sha(atlasBytes.toString('utf8').replace(/\r\n/g,'\n'));remember(ATLAS,atlasBytes);
  stage='prepare_output';
  for(const path of [join(ROOT,'output'),join(ROOT,'output/dev'),join(ROOT,'output/dev/current')])requireThat(await realpath(path)===path,'output_symlink');
  await mkdir(OUT,{recursive:true});requireThat(await realpath(OUT)===OUT,'output_symlink');
  temp=await mkdtemp(join(OUT,'ts-runtime-'));
  const started=performance.now();stage='load_production_typescript';
  const {modules:m,sources,typescriptVersion}=await loadProduction(temp,remember);
  stage='manifest';const manifest=m.workspace.parseManifest(JSON.parse(bytes.get('gaia-workspace.json').toString('utf8')));
  for(const [name]of INPUTS.slice(1)){const record=manifest.assets.find(a=>a.filename===name);requireThat(record&&record.sha256===before[name].sha256&&record.bytes===before[name].bytes,'manifest_asset_mismatch');}
  const file=name=>new File([bytes.get(name)],name);
  stage='open_workspace';const fields=new m.context.FieldIndex(m.context.parseFieldPack(JSON.parse(bytes.get('gaia-field-context.json').toString('utf8'))));
  const contextHash=before['gaia-field-context.json'].sha256;
  const dialogue=await m.dialogue.openFieldDialogue(file('gaia-field-dialogue.bin'),fields.pack,contextHash);
  const script=await m.script.openFieldScriptEvidence(file('gaia-field-script-evidence.bin'),fields.pack,contextHash);
  const walkmesh=await m.context.openWalkmeshPack(file('gaia-field-walkmesh.bin'),fields.pack);
  const interaction=await m.interaction.openFieldInteraction(file('gaia-field-interaction.bin'),fields.pack,contextHash);
  const gameplay={index:new m.gameplay.GameplayIndex(m.gameplay.parseGameplay(JSON.parse(bytes.get('gaia-gameplay.json').toString('utf8')),fields.pack,contextHash,atlasContentHash)),sha256:before['gaia-gameplay.json'].sha256,contextSHA256:contextHash,generation:1};
  const available=fields.pack.nodes.filter(n=>n.status==='available').map(n=>n.id).sort((a,b)=>a-b);
  requireThat(available.length===702&&available.every(id=>baseline.has(id))&&baseline.size===available.length,'workspace_coverage');
  const ids=opt.all?available:opt.fields;
  requireThat(ids.every(id=>available.includes(id)),'field_unavailable');
  const rows=[],mismatches=[],totals={fields:0,fieldsWithCore:0,ifCounts:Object.fromEntries(IF_NAMES.map(k=>[k,0])),eventCounts:{}};
  const readyMs=performance.now()-started;
  for(const id of ids){
    currentField=id;stage='decode_field';const decodeStart=performance.now();
    const scene=await dialogue.decode(id),mesh=await walkmesh.decode(id),ipScene=await interaction.decode(id,mesh),spScene=await script.decode(id);
    const input={fields,fieldId:id,contextSHA256:contextHash,walkmeshSHA256:before['gaia-field-walkmesh.bin'].sha256,meshSHA256:scene.section5SHA256,generation:1,mesh,
      dialogue:{scene,sha256:before['gaia-field-dialogue.bin'].sha256,sources:dialogue.sources,contextSHA256:contextHash,generation:1,mode:dialogue.mode},
      interaction:{scene:ipScene,sha256:before['gaia-field-interaction.bin'].sha256,sources:interaction.sources,decoder:interaction.decoder,contextSHA256:interaction.contextSHA256},
      script:{scene:spScene,sha256:before['gaia-field-script-evidence.bin'].sha256,sources:script.sources,decoder:script.decoder,contextSHA256:script.contextSHA256},gameplay};
    const decodeMs=performance.now()-decodeStart;
    stage='analyze_field';const beforeAnalysis=memory(),analyzeStart=performance.now();
    const result=m.engine.analyzeFieldConditionalEvidence(input);
    const analyzeMs=performance.now()-analyzeStart,afterAnalysis=memory();
    stage='verify_field';const counts=countResult(result),expected=baseline.get(id);
    checkReferenceCase(id,result,ipScene);
    compare(id,counts,expected,CSV_COUNTS,mismatches);compare(id,counts.ifCounts,expected,Object.fromEntries(IF_NAMES.map(k=>[k,k])),mismatches);
    const row={fieldId:id,status:'complete',counts,performance:{decodeMs,analyzeMs,peakBitsetAccountedBytes:counts.peakBitsetAccountedBytes,memoryBefore:beforeAnalysis,memoryAfter:afterAnalysis,memoryNetDeltaBytes:delta(afterAnalysis,beforeAnalysis)}};
    rows.push(row);totals.fields++;if(counts.coreEvents)totals.fieldsWithCore++;
    for(const key of [...SUM_KEYS,'ifTotal','askWidthMatchedCandidates','requestResolved','multiSourceRequestTargets','coreRequestSources','coreRequestEventPairs'])add(totals,key,counts[key]);
    for(const key of IF_NAMES)add(totals.ifCounts,key,counts.ifCounts[key]);
    for(const [key,n]of Object.entries(counts.eventCounts))add(totals.eventCounts,key,n);
  }
  currentField=null;stage='aggregate_comparison';
  if(opt.all){compare(null,totals,EXPECTED,Object.fromEntries(Object.keys(EXPECTED).map(k=>[k,k])),mismatches);compare(null,totals.ifCounts,EXPECTED_IF,Object.fromEntries(IF_NAMES.map(k=>[k,k])),mismatches);}
  stage='verify_readonly';const readOnlyVerification=await verifyObserved();
  const fingerprints=INPUTS.map(([name])=>({file:name,...before[name],unchanged:true,manifestMatched:name!=='gaia-workspace.json'}));
  const report={schema:'gaiagis-conditional-verification',version:1,status:mismatches.length?'failed':'passed',mode:opt.all?'all-702':'selected-fields',fullCensus:opt.all,
    runtime:{kind:'node-production-typescript-not-browser',node:process.version,platform:process.platform,arch:process.arch,typescript:typescriptVersion,analysisRevision:m.engine.FIELD_CONDITIONAL_REVISION,limits:m.engine.CONDITIONAL_LIMITS},
    privacy:{originalText:false,rawScripts:false,coordinates:false,installationScanned:false,workspaceWritten:false},
    baseline:{sha256:baselineBefore,rows:baseline.size},inputs:fingerprints,publicSources:sources,readOnlyVerification,
    performanceNotes:{readyMs,decode:'Production dialogue/script/interaction/walkmesh decoding; outside analyzeMs.',analyze:'Synchronous production analyzeFieldConditionalEvidence call including its projection and validation; once per selected Field; no warm-up.',bitsets:'Engine-accounted maximum typed Dom+Pdom+Reach bytes for one raw Entry; not process memory.',memory:'Signed process.memoryUsage after-minus-before analyze; no forced GC; includes noise/retained objects; not a peak or browser measurement.',baselineTiming:'Python CSV cfg_ms/cfg_peak_bytes are deliberately not performance comparisons.'},
    totals,fields:rows,mismatches};
  stage='write_report';const reportName=opt.all?'report-all.json':'report-fields-'+ids.join('-')+'.json';
  const reportPath=join(OUT,reportName),prior=await lstat(reportPath).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  requireThat(!prior||prior.isFile()&&!prior.isSymbolicLink()&&prior.nlink===1,'report_not_regular');
  const staging=join(temp,'report.json');await writeFile(staging,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  await rename(staging,reportPath);
  console.log(JSON.stringify({status:report.status,mode:report.mode,fullCensus:report.fullCensus,report:'output/dev/current/conditional-evidence/'+reportName,totals,mismatches,performance:rows.map(r=>({fieldId:r.fieldId,...r.performance}))}));
  if(mismatches.length)process.exitCode=1;
}
try{await main();}catch(error){
  // Never echo input-derived messages, stack traces, script bytes, paths or text.
  let readOnlyVerification;try{readOnlyVerification=await verifyObserved();}catch{readOnlyVerification={unchanged:false,code:'read_only_verification_failed'};}
  console.error(JSON.stringify({status:'failed',stage,fieldId:currentField,code:error instanceof VerificationFailure?error.code:'operation_failed',...(error instanceof VerificationFailure&&error.details?{analysis:error.details}:{}),readOnlyVerification}));process.exitCode=1;
}finally{
  if(temp){try{requireThat(inside(OUT,temp)&&dirname(temp)===OUT,'temporary_path');await rm(temp,{recursive:true,force:true});}catch{console.error(JSON.stringify({status:'failed',stage:'cleanup',code:'temporary_cleanup_failed'}));process.exitCode=1;}}
}
