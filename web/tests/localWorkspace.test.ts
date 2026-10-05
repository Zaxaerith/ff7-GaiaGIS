// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect,vi} from 'vitest';
import {loadLocalWorkspace,localAdvertised} from '../src/app/localWorkspace';
import {WorkspaceLoader,fileHash,workspaceOrder} from '../src/app/workspace';
import type {WorkspaceManifest} from '../src/app/workspace';
import {initialState,reduce} from '../src/app/state';
async function fixture(){
 const files=[new File(['{}'],'gaia-meta.json'),new File([new Uint8Array(16)],'gaia-mesh.bin'),new File(['{}'],'gaia-poi.json')];
 const manifest:WorkspaceManifest={schema:'gaiagis-workspace',version:1,tool_version:'2.0.0',sources:{},timestamp_policy:'omitted',assets:[]};
 for(const f of files)manifest.assets.push({filename:f.name,type:f.name==='gaia-meta.json'?'metadata':f.name==='gaia-mesh.bin'?'geometry':'locations',mapId:'WM0',bytes:f.size,sha256:await fileHash(f),dependencies:f.name==='gaia-meta.json'?[]:f.name==='gaia-mesh.bin'?['gaia-meta.json']:['gaia-mesh.bin']});
 const fetcher=vi.fn(async(input:RequestInfo|URL)=>{const path=String(input);if(path.endsWith('/status'))return Response.json({local_mode:true});if(path.endsWith('/workspace'))return Response.json(manifest);const f=files.find(f=>path.endsWith('/'+f.name));return f?new Response(await f.arrayBuffer()):new Response('',{status:404});}) as unknown as typeof fetch;
 return {files,manifest,fetcher};
}
describe('private local workspace transport',()=>{
 it('public HTML does not advertise or make any local requests',()=>{const doc={querySelector:()=>null} as unknown as Document;expect(localAdvertised(doc)).toBe(false);});
 it('requires explicit server capability',()=>{const doc={querySelector:()=>({getAttribute:()=> 'true'})} as unknown as Document;expect(localAdvertised(doc)).toBe(true);});
 it('auto-adopts through existing validators without file picker',async()=>{const {fetcher}=await fixture(),adopted:string[]=[],states:string[]=[];const loader=new WorkspaceLoader((id,state)=>states.push(id+':'+state.status));loader.register('geometry',async()=>{adopted.push('geometry');});loader.register('locations',async()=>{adopted.push('locations');});await loadLocalWorkspace(loader,fetcher);expect(adopted).toEqual(['geometry','locations']);expect(states).toContain('geometry:loaded');expect(states).toContain('locations:loaded');});
 it('optional network failure preserves core adoption',async()=>{const f=await fixture(),calls:string[]=[];const loader=new WorkspaceLoader(()=>{});loader.register('geometry',async()=>{calls.push('geometry');});const base=f.fetcher;const fetcher:typeof fetch=(p,o)=>String(p).endsWith('gaia-poi.json')?Promise.resolve(new Response('',{status:404})):base(p,o);await loadLocalWorkspace(loader,fetcher);expect(calls).toEqual(['geometry']);});
 it('rejects a corrupt manifest before any asset fetch',async()=>{const f=await fixture();f.manifest.assets[1].filename='../world_us.lgp';await expect(loadLocalWorkspace({load:vi.fn()},f.fetcher)).rejects.toThrow();expect(vi.mocked(f.fetcher).mock.calls.length).toBe(2);});
 it('rejects false local status',async()=>{await expect(loadLocalWorkspace({load:vi.fn()},async()=>Response.json({local_mode:false}))).rejects.toThrow();});
 it('core hash mismatch does not reach owner adoption',async()=>{const f=await fixture();f.manifest.assets[1].sha256='a'.repeat(64);const adopt=vi.fn(),loader=new WorkspaceLoader(()=>{});loader.register('geometry',adopt);await loadLocalWorkspace(loader,f.fetcher);expect(adopt).not.toHaveBeenCalled();});
 it('derives order from dependency registry even if listed backwards',async()=>{const f=await fixture();f.manifest.assets.reverse();expect(workspaceOrder(f.manifest).slice(0,2)).toEqual(['geometry','locations']);});
 it('preserves local mode while geometry replaces dataset state',()=>{const s=reduce(initialState(),{type:'local-workspace',phase:'loading'});expect(reduce(s,{type:'reset-data'}).localWorkspace).toBe('loading');});
 it('canceled network adoption cannot replace manual data',async()=>{const f=await fixture(),control=new AbortController(),adopt=vi.fn();control.abort();await expect(loadLocalWorkspace({load:adopt},f.fetcher,control.signal)).rejects.toThrow();expect(adopt).not.toHaveBeenCalled();});
});
