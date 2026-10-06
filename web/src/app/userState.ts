// SPDX-License-Identifier: GPL-3.0-only
import type {MapId} from '../data/nativeMaps';
import type {ProjectionId} from '../projections/Projection';
import {projectionRegistry} from '../projections/registry';
import {layerIds,visibilityIds,defaultOpacities,defaultVisibility} from './layers';
import type {LayerId,VisibilityId} from './layers';
export const USER_STATE_KEY='gaiagis.user-state',RECENT_LIMIT=30;
export type TargetKind='location'|'atlas'|'entrance'|'transition';
export interface IdentityTarget {kind:TargetKind;id:string;mapId:MapId;}
export interface LocalCamera {position:[number,number,number];target:[number,number,number];up:[number,number,number];zoom:number;center:[number,number];}
export interface LocalView {mapId:MapId;projection:ProjectionId;native:'3d'|'topdown';camera:LocalCamera|null;layers:Record<VisibilityId,boolean>;opacity:Record<LayerId,number>;selected:IdentityTarget|null;}
export interface Bookmark {id:string;name:string;note:string;created:number;target:IdentityTarget|null;view:LocalView|null;}
export interface Recent {target:IdentityTarget|null;bookmarkId:string|null;viewed:number;}
export interface TourStop {id:string;target:IdentityTarget;duration:number;title:string;}
export interface UserTour {id:string;name:string;stops:TourStop[];created:number;}
export interface UserPreferences {opacity:Record<LayerId,number>;visibility:Record<VisibilityId,boolean>;scale:boolean;}
export interface GaiaUserState {schema:'gaiagis-user-state';version:1;bookmarks:Bookmark[];recent:Recent[];tours:UserTour[];preferences:UserPreferences;}
export const freshUserState=():GaiaUserState=>({schema:'gaiagis-user-state',version:1,bookmarks:[],recent:[],tours:[],preferences:{opacity:defaultOpacities(),visibility:defaultVisibility(),scale:true}});
const fail=()=>{throw Error('Invalid local user state');};
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))return fail();return v as Record<string,unknown>;};
const shape=(o:Record<string,unknown>,keys:readonly string[])=>Object.keys(o).length===keys.length&&keys.every(k=>k in o);
export const validIdentityId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9][\w:.-]{0,159}$/.test(v);
const text=(v:unknown,max=120):v is string=>typeof v==='string'&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
const number=(v:unknown,min=0,max=1e15):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function parseTarget(value:unknown):IdentityTarget {const v=object(value);if(!shape(v,['kind','id','mapId'])||!['location','atlas','entrance','transition'].includes(String(v.kind))||!validIdentityId(v.id)||!['WM0','WM2','WM3'].includes(String(v.mapId)))fail();return {...v} as unknown as IdentityTarget;}
function record<T>(value:unknown,validate:(v:unknown)=>boolean,ids:readonly string[]=layerIds){const v=object(value),legacy=ids.filter(id=>!['slope','aspect','service-area'].includes(id));if((!shape(v,ids)&&!shape(v,legacy))||!Object.values(v).every(validate))fail();const defaults=ids===visibilityIds?defaultVisibility():defaultOpacities();return {...defaults,...v} as Record<LayerId,T>;}
export function parseLocalView(value:unknown):LocalView {
 const v=object(value);if(!shape(v,['mapId','projection','native','camera','layers','opacity','selected'])||!['WM0','WM2','WM3'].includes(String(v.mapId))||!Object.hasOwn(projectionRegistry,String(v.projection))||!['3d','topdown'].includes(String(v.native)))fail();
 let camera:LocalCamera|null=null;if(v.camera!==null){const c=object(v.camera),vector=(x:unknown,n:number)=>Array.isArray(x)&&x.length===n&&x.every(p=>number(p,-1e9,1e9));if(!shape(c,['position','target','up','zoom','center'])||!vector(c.position,3)||!vector(c.target,3)||!vector(c.up,3)||!vector(c.center,2)||!number(c.zoom,.001,10000))fail();camera=structuredClone(c) as unknown as LocalCamera;if(Math.hypot(...camera.up)<1e-8||Math.hypot(...camera.position.map((x,i)=>x-camera!.target[i]))<1e-8||Math.abs(camera.center[0])>180||Math.abs(camera.center[1])>90)fail();}
 const selected=v.selected===null?null:parseTarget(v.selected);if(selected&&selected.mapId!==v.mapId)fail();
 return {mapId:v.mapId as MapId,projection:v.projection as ProjectionId,native:v.native as '3d'|'topdown',camera,layers:record<boolean>(v.layers,x=>typeof x==='boolean',visibilityIds) as Record<VisibilityId,boolean>,opacity:record<number>(v.opacity,x=>number(x,0,1)),selected};
}
export function parseTour(value:unknown):UserTour {const v=object(value);if(!shape(v,['id','name','stops','created'])||!validIdentityId(v.id)||!text(v.name)||!v.name||!number(v.created)||!Array.isArray(v.stops)||v.stops.length>100)fail();const ids=new Set<string>();const stops=(v.stops as unknown[]).map(value=>{const s=object(value);if(!shape(s,['id','target','duration','title'])||!validIdentityId(s.id)||ids.has(s.id)||!number(s.duration,1,120)||!text(s.title))fail();ids.add(s.id as string);return {id:s.id as string,target:parseTarget(s.target),duration:s.duration as number,title:s.title as string};});return {id:v.id as string,name:v.name as string,created:v.created as number,stops};}
export function validateUserState(value:unknown):GaiaUserState {
 const v=object(value);if(!shape(v,['schema','version','bookmarks','recent','tours','preferences'])||v.schema!=='gaiagis-user-state'||v.version!==1||!Array.isArray(v.bookmarks)||v.bookmarks.length>200||!Array.isArray(v.recent)||v.recent.length>RECENT_LIMIT||!Array.isArray(v.tours)||v.tours.length>30)fail();
 const ids=new Set<string>(),bookmarks=(v.bookmarks as unknown[]).map(value=>{const b=object(value);if(!shape(b,['id','name','note','created','target','view'])||!validIdentityId(b.id)||ids.has(b.id)||!text(b.name)||!b.name||!text(b.note,300)||!number(b.created)||(b.target===null)===(b.view===null))fail();ids.add(b.id as string);return {id:b.id as string,name:b.name as string,note:b.note as string,created:b.created as number,target:b.target===null?null:parseTarget(b.target),view:b.view===null?null:parseLocalView(b.view)};});
 const recent=(v.recent as unknown[]).map(value=>{const r=object(value);if(!shape(r,['target','bookmarkId','viewed'])||!number(r.viewed)||(r.target===null)===(r.bookmarkId===null)||r.bookmarkId!==null&&!ids.has(String(r.bookmarkId)))fail();return {target:r.target===null?null:parseTarget(r.target),bookmarkId:r.bookmarkId as string|null,viewed:r.viewed as number};});
 const tours=(v.tours as unknown[]).map(parseTour);if(new Set(tours.map(t=>t.id)).size!==tours.length)fail();const prefs=object(v.preferences);if(!shape(prefs,['opacity','visibility','scale'])||typeof prefs.scale!=='boolean')fail();return {schema:'gaiagis-user-state',version:1,bookmarks,recent,tours,preferences:{opacity:record<number>(prefs.opacity,x=>number(x,0,1)),visibility:record<boolean>(prefs.visibility,x=>typeof x==='boolean',visibilityIds) as Record<VisibilityId,boolean>,scale:prefs.scale as boolean}};
}
export function migrateUserState(value:unknown):GaiaUserState {const v=object(value);if(v.schema==='gaiagis-user-state'&&v.version===0&&Array.isArray(v.favorites)&&v.favorites.length<=200){const state=freshUserState();state.bookmarks=v.favorites.map((target,i)=>({id:'migrated-'+i,name:parseTarget(target).id,note:'',created:0,target:parseTarget(target),view:null}));return state;}return validateUserState(value);}
export interface StoragePort {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void;}
export class UserStateStorage {
 state=freshUserState();status:'saved'|'memory'|'recovered'='saved';private listeners=new Set<()=>void>();
 constructor(private port:StoragePort|null){try{const raw=port?.getItem(USER_STATE_KEY);if(raw){if(raw.length>400_000)fail();this.state=migrateUserState(JSON.parse(raw));}if(!port)this.status='memory';}catch{this.status='recovered';}}
 subscribe(listener:()=>void){this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
 update(edit:(state:GaiaUserState)=>void){const next=structuredClone(this.state);edit(next);this.state=validateUserState(next);try{if(!this.port)throw Error('Storage unavailable');const serialized=JSON.stringify(this.state);if(serialized.length>400_000)throw Error('Local state size limit');this.port.setItem(USER_STATE_KEY,serialized);this.status='saved';}catch{this.status='memory';}for(const l of this.listeners)l();}
 addRecent(target:IdentityTarget|null,bookmarkId:string|null=null,now=Date.now()){this.update(s=>{const key=(r:Recent)=>r.bookmarkId?'bookmark:'+r.bookmarkId:JSON.stringify(r.target),next={target,bookmarkId,viewed:now};s.recent=[next,...s.recent.filter(r=>key(r)!==key(next))].slice(0,RECENT_LIMIT);});}
 deleteBookmark(id:string){this.update(s=>{s.bookmarks=s.bookmarks.filter(b=>b.id!==id);s.recent=s.recent.filter(r=>r.bookmarkId!==id);});}
 clear(group:'all'|'bookmarks'|'recent'|'tours'|'preferences'){this.update(s=>{if(group==='all')Object.assign(s,freshUserState());else if(group==='preferences')s.preferences=freshUserState().preferences;else {s[group]=[];if(group==='bookmarks')s.recent=s.recent.filter(r=>r.bookmarkId===null);}});}
 get bytes(){return new TextEncoder().encode(JSON.stringify(this.state)).byteLength;}
}
let singleton:UserStateStorage|undefined;
export function userStateStorage(){if(!singleton){let port:StoragePort|null=null;try{port=localStorage;}catch{}singleton=new UserStateStorage(port);}return singleton;}
