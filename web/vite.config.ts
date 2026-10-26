// SPDX-License-Identifier: GPL-3.0-only
import { defineConfig } from 'vite';
import {projectVersion} from './scripts/version.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export default defineConfig({
  define: {'import.meta.env.VITE_GAIA_VERSION': JSON.stringify(projectVersion),'import.meta.env.VITE_GAIA_ATLAS_SHA256':JSON.stringify(createHash('sha256').update(readFileSync(new URL('../src/gaiagis/atlas_data/content.json',import.meta.url),'utf8').replace(/\r\n/g,'\n')).digest('hex'))},
  base: process.env.GAIA_BASE_PATH || './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 650 },
});
