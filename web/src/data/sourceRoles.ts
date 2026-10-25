// SPDX-License-Identifier: GPL-3.0-only
/** Four supported archive pairs. Game data language is independent of UI locale. */
export const gameArchives={en:['world_us.lgp','flevel.lgp'],fr:['world_fr.lgp','fflevel.lgp'],de:['world_gm.lgp','gflevel.lgp'],es:['world_sp.lgp','sflevel.lgp']} as const;
export type FieldArchive=typeof gameArchives[keyof typeof gameArchives][1];
export function archiveKey(sources:Record<string,unknown>,role:'world'|'field',required=true):string|null {
 const i=role==='world'?0:1,pairs=Object.values(gameArchives),found=pairs.filter(p=>Object.hasOwn(sources,p[i])),other=pairs.filter(p=>Object.hasOwn(sources,p[1-i]));
 if(found.length>1||other.length>1||required&&!found.length||found.length&&other.length&&found[0]!==other[0])throw Error('Missing, ambiguous or mixed archive source identity');
 return found[0]?.[i]??null;
}
export function assertSourceAgreement(a:Record<string,unknown>,b:Record<string,unknown>){
 for(const role of ['world','field'] as const){const x=archiveKey(a,role,false),y=archiveKey(b,role,false);if(x&&y&&(x!==y||String(a[x]).toLowerCase()!==String(b[y]).toLowerCase()))throw Error('Archive role source identity mismatch');}
 // Also check pairing across partial assets (World-only vs Field-only).
 archiveKey({...a,...b},'world',false);
 for(const [k,v] of Object.entries(b))if(Object.hasOwn(a,k)&&String(a[k]).toLowerCase()!==String(v).toLowerCase())throw Error('Source fingerprint mismatch');
}
