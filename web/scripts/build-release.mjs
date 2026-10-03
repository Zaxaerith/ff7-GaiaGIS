// SPDX-License-Identifier: GPL-3.0-only
// Build executable code and notices only. Never copy public/data or screenshots.
import {build} from 'vite';
import {copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {auditRelease} from './release-policy.mjs';
const web=fileURLToPath(new URL('../',import.meta.url));
await build({root:web,publicDir:false,base:process.env.GAIA_BASE_PATH||'./',
  define:{'import.meta.env.VITE_GAIA_SOURCE_ONLY':'"true"'},
  build:{outDir:'dist-release'}});
for(const [source,name]of [['../LICENSE','LICENSE.txt'],['../THIRD_PARTY_NOTICES.md','THIRD_PARTY_NOTICES.txt'],['public/THREE-LICENSE.txt','THREE-LICENSE.txt'],['public/favicon.svg','favicon.svg']])copyFileSync(new URL(source,new URL('../',import.meta.url)),new URL(`../dist-release/${name}`,import.meta.url));
console.log(JSON.stringify(auditRelease(`${web}dist-release`),null,2));
