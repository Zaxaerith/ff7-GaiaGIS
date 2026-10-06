// SPDX-License-Identifier: GPL-3.0-only
import authored from '../../../src/gaiagis/atlas_data/content.json';
import {projectionRegistry} from '../projections/registry';
import {visibilityIds} from './layers';
import type {VisibilityId} from './layers';
import type {MapId} from '../data/nativeMaps';
import type {ProjectionId} from '../projections/Projection';
import type {Locale} from '../i18n';
const places=new Set(authored.entities.filter(e=>e.spatialBinding.kind==='location').map(e=>e.spatialBinding.locationId)),atlas=new Set(authored.entities.map(e=>e.id));
export interface ShareState {schema:'gaiagis-share-state';version:1;language:Locale;mapId:MapId;projection:ProjectionId;native:'3d'|'topdown';layers:VisibilityId[];spoilers:'hide-major'|'show-all'|'hide-all';target:{kind:'location'|'atlas';id:string}|null;}
const keys=['schema','version','language','mapId','projection','native','layers','spoilers','target'];
export function validateShareState(value:unknown):ShareState {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid share state');const s=value as Record<string,unknown>;
 if(Object.keys(s).length!==keys.length||!keys.every(k=>k in s)||s.schema!=='gaiagis-share-state'||s.version!==1||!['en','zh-CN','zh-TW','ja','ko'].includes(String(s.language))||!['WM0','WM2','WM3'].includes(String(s.mapId))||!Object.hasOwn(projectionRegistry,String(s.projection))||!['3d','topdown'].includes(String(s.native))||!['hide-major','show-all','hide-all'].includes(String(s.spoilers))||!Array.isArray(s.layers)||s.layers.length>visibilityIds.length||new Set(s.layers).size!==s.layers.length||!s.layers.every(l=>visibilityIds.includes(l)))throw Error('Invalid share state');
 if(s.target!==null){const t=s.target as Record<string,unknown>;if(!t||typeof t!=='object'||Object.keys(t).length!==2||!['kind','id'].every(k=>k in t)||s.mapId!=='WM0'||typeof t.id!=='string'||!(t.kind==='location'?places.has(t.id):t.kind==='atlas'?atlas.has(t.id):false))throw Error('Invalid public identity');}
 return structuredClone(s) as unknown as ShareState;
}
export function encodeShare(base:string,state:ShareState){const s=validateShareState(state),u=new URL(base);if(!['http:','https:'].includes(u.protocol))throw Error('Unsupported share origin');u.username=u.password=u.search=u.hash='';u.searchParams.set('lang',s.language);u.searchParams.set('map',s.mapId);u.searchParams.set('projection',s.projection);if(s.mapId!=='WM0')u.searchParams.set('view',s.native);if(s.layers.length)u.searchParams.set('layers',s.layers.join(','));u.searchParams.set('spoilers',s.spoilers);if(s.target)u.searchParams.set(s.target.kind==='location'?'place':'atlas',s.target.id);if(u.href.length>1000)throw Error('Share link too long');return u.href;}
export function decodeShare(url:string):ShareState|null {try{const u=new URL(url);if(!['http:','https:'].includes(u.protocol))return null;const q=u.searchParams,allowed=['lang','map','projection','view','layers','spoilers','place','atlas'];if(u.href.length>1000||[...q.keys()].some(k=>!allowed.includes(k)||q.getAll(k).length!==1)||q.has('place')&&q.has('atlas'))return null;let target:ShareState['target']=q.has('place')?{kind:'location',id:q.get('place')!}:q.has('atlas')?{kind:'atlas',id:q.get('atlas')!}:null;if(target&&!(target.kind==='location'?places:atlas).has(target.id))target=null;return validateShareState({schema:'gaiagis-share-state',version:1,language:q.get('lang')??'en',mapId:q.get('map')??'WM0',projection:q.get('projection')??'globe',native:q.get('view')??'3d',layers:q.get('layers')?.split(',').filter(Boolean)??[],spoilers:q.get('spoilers')??'hide-major',target});}catch{return null;}}
export const isPublicTarget=(kind:string,id:string)=>kind==='location'?places.has(id):kind==='atlas'&&atlas.has(id);
