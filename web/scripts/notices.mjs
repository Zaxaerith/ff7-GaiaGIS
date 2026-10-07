// SPDX-License-Identifier: GPL-3.0-only
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url),modules=new URL('../node_modules/',import.meta.url);
const names=['three','d3-geo','d3-geo-projection','vite','typescript','vitest','@types/three','@types/node','@playwright/test'];
let text='# Third-party notices\n\nGaiaGIS original source uses GPL-3.0-only. The dependencies below retain their OWN licenses and copyright notices. Only Three.js is a Viewer runtime dependency. d3 is used for independent test comparisons; Vite and the other packages are development/test tools.\n\n';
text+='| Name | Installed version | License | Purpose | Repository |\n|---|---|---|---|---|\n';
const documents=[];
for(const name of names){
  const directory=new URL(name+'/',modules),pkg=JSON.parse(readFileSync(new URL('package.json',directory),'utf8'));
  const repo=typeof pkg.repository==='string'?pkg.repository:pkg.repository?.url||pkg.homepage;
  const purpose=name==='three'?'WebGL geometry, camera, controls, picking':name.startsWith('d3-')?'Projection test oracle (not runtime)':name==='vite'?'Dev server and static build':name==='typescript'?'Type checking':name==='@playwright/test'?'Isolated browser QA':'Development / tests';
  text+=`| ${name} | ${pkg.version} | ${pkg.license} | ${purpose} | ${repo} |\n`;
  const license=['LICENSE','LICENSE.md','LICENSE.txt','LICENSE-MIT','LICENSE-MIT.txt'].find(file=>existsSync(new URL(file,directory)));
  if(!license) throw new Error(`License document not found for ${name}`);
  documents.push(`\n## ${name} ${pkg.version}\n\nOriginal license notice, preserved verbatim:\n\n\`\`\`text\n${readFileSync(new URL(license,directory),'utf8')}\n\`\`\`\n`);
}
text+='\n## Unlicensed FF7 references\n\nmaciej-trebacz/ff7-landscaper and ergonomy-joe/ff7-worldmap are reverse-engineering references/validation oracles only. No source is vendored, relicensed or copied into the Viewer. Reference caches are excluded from Git and release bundles. The v1.3 traversal evaluator independently expresses necessary behavior facts; evidence, pinned reference revisions, model/tint mapping and runtime limitations are documented in docs/research/world-map.md. No decompiled implementation is bundled.\n\nThe npm lockfile pins the full dependency graph. Individual transitive packages retain their licenses in node_modules; no third-party source is relicensed as GPL.\n';
text+=documents.join('');writeFileSync(new URL('THIRD_PARTY_NOTICES.md',root),text);
// Preserve runtime copyright with the static build as well as source notices.
writeFileSync(new URL('../public/THREE-LICENSE.txt',import.meta.url),readFileSync(new URL('three/LICENSE',modules)));
console.log(fileURLToPath(new URL('THIRD_PARTY_NOTICES.md',root)));
