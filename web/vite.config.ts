// SPDX-License-Identifier: GPL-3.0-only
import { defineConfig } from 'vite';
export default defineConfig({
  base: process.env.GAIA_BASE_PATH || './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 650 },
});
