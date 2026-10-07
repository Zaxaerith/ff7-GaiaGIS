// SPDX-License-Identifier: GPL-3.0-only
import {readFileSync} from 'node:fs';
export function parseProjectVersion(source){
 const match=source.match(/^__version__\s*=\s*["'](\d+\.\d+\.\d+)["']\s*$/m);
 if(!match)throw new Error('Invalid authoritative GaiaGIS version');return match[1];
}
export const projectVersion=parseProjectVersion(readFileSync(new URL('../../src/gaiagis/_version.py',import.meta.url),'utf8'));
