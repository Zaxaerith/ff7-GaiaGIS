import {DIALOGUE_FILE,DIALOGUE_GENERATOR,DIALOGUE_LIMITS} from '../data/fieldDialogue';
import {parseFieldPack} from '../data/fieldContext';
import {checkCFG} from '../data/fieldProvenance';
import {archiveKey,assertSourceAgreement,gameArchives} from '../data/sourceRoles';
// SPDX-License-Identifier: GPL-3.0-only
import type {AssetId,AssetState} from './state';
import {SCRIPT_EVIDENCE_FILE,SCRIPT_EVIDENCE_GENERATOR,SCRIPT_EVIDENCE_LIMITS} from '../data/fieldScriptEvidence';
export const assetFiles:Record<AssetId,string[]>={geometry:['gaia-meta.json','gaia-mesh.bin'],locations:['gaia-poi.json'],encounters:['gaia-encounters.json'],events:['gaia-events.json'],routing:['gaia-routing.bin'],textures:['gaia-textures.bin'],WM2:['gaia-map-WM2.bin'],WM3:['gaia-map-WM3.bin'],'textures-WM2':['gaia-textures-WM2.bin'],'textures-WM3':['gaia-textures-WM3.bin'],transitions:['gaia-transitions.json'],explorer:['gaia-explorer.bin'],presentation:['gaia-presentation.json'],atlas:['gaia-atlas.json'],'field-context':['gaia-field-context.json'],'field-walkmesh':['gaia-field-walkmesh.bin'],'field-visual':['gaia-field-visual.bin'],'field-interaction':['gaia-field-interaction.bin'],'field-script-evidence':[SCRIPT_EVIDENCE_FILE],'field-dialogue':[DIALOGUE_FILE],gameplay:['gaia-gameplay.json']};
export interface ManifestAsset {filename:string;type:AssetId|'metadata';mapId:'WM0'|'WM2'|'WM3'|'shared';sha256:string;bytes:number;dependencies:string[];generator_version?:string;}
export interface WorkspaceManifest {schema:'gaiagis-workspace';version:1;tool_version:string;sources:Record<string,string>;assets:ManifestAsset[];timestamp_policy:'omitted';}
export interface WorkspacePlan {files:Map<string,File>;manifest:WorkspaceManifest|null;issues:Partial<Record<AssetId,AssetState>>;}
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
export const fileHash=async(f:File)=>hex(await crypto.subtle.digest('SHA-256',await f.arrayBuffer()));
const safeName=(name:string)=>/^[A-Za-z0-9_.-]+$/.test(name)&&name!=='.'&&name!=='..'&&name.length<=128;
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function parseManifest(value:unknown):WorkspaceManifest{
 if(!value||typeof value!=='object')throw Error('Workspace schema');const m=value as WorkspaceManifest;
 if(m.schema!=='gaiagis-workspace'||m.version!==1||m.timestamp_policy!=='omitted'||typeof m.tool_version!=='string'||!safeName(m.tool_version)||!m.sources||Array.isArray(m.sources)||!Object.entries(m.sources).every(([name,value])=>safeName(name)&&hash(value))||!Array.isArray(m.assets)||m.assets.length>32)throw Error('Unsupported workspace manifest');
 archiveKey(m.sources,'world',false);
 const names=new Set<string>();for(const a of m.assets){
 const type=a.type==='metadata'?'geometry':a.type;
 if(!a||!Object.hasOwn(assetFiles,type)||!assetFiles[type].includes(a.filename)||!safeName(a.filename)||names.has(a.filename)||!hash(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<=0||a.bytes>160_000_000||!['WM0','WM2','WM3','shared'].includes(a.mapId)||!Array.isArray(a.dependencies)||!a.dependencies.every(safeName))throw Error('Invalid workspace asset');
 if(type==='field-visual'&&a.bytes>(a.generator_version==='field-visual-4'?100_000_000:a.generator_version==='field-visual-3'?96_000_000:64_000_000))throw Error('Visual asset budget');
 if(type==='field-interaction'&&a.bytes>8_000_000)throw Error('Interaction asset budget');
 if(type==='field-dialogue'&&(a.bytes>DIALOGUE_LIMITS.pack||!['field-dialogue-1','field-dialogue-2'].includes(a.generator_version??'')||a.dependencies.length!==1||a.dependencies[0]!=='gaia-field-context.json'))throw Error('Dialogue dependency/budget');
 if(type==='gameplay'&&(a.filename!=='gaia-gameplay.json'||a.bytes>20_000_000||!['gameplay-1','gameplay-2'].includes(a.generator_version??'')||a.dependencies.length!==1||a.dependencies[0]!=='gaia-field-context.json'))throw Error('Gameplay asset dependency/budget');
 if(type==='field-script-evidence'&&(a.bytes>SCRIPT_EVIDENCE_LIMITS.pack||!['field-script-evidence-1','field-script-evidence-2'].includes(a.generator_version??'')))throw Error('Script evidence asset budget/generator');
 if(type==='field-script-evidence'&&(a.dependencies.length!==1||a.dependencies[0]!=='gaia-field-context.json'))throw Error('Script evidence Context dependency');
 const expected=type==='WM2'||type==='textures-WM2'?'WM2':type==='WM3'||type==='textures-WM3'?'WM3':type==='explorer'||type==='transitions'||type==='presentation'||type==='field-walkmesh'||type==='field-visual'||type==='field-interaction'||type==='field-script-evidence'||type==='field-dialogue'||type==='gameplay'?'shared':'WM0';
 if(a.mapId!==expected||a.type==='metadata'&&a.filename!=='gaia-meta.json')throw Error('Workspace map identity mismatch');names.add(a.filename);
 }
 for(const a of m.assets)if(a.dependencies.some(d=>d===a.filename||!names.has(d)))throw Error('Invalid workspace dependency');
 const visited=new Set<string>(),active=new Set<string>();const walk=(name:string)=>{if(active.has(name))throw Error('Cyclic workspace dependency');if(visited.has(name))return;active.add(name);for(const d of m.assets.find(a=>a.filename===name)!.dependencies)walk(d);active.delete(name);visited.add(name);};for(const name of names)walk(name);
 return m;
}
export async function discoverWorkspace(selected:readonly File[]):Promise<WorkspacePlan>{
 if(selected.length>64)throw Error('Too many workspace files');const files=new Map<string,File>();
 for(const f of selected){const name=f.name;if(!safeName(name)||files.has(name))throw Error('Duplicate or unsafe workspace filename');if(f.size>160_000_000||name==='gaia-field-visual.bin'&&f.size>100_000_000||name==='gaia-field-interaction.bin'&&f.size>8_000_000||name===SCRIPT_EVIDENCE_FILE&&f.size>SCRIPT_EVIDENCE_LIMITS.pack)throw Error('Workspace file too large');if(name==='gaia-field-visual.bin'&&f.size>64_000_000){if(typeof f.slice!=='function')throw Error('Workspace file too large');const bytes=await f.slice(0,16).arrayBuffer();if(bytes.byteLength!==16||new TextDecoder().decode(bytes.slice(0,8))!=='GAIACAM\0'||new DataView(bytes).getUint32(8,true)!==2)throw Error('Workspace file too large');}if(name==='gaia-field-visual.bin'&&f.size>96_000_000){const h=new DataView(await f.slice(0,16).arrayBuffer()),n=h.getUint32(12,true);if(!n||n>8_000_000||16+n>f.size)throw Error('Workspace file too large');const meta=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(await f.slice(16,16+n).arrayBuffer()));if(meta.generator_revision!=='field-visual-4')throw Error('Workspace file too large');}files.set(name,f);}
 const file=files.get('gaia-workspace.json');if(file&&file.size>100_000)throw Error('Manifest too large');
 const manifest=file?parseManifest(JSON.parse(await file.text())):null,issues:WorkspacePlan['issues']={};
 if(manifest){for(const a of manifest.assets){const type=a.type==='metadata'?'geometry':a.type,f=files.get(a.filename);if(!f){issues[type]={status:'missing',bytes:0,reason:'workspace.missingAsset'};continue;}
 if(f.size!==a.bytes||await fileHash(f)!==a.sha256)issues[type]={status:'corrupt',bytes:f.size,reason:'workspace.hashMismatch'};
 }
 for(let pass=0;pass<manifest.assets.length;pass++){let changed=false;for(const a of manifest.assets){const id=a.type==='metadata'?'geometry':a.type;if(issues[id])continue;const unavailable=a.dependencies.some(name=>{const record=manifest.assets.find(r=>r.filename===name)!;return !files.has(name)||!!issues[record.type==='metadata'?'geometry':record.type];});if(unavailable){issues[id]={status:'incompatible',bytes:files.get(a.filename)?.size??0,reason:'workspace.missingAsset'};changed=true;}}if(!changed)break;}
 }
 for(const [id,names]of Object.entries(assetFiles) as [AssetId,string[]][]){if(names.some(n=>!files.has(n)))issues[id]??={status:id==='geometry'?'missing':'optional',bytes:0};if(manifest&&names.some(n=>files.has(n)&&!manifest.assets.some(a=>a.filename===n)))issues[id]={status:'incompatible',bytes:0,reason:'workspace.unlisted'};}
 return {files,manifest,issues};
}
/** Derive adoption order from manifest dependencies, keeping geometry bootstrap first. */
export function workspaceOrder(manifest:WorkspaceManifest|null):AssetId[]{
 const result:AssetId[]=['geometry'],visited=new Set<string>();
 const visit=(name:string)=>{if(visited.has(name))return;visited.add(name);const a=manifest?.assets.find(a=>a.filename===name);if(!a)return;for(const dependency of a.dependencies)visit(dependency);const id=a.type==='metadata'?'geometry':a.type;if(!result.includes(id))result.push(id);};
 for(const id of Object.keys(assetFiles) as AssetId[])for(const name of assetFiles[id])visit(name);
 for(const id of Object.keys(assetFiles) as AssetId[])if(!result.includes(id))result.push(id);
 return result;
}
export type AssetLoader=(files:File[])=>Promise<void>;
function requireForeignProvenance(id:AssetId,expected:Record<string,string>,actual:Record<string,string>){
 // Legacy EN POI/Atlas can carry member-only hashes. A foreign Workspace
 // cannot relabel those assets through its Manifest's archive names.
 if(id!=='locations'&&id!=='atlas')return;
 for(const [role,index] of [['world',0],['field',1]] as const){const key=archiveKey(expected,role,false);if(key&&key!==gameArchives.en[index]&&!actual[key])throw Error('Foreign archive source identity missing');}
}
export async function assetSources(file:File):Promise<Record<string,string>>{
 let value:Record<string,unknown>={};
 if(file.name.endsWith('.json')){if(file.size>(file.name==='gaia-gameplay.json'?20_000_000:8_000_000))throw Error('JSON asset size');value=JSON.parse(await file.text());}
 else {const buffer=await file.slice(0,16).arrayBuffer();if(buffer.byteLength<16)throw Error('Truncated asset');const magic=new TextDecoder().decode(buffer.slice(0,8));
  if(magic==='GAIARTG\0'){const bytes=await file.slice(64,96).arrayBuffer();return {'wm0.map':hex(bytes)};}
  if(['GAIATEX\0','GAIAMAP\0','GAIAEXP\0','GAIAFLD\0','GAIACAM\0','GAIAINT\0','GAIASCR\0','GAIADLG\0'].includes(magic)){const length=new DataView(buffer).getUint32(12,true);if(length>(magic==='GAIACAM\0'?8_000_000:magic==='GAIAINT\0'?512_000:magic==='GAIASCR\0'?SCRIPT_EVIDENCE_LIMITS.metadata:magic==='GAIADLG\0'?DIALOGUE_LIMITS.metadata:2_000_000)||16+length>file.size)throw Error('Asset metadata size');value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await file.slice(16,16+length).arrayBuffer()));}
 }
 const sources={...(value.sources??{}) as Record<string,string>};const stage=value.stage1 as {source_wm0_sha256?:string}|undefined;
 if(stage?.source_wm0_sha256)sources['wm0.map']=stage.source_wm0_sha256;
 if(typeof value.source_sha256==='string'&&typeof value.mapId==='string')sources[value.mapId.toLowerCase()+'.map']=value.source_sha256;
 if(!Object.entries(sources).every(([name,value])=>safeName(name)&&!['__proto__','constructor','prototype'].includes(name)&&typeof value==='string'&&/^[a-fA-F0-9]{64}$/.test(value)))throw Error('Invalid asset source fingerprint');
 archiveKey(sources,'world',false);return sources;
}
/** Authenticate the declared CFG group before geometry adoption destroys old owners.
 * Scene bodies remain lazy. The group gate never stores private dialogue text. */
