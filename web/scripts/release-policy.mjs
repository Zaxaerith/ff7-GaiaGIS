// SPDX-License-Identifier: GPL-3.0-only
import {readdirSync,readFileSync,lstatSync,existsSync} from 'node:fs';
import {join,extname,resolve} from 'node:path';
export function auditRelease(directory){
  const root=resolve(directory),files=[];
  function visit(path,prefix=''){
    for(const name of readdirSync(path)){
      const full=join(path,name),relative=prefix+name,stat=lstatSync(full);
      if(stat.isSymbolicLink())throw new Error(`Release contains a symlink: ${relative}`);
      if(stat.isDirectory()){
        if(relative!=='assets')throw new Error(`Unexpected release directory: ${relative}`);
        visit(full,`${relative}/`);
      }else{
        const allowedRoot=['index.html','favicon.svg','THREE-LICENSE.txt','LICENSE.txt','THIRD_PARTY_NOTICES.txt'];
        if(!(allowedRoot.includes(relative)||relative.startsWith('assets/')&&['.js','.css'].includes(extname(relative))))throw new Error(`Unexpected release file: ${relative}`);
        files.push(relative);
      }
    }
  }
  visit(root);
  for(const name of ['index.html','THREE-LICENSE.txt','LICENSE.txt','THIRD_PARTY_NOTICES.txt'])if(!existsSync(join(root,name)))throw new Error(`Missing release notice: ${name}`);
  if(!files.some(f=>f.endsWith('.js')))throw new Error('Release has no application bundle');
  if(!readFileSync(join(root,'THREE-LICENSE.txt'),'utf8').includes('Permission is hereby granted'))throw new Error('Three.js MIT notice missing');
  return {source_only:true,game_derived_files:0,files:files.sort()};
}
