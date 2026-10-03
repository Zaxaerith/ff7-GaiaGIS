// SPDX-License-Identifier: GPL-3.0-only
import {fileURLToPath} from 'node:url';
import {auditRelease} from './release-policy.mjs';
console.log(JSON.stringify(auditRelease(fileURLToPath(new URL('../dist-release/',import.meta.url))),null,2));
