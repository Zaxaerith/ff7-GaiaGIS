import {nearName} from '../data/nameSearch';
// SPDX-License-Identifier: GPL-3.0-only
import type {MapId} from '../data/nativeMaps';
import type {Entrance,Location} from '../data/poi';
import type {IdentityTarget} from './userState';
import type {GeoPoint} from '../projections/Projection';
let selectionContext:{location:Location;entrance:Entrance}|null=null;
export function setNavigationSelection(value:typeof selectionContext){selectionContext=value;}
export function navigationSelection(){return selectionContext;}
export interface NavigationEntry {id:string;kind:'location'|'entrance'|'transition'|'event'|'atlas'|'user-feature';name:string;aliases:string[];mapId:MapId;navigate:()=>void;target?:IdentityTarget;anchor?:GeoPoint;precision?:'entrance_level'|'verified_anchor'|'exact_source'|'user_created';group?:'places'|'secrets'|'transitions'|'user';canTour?:boolean;}
const owners=new Map<string,NavigationEntry[]>();
export function registerNavigation(owner:string,entries:NavigationEntry[]){owners.set(owner,entries);if(typeof document!=='undefined')document.dispatchEvent(new Event('gaiagis-navigation'));}
export function clearNavigation(owner:string){owners.delete(owner);}
export function navigationEntries(){return [...owners.values()].flat();}
export function findNavigation(target:IdentityTarget){return navigationEntries().find(e=>e.kind===target.kind&&e.mapId===target.mapId&&(e.target?.id??(e.kind==='atlas'?e.id.replace(/^atlas:/,''):e.id))===target.id);}
const normalize=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').replace(/[↔<>\s_-]+/g,' ').trim().toLocaleLowerCase('en');
export function searchNavigation(query:string){const q=normalize(query),entries=[...owners.values()].flat();const rank=(e:NavigationEntry)=>{const name=normalize(e.name);let score=name===q?0:name.startsWith(q)?10:name.includes(q)?20:e.aliases.some(a=>normalize(a).includes(q))?30:[name,...e.aliases.map(normalize)].some(n=>nearName(q,n))?40:Infinity;if(!q)score=0;return score+({location:0,entrance:1,transition:2,event:3,atlas:0,'user-feature':4}[e.kind]);};return entries.filter(e=>Number.isFinite(rank(e))).sort((a,b)=>rank(a)-rank(b)||a.name.localeCompare(b.name,'en')||a.id.localeCompare(b.id));}
