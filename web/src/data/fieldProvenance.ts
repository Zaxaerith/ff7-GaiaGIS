// SPDX-License-Identifier: GPL-3.0-only
export const LEGACY_CFG='legacy-stop',CMUSC8_CFG='field-cfg-en-cmusc8-1';
export type FieldDecoder=typeof LEGACY_CFG|typeof CMUSC8_CFG;
export const EN_FIELD_SHA='af695ccf7c681be222f5f716758160e39469ec02bc0af3dd6f20a5e9c2a34807';
export const EN_MAPLIST_SHA='d6ac24b79403a77feeb338450b7cb2169cdbcfa5d071a6cee4884e93b700bc29';
export function fieldDecoder(fields:{version:number;scriptDecoder?:FieldDecoder;sources:Record<string,string>}):FieldDecoder{
 const d=fields.version>=6?fields.scriptDecoder:LEGACY_CFG;
 if(d!==LEGACY_CFG&&d!==CMUSC8_CFG||d===CMUSC8_CFG&&(fields.sources['flevel.lgp']!==EN_FIELD_SHA||fields.sources.maplist!==EN_MAPLIST_SHA||['fflevel.lgp','gflevel.lgp','sflevel.lgp'].some(k=>k in fields.sources)))throw Error('Field CFG decoder/source identity');
 return d;
}
export function checkCFG(meta:{version?:unknown;generator_revision?:unknown;decoder?:unknown},kind:string,fields:{version:number;scriptDecoder?:FieldDecoder;sources:Record<string,string>}){
 const version=fields.version>=6?2:1,d=fieldDecoder(fields);
 if(meta.version!==version||meta.generator_revision!==`${kind}-${version}`||version===2&&meta.decoder!==d)throw Error('Field CFG provenance mismatch');
 return d;
}
