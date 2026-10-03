// SPDX-License-Identifier: GPL-3.0-only
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync,brotliCompressSync,constants} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const base=new URL('../public/data/',import.meta.url),data=readFileSync(new URL('gaia-mesh.bin',base));
const gzip=gzipSync(data,{level:9}),brotli=brotliCompressSync(data,{params:{[constants.BROTLI_PARAM_QUALITY]:11}});
writeFileSync(new URL('gaia-mesh.bin.gz',base),gzip);writeFileSync(new URL('gaia-mesh.bin.br',base),brotli);
const meta=JSON.parse(readFileSync(new URL('gaia-meta.json',base),'utf8'));
const stats={raw_bytes:data.length,gzip_bytes:gzip.length,brotli_bytes:brotli.length,metadata_bytes:readFileSync(new URL('gaia-meta.json',base)).length,
  triangle_count:meta.triangle_count,note:'Compressed files are local size measurements; serving Content-Encoding depends on the host. Viewer fetches the regular binary.'};
mkdirSync(`${root}output/web`,{recursive:true});writeFileSync(`${root}output/web/asset-sizes.json`,JSON.stringify(stats,null,2)+'\n');console.log(stats);
