// SPDX-License-Identifier: GPL-3.0-only
import {it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {auditRelease} from '../scripts/release-policy.mjs';
const scratch=fileURLToPath(new URL('../../output/web_release_v1/audit-tests/',import.meta.url));
function fixture(){
  mkdirSync(scratch,{recursive:true});const root=mkdtempSync(join(scratch,'case-'));
  mkdirSync(join(root,'assets'));
  for(const name of ['index.html','LICENSE.txt','THIRD_PARTY_NOTICES.txt','assets/viewer.js'])writeFileSync(join(root,name),'Source fixture');
  writeFileSync(join(root,'THREE-LICENSE.txt'),'Permission is hereby granted');
  return root;
}
it('accepts an executable code-only artifact with notices',()=>expect(auditRelease(fixture())).toMatchObject({source_only:true,game_derived_files:0}));
it.each(['gaia-meta.json','assets/gaia-mesh.bin','assets/map.png','assets/viewer.js.map'])('rejects unexpected release content %s',name=>{const root=fixture();writeFileSync(join(root,name),'Unapproved');expect(()=>auditRelease(root)).toThrow(/Unexpected release file/);});
it('rejects a data directory even if empty',()=>{const root=fixture();mkdirSync(join(root,'data'));expect(()=>auditRelease(root)).toThrow(/directory/);});
