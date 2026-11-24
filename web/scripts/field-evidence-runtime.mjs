// SPDX-License-Identifier: GPL-3.0-only
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFile,realpath,stat,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const ENGINE=join(ROOT,'web/src/analysis/fieldConditionalEvidence.ts');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const requireThat=(ok,code)=>{if(!ok)throw Error(code);};
const inside=(base,path)=>{const rel=relative(base,path);return rel!==''&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep);};
async function bounded(path,max){
  const s=await stat(path);
  requireThat(s.isFile()&&s.size>0&&s.size<=max,'input_size');
  return readFile(path);
}
/** Compile only imported public source modules into this run's ignored directory.
 * No install/Workspace script is imported; no global require hook is changed. */
export async function loadProduction(directory, remember=(path,bytes)=>({sha256:sha(bytes)}), selfTest=false){
  const require=createRequire(import.meta.url),ts=require('typescript'),cache=new Map(),sources=[];
  const allowedSource=join(ROOT,'web/src');
  const allowedJSON=join(ROOT,'src/gaiagis/atlas_data/boss-evidence.json');
  const synthetic=join(ROOT,'web/tests/fieldConditionalSynthetic.ts');
  async function transpile(source,path,index){
    if(typeof ts.transpileModule==='function'){
      const output=ts.transpileModule(source,{fileName:path,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true,sourceMap:false,inlineSourceMap:false}});
      requireThat(!(output.diagnostics??[]).some(d=>d.category===ts.DiagnosticCategory.Error),'typescript_transpile');
      return output.outputText;
    }
    // TypeScript 7 exports version metadata only at its root; use its installed
    // native CLI with an isolated single .cts input, never the project's build.
    const stem='input-'+index,input=join(directory,stem+'.cts'),config=join(directory,stem+'.json');
    await writeFile(input,source,{flag:'wx'});
    await writeFile(config,JSON.stringify({compilerOptions:{target:'ES2022',module:'Node16',moduleResolution:'Node16',noCheck:true,noResolve:true,lib:['ES2022','DOM','DOM.Iterable'],types:[],isolatedModules:true,esModuleInterop:true,sourceMap:false,inlineSourceMap:false,declaration:false,incremental:false},files:[input]}),{flag:'wx'});
    const compiler=join(dirname(require.resolve('typescript/package.json')),'bin/tsc');
    const emitted=spawnSync(process.execPath,[compiler,'--project',config],{cwd:directory,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000,windowsHide:true,maxBuffer:1_000_000});
    if(emitted.error||emitted.status!==0){const diagnosticCodes=[...new Set(((emitted.stdout??'')+(emitted.stderr??'')).match(/TS[0-9]{4,6}/g)??[])];throw Error('typescript_transpile '+diagnosticCodes.join(','));}
    return (await bounded(join(directory,stem+'.cjs'),4_000_000)).toString('utf8');
  }
  async function compile(path){
    path=resolve(path);if(cache.has(path))return cache.get(path);
    requireThat(inside(allowedSource,path)&&path.endsWith('.ts')||path===allowedJSON||selfTest&&path===synthetic,'unsupported_source_import');
    requireThat(await realpath(path)===path,'source_symlink');
    const target=join(directory,'module-'+cache.size+(path.endsWith('.json')?'.json':'.cjs'));
    cache.set(path,target);const source=await bounded(path,4_000_000),fingerprint=remember(path,source);sources.push({path:relative(ROOT,path).split(sep).join('/'),sha256:fingerprint.sha256});
    if(path.endsWith('.json')){JSON.parse(source.toString('utf8'));await writeFile(target,source,{flag:'wx'});return target;}
    let text=await transpile(source.toString('utf8'),path,cache.size-1);
    const calls=[...text.matchAll(/require\((["'])([^"']+)\1\)/g)];
    for(const match of calls){
      const specifier=match[2];requireThat(specifier.startsWith('.'),'unsupported_external_import');
      let dependency=resolve(dirname(path),specifier);
      if(!dependency.endsWith('.json'))dependency=dependency.replace(/\.js$/,'')+'.ts';
      const built=await compile(dependency);
      text=text.split(match[0]).join('require('+JSON.stringify('./'+relative(directory,built).split(sep).join('/'))+')');
    }
    await writeFile(target,text,{flag:'wx'});return target;
  }
  const imports={
    engine:ENGINE,context:join(allowedSource,'data/fieldContext.ts'),dialogue:join(allowedSource,'data/fieldDialogue.ts'),
    events:join(allowedSource,'analysis/fieldEventEvidence.ts'),gameplay:join(allowedSource,'data/gameplay.ts'),interaction:join(allowedSource,'data/fieldInteraction.ts'),
    script:join(allowedSource,'data/fieldScriptEvidence.ts'),workspace:join(allowedSource,'app/workspace.ts'),
  };
  if(selfTest)imports.synthetic=synthetic;
  const modules={};for(const [key,path]of Object.entries(imports))modules[key]=require(await compile(path));
  requireThat(typeof modules.engine.analyzeFieldConditionalEvidence==='function','engine_api_unavailable');
  return {modules,sources,typescriptVersion:ts.version};
}