export async function preflightFieldCFG(plan:WorkspacePlan){
 const contextFile=plan.files.get('gaia-field-context.json'),contextDeclared=plan.manifest?.assets.some(a=>a.filename==='gaia-field-context.json');
 if(!contextFile&&!contextDeclared)return;
 if(!contextFile||plan.issues['field-context'])throw Error('Incomplete Field CFG Context');
 const fields=parseFieldPack(JSON.parse(await contextFile.text())),contextHash=await fileHash(contextFile);
 const kinds=[['field-interaction','gaia-field-interaction.bin'],['field-script-evidence',SCRIPT_EVIDENCE_FILE],['field-dialogue',DIALOGUE_FILE],['gameplay','gaia-gameplay.json']] as const;
 for(const [kind,name] of kinds){
  const declared=plan.manifest?.assets.find(a=>a.filename===name),file=plan.files.get(name);
  if(!declared&&!file)continue; // Old Workspace without Dialogue is valid.
  if(plan.issues[kind]||!file)throw Error('Incomplete Field CFG group');
  let meta:Record<string,any>;
  if(kind==='gameplay'){if(file.size>20_000_000)throw Error('Gameplay budget');meta=JSON.parse(await file.text());}
  else{
   const prefix=await file.slice(0,16).arrayBuffer();if(prefix.byteLength!==16)throw Error('CFG pack header');
   const v=new DataView(prefix),n=v.getUint32(12,true),magic=new TextDecoder().decode(prefix.slice(0,8));
   if(magic!==({ 'field-interaction':'GAIAINT\0','field-script-evidence':'GAIASCR\0','field-dialogue':'GAIADLG\0'}[kind])||!n||n>1_000_000||16+n>file.size)throw Error('CFG metadata budget/identity');
   meta=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(await file.slice(16,16+n).arrayBuffer()));
   if(meta.version!==v.getUint32(8,true))throw Error('CFG transport version');
  }
  checkCFG(meta,kind,fields);
  if((fields.version>=6||kind!=='field-interaction')&&meta.contextSHA256!==contextHash)throw Error('Field CFG Context fingerprint mismatch');
  if(declared&&declared.generator_version!==meta.generator_revision)throw Error('Field CFG Manifest generator mismatch');
  for(const key of [fields.archive,'maplist'])if(meta.sources?.[key]!==fields.sources[key])throw Error('Field CFG archive source mismatch');
 }
}
/** Parsed assets remain owned by existing feature owners; only File handles are retained. */
export class WorkspaceLoader {
 private epoch=0;private loaders=new Map<AssetId,AssetLoader>();
 private pending:Promise<unknown>=Promise.resolve();
 constructor(private report:(id:AssetId,state:AssetState)=>void){}
 register(id:AssetId,loader:AssetLoader){this.loaders.set(id,loader);return ()=>{if(this.loaders.get(id)===loader)this.loaders.delete(id);};}
 cancel(){this.epoch++;}
 load(files:readonly File[]){const epoch=++this.epoch;const task=this.pending.catch(()=>{}).then(()=>this.perform(files,epoch));this.pending=task;return task;}
 private async perform(files:readonly File[],epoch:number){if(epoch!==this.epoch)return;const plan=await discoverWorkspace(files);if(epoch!==this.epoch)return;
  const order=workspaceOrder(plan.manifest),sources={...plan.manifest?.sources};
  if(plan.issues.geometry){this.report('geometry',plan.issues.geometry);return plan;}
  try{await preflightFieldCFG(plan);}catch{if(epoch!==this.epoch)return;this.report('field-context',{status:'incompatible',bytes:0,reason:'workspace.assetRejected'});return plan;}
  if(epoch!==this.epoch)return;
  for(const id of order){if(epoch!==this.epoch)return;const issue=plan.issues[id];if(issue){this.report(id,issue);continue;}const selected=assetFiles[id].map(n=>plan.files.get(n)!);const bytes=selected.reduce((sum,f)=>sum+f.size,0),loader=this.loaders.get(id);if(!loader){this.report(id,{status:'unsupported',bytes});continue;}
   this.report(id,{status:'loading',bytes});try{const bindings:Record<string,string>={};for(const f of selected){const next=await assetSources(f);assertSourceAgreement({...sources,...bindings},next);for(const [key,hash]of Object.entries(next))bindings[key]=hash.toLowerCase();}requireForeignProvenance(id,sources,bindings);if(epoch!==this.epoch)return;await loader(selected);Object.assign(sources,bindings);if(epoch!==this.epoch)return;this.report(id,{status:plan.manifest?'loaded':'legacy',bytes,sourceHashes:bindings});}catch(e){if(epoch!==this.epoch)return;const text=e instanceof Error?e.message:String(e);this.report(id,{status:/mismatch|fingerprint|incompat|identity/i.test(text)?'incompatible':'corrupt',bytes,reason:'workspace.assetRejected'});if(id==='geometry')return plan;}
   await new Promise(resolve=>setTimeout(resolve,0));
  }return plan;
 }
}
export interface LocalDirectory {kind:'directory';values():AsyncIterable<LocalDirectory|{kind:'file';name:string;getFile():Promise<File>}>;}
/** Folder-input fallback must match native picker's root-only inventory.
 * Recovery pairs below .build are not a second selected Workspace. */
export function rootWorkspaceFiles(selected:readonly File[]):File[]{
 return selected.filter(f=>(!f.webkitRelativePath||f.webkitRelativePath.split('/').length===2)&&(f.name==='gaia-workspace.json'||Object.values(assetFiles).flat().includes(f.name)));
}
export async function directoryFiles(directory:LocalDirectory):Promise<File[]>{
 const files:File[]=[];for await(const entry of directory.values()){if(entry.kind==='file'&&(entry.name==='gaia-workspace.json'||Object.values(assetFiles).flat().includes(entry.name)))files.push(await entry.getFile());}return files;
}
