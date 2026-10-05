// SPDX-License-Identifier: GPL-3.0-only
import {parseManifest} from './workspace';
import type {WorkspaceLoader} from './workspace';
const prefix='/__gaiagis_local__/';
/** The private Python server advertises this capability in its HTML.
 * Public Pages never probes localhost or scans disk. */
export function localAdvertised(doc:Document=document){return doc.querySelector('meta[name="gaiagis-local"]')?.getAttribute('content')==='true';}
export async function loadLocalWorkspace(loader:Pick<WorkspaceLoader,'load'>,fetcher:typeof fetch=fetch,signal?:AbortSignal){
 const request=async(path:string)=>{const response=await fetcher(prefix+path,{cache:'no-store',credentials:'same-origin',signal});if(!response.ok)throw Error('Local workspace unavailable');return response;};
 const status=await (await request('status')).json();if(status.local_mode!==true)throw Error('Local mode not advertised');
 const manifest=parseManifest(await (await request('workspace')).json());
 const files:File[]=[new File([JSON.stringify(manifest)],'gaia-workspace.json')];
 // Optional network failures are isolated by the existing hash/schema loader.
 const results=await Promise.allSettled(manifest.assets.map(async a=>{const response=await request('assets/'+encodeURIComponent(a.filename));const blob=await response.blob();if(blob.size!==a.bytes)throw Error('Local asset size mismatch');return new File([blob],a.filename);}));
 for(const result of results)if(result.status==='fulfilled')files.push(result.value);
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 return loader.load(files);
}
