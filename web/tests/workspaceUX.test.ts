// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {validateWorkspaceChoice,WorkspaceImportError,localWorkspacePath,DEFAULT_WORKSPACE} from '../src/app/workspaceUX';
import {fileHash} from '../src/app/workspace';
async function fixture(){const files=[new File(['{}'],'gaia-meta.json'),new File([new Uint8Array(16)],'gaia-mesh.bin')];const assets=await Promise.all(files.map(async f=>({filename:f.name,type:f.name==='gaia-meta.json'?'metadata':'geometry',mapId:'WM0',bytes:f.size,sha256:await fileHash(f),dependencies:f.name==='gaia-meta.json'?[]:['gaia-meta.json']})));const manifest={schema:'gaiagis-workspace',version:1,tool_version:'2.0.0',timestamp_policy:'omitted',sources:{},assets};return {files,manifest,selected:()=>[...files,new File([JSON.stringify(manifest)],'gaia-workspace.json')]};}
describe('manual workspace guidance and validation',()=>{
 it('agrees with the launcher default',()=>expect(DEFAULT_WORKSPACE).toBe('output/local-workspace'));
 it('explains a raw FF7 directory without reading game files',async()=>{await expect(validateWorkspaceChoice([new File(['raw'],'wm0.map')])).rejects.toMatchObject({key:'shell.missingManifest'});});
 it('explains an empty selection',async()=>{await expect(validateWorkspaceChoice([])).rejects.toBeInstanceOf(WorkspaceImportError);});
 it('rejects malformed JSON with regeneration guidance',async()=>{await expect(validateWorkspaceChoice([new File(['{'],'gaia-workspace.json')])).rejects.toMatchObject({key:'shell.invalidManifest'});});
 it('rejects unsupported schema',async()=>{const f=await fixture();f.manifest.version=99;await expect(validateWorkspaceChoice(f.selected())).rejects.toMatchObject({key:'shell.invalidManifest'});});
 it('names a missing geometry file',async()=>{const f=await fixture();await expect(validateWorkspaceChoice(f.selected().filter(v=>v.name!=='gaia-mesh.bin'))).rejects.toMatchObject({key:'shell.missingCore',files:'gaia-mesh.bin'});});
 it('explains checksum rejection',async()=>{const f=await fixture();f.manifest.assets[1].sha256='f'.repeat(64);await expect(validateWorkspaceChoice(f.selected())).rejects.toMatchObject({key:'shell.invalidCore'});});
 it('rejects a manifest omitting core files',async()=>{const f=await fixture();f.manifest.assets=[];await expect(validateWorkspaceChoice(f.selected())).rejects.toMatchObject({key:'shell.missingCore'});});
 it('accepts a verified partial workspace with missing optional resources',async()=>{const f=await fixture();const plan=await validateWorkspaceChoice(f.selected());expect(plan.issues.geometry).toBeUndefined();expect(plan.issues.textures?.status).toBe('optional');});
 it('rejects duplicates before any owner adoption',async()=>{const f=await fixture();await expect(validateWorkspaceChoice([...f.selected(),f.files[0]])).rejects.toMatchObject({key:'shell.rejected'});});
 it('bounds local display metadata and rejects control characters',()=>{expect(localWorkspacePath('output/local-workspace')).toBe('output/local-workspace');expect(localWorkspacePath('x'.repeat(513))).toBeUndefined();expect(localWorkspacePath('bad\npath')).toBeUndefined();expect(localWorkspacePath({})).toBeUndefined();});
});
