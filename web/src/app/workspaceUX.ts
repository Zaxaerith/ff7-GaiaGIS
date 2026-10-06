// SPDX-License-Identifier: GPL-3.0-only
import {discoverWorkspace,assetFiles} from './workspace';
import type {WorkspacePlan} from './workspace';
export const DEFAULT_WORKSPACE='output/local-workspace';
export interface WorkspaceConnection {source:'public'|'auto'|'manual';manifest:'absent'|'valid';folder?:string;localPath?:string;loading:boolean;}
export let workspaceConnection:WorkspaceConnection={source:'public',manifest:'absent',loading:false};
const listeners=new Set<()=>void>();
export function updateWorkspaceConnection(patch:Partial<WorkspaceConnection>){workspaceConnection={...workspaceConnection,...patch};for(const fn of listeners)fn();}
export function onWorkspaceConnection(fn:()=>void){listeners.add(fn);return()=>listeners.delete(fn);}
export class WorkspaceImportError extends Error {constructor(public key:string,public files=''){super(key);}}
/** Validate manual import before a failed choice can mutate the current owners. */
export async function validateWorkspaceChoice(files:readonly File[]):Promise<WorkspacePlan>{
 if(!files.some(f=>f.name==='gaia-workspace.json'))throw new WorkspaceImportError('shell.missingManifest');
 let plan:WorkspacePlan;try{plan=await discoverWorkspace(files);}catch(e){const text=e instanceof Error?e.message:'';throw new WorkspaceImportError(/manifest|schema|dependency|identity|asset|JSON/i.test(text)?'shell.invalidManifest':'shell.rejected');}
 if(plan.issues.geometry){const missing=assetFiles.geometry.filter(name=>!plan.files.has(name)||!plan.manifest?.assets.some(a=>a.filename===name));throw new WorkspaceImportError(missing.length?'shell.missingCore':'shell.invalidCore',missing.join(', '));}
 return plan;
}
/** This display-only value never enters share URLs, storage or diagnostics. */
export function localWorkspacePath(value:unknown){return typeof value==='string'&&value.length<=512&&!/[\x00-\x1f]/.test(value)?value:undefined;}
