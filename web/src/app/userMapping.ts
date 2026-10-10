// SPDX-License-Identifier: GPL-3.0-only
import {geographicSource,sourceGeographic,WM0_EXTENT} from '../explorer/coordinates';
import {centralAngle,measureDistance,measureArea,REFERENCE_RADIUS} from '../analysis/sphere';
import type {GeoPoint} from '../projections/Projection';

export const MAPPING_LIMITS={layers:32,features:500,vertices:20_000,perFeature:512,bytes:4*1024*1024} as const;
export interface GameVertex {game_east:number;game_north:number;}
export interface UserGeometry {mapId:'wm0';coordinateSpace:'GaiaGame';vertices:GameVertex[];}
export type GeometryType='Point'|'Polyline'|'Polygon';
export interface UserLayer {id:string;name:string;visible:boolean;opacity:number;order:number;}
export interface UserFeature {id:string;layerId:string;geometryType:GeometryType;geometry:UserGeometry;name:string;note:string;tags:string[];style:{color:string;pointSize:number;fillOpacity:number};createdAt:number;updatedAt:number;}
export interface UserMappingData {userLayers:UserLayer[];userFeatures:UserFeature[];}
export const defaultMapping=():UserMappingData=>({userLayers:[{id:'my-places',name:'My Places',visible:true,opacity:1,order:0}],userFeatures:[]});
const error=(reason:string):never=>{throw Error('Invalid GaiaJSON: '+reason);};
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:error('object required');
const shape=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const num=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const text=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
const id=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9][\w:.-]{0,159}$/.test(v);
export const wrapEast=(east:number)=>((east%WM0_EXTENT[0])+WM0_EXTENT[0])%WM0_EXTENT[0];
export const vertexGeographic=(v:GameVertex):GeoPoint=>sourceGeographic(v.game_east,WM0_EXTENT[1]-v.game_north,0);
export function geographicVertex(p:GeoPoint):GameVertex {const [east,south]=geographicSource(p[0],p[1]);return validateVertex({game_east:wrapEast(east),game_north:WM0_EXTENT[1]-south});}
export function validateVertex(value:unknown):GameVertex {const v=object(value);if(!shape(v,['game_east','game_north'])||!num(v.game_east,0,WM0_EXTENT[0])||v.game_east===WM0_EXTENT[0]||!num(v.game_north,0,WM0_EXTENT[1]))error('finite GaiaGame vertex within WM0 required');return {...v} as unknown as GameVertex;}
type Vector=[number,number,number];
const vector=([lon,lat]:GeoPoint):Vector=>{const l=lon*Math.PI/180,p=lat*Math.PI/180;return [Math.cos(p)*Math.cos(l),Math.cos(p)*Math.sin(l),Math.sin(p)];};
const dot=(a:Vector,b:Vector)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vector,b:Vector):Vector=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normalize=(v:Vector):Vector=>{const n=Math.hypot(...v);if(n<1e-14)error('polygon hemisphere is ambiguous');return v.map(x=>x/n) as Vector;};
/** Gnomonic coordinates preserve minor great-circle edges for simple polygon fill. */
export function polygonPlane(vertices:GameVertex[]){const vectors=vertices.map(v=>vector(vertexGeographic(v))),center=normalize(vectors.reduce((a,b)=>a.map((x,i)=>x+b[i]) as Vector,[0,0,0])),east=normalize(cross(Math.abs(center[2])<.9?[0,0,1]:[0,1,0],center)),north=cross(center,east);return vectors.map(v=>{const d=dot(v,center);if(d<=1e-6)error('polygon must fit an open hemisphere');return [dot(v,east)/d,dot(v,north)/d] as [number,number];});}
/** Stable solid-angle fan without adding/subtracting 2π for small polygons. */
export function polygonArea(vertices:GameVertex[]){const v=vertices.map(p=>vector(vertexGeographic(p)));let angle=0;for(let i=1;i<v.length-1;i++)angle+=2*Math.atan2(dot(v[0],cross(v[i],v[i+1])),1+dot(v[0],v[i])+dot(v[i],v[i+1])+dot(v[i+1],v[0]));while(angle>2*Math.PI)angle-=4*Math.PI;while(angle< -2*Math.PI)angle+=4*Math.PI;return Math.abs(angle)*REFERENCE_RADIUS**2;}
export function validateGeometry(type:GeometryType,value:unknown):UserGeometry {
 const g=object(value);if(!shape(g,['mapId','coordinateSpace','vertices'])||g.mapId!=='wm0'||g.coordinateSpace!=='GaiaGame'||!Array.isArray(g.vertices)||g.vertices.length>MAPPING_LIMITS.perFeature)error('WM0 GaiaGame geometry required');
 const vertices=(g.vertices as unknown[]).map(validateVertex),min=type==='Point'?1:type==='Polyline'?2:type==='Polygon'?3:Infinity;if(vertices.length<min||type==='Point'&&vertices.length!==1)error('vertex count');
 const points=vertices.map(vertexGeographic);for(let i=1;i<points.length;i++)if(centralAngle(points[i-1],points[i])>=Math.PI-1e-7)error('antipodal edge');
 if(type==='Polygon'){
  measureArea(points); // Existing sphere checks: repeated/antipodal/self-crossing edges.
  const plane=polygonPlane(vertices),scale=Math.max(...plane.flat().map(Math.abs),1e-14),eps=scale*scale*1e-12;
  const orientation=(a:number[],b:number[],c:number[])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(let i=0;i<plane.length;i++)for(let j=i+2;j<plane.length;j++){if(i===0&&j===plane.length-1)continue;const a=plane[i],b=plane[(i+1)%plane.length],c=plane[j],d=plane[(j+1)%plane.length],o=[orientation(a,b,c),orientation(a,b,d),orientation(c,d,a),orientation(c,d,b)];if(o[0]*o[1]<0&&o[2]*o[3]<0)error('self-intersecting polygon');if(o.some(x=>Math.abs(x)<=eps)&&Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))+eps&&Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]))+eps)error('touching polygon edges');}
  if(polygonArea(vertices)<1e-8)error('degenerate polygon');
 }
 return {mapId:'wm0',coordinateSpace:'GaiaGame',vertices};
}
export function featureMeasurements(f:UserFeature){const points=f.geometry.vertices.map(vertexGeographic);return {length:f.geometryType==='Point'?0:measureDistance(f.geometryType==='Polygon'?[...points,points[0]]:points).total,area:f.geometryType==='Polygon'?polygonArea(f.geometry.vertices):0};}
export function validateMapping(value:unknown):UserMappingData {
 const m=object(value);if(!shape(m,['userLayers','userFeatures'])||!Array.isArray(m.userLayers)||m.userLayers.length>MAPPING_LIMITS.layers||!Array.isArray(m.userFeatures)||m.userFeatures.length>MAPPING_LIMITS.features)error('layer/feature limits');
 const layers=(m.userLayers as unknown[]).map(value=>{const l=object(value);if(!shape(l,['id','name','visible','opacity','order'])||!id(l.id)||!text(l.name,120)||!l.name||typeof l.visible!=='boolean'||!num(l.opacity,0,1)||!Number.isInteger(l.order)||!num(l.order,0,31))error('layer metadata');return {...l} as unknown as UserLayer;});
 const layerIds=new Set(layers.map(l=>l.id));if(layerIds.size!==layers.length||new Set(layers.map(l=>l.order)).size!==layers.length)error('duplicate layer id/order');let count=0;
 const features=(m.userFeatures as unknown[]).map(value=>{const f=object(value),s=object(f.style);if(!shape(f,['id','layerId','geometryType','geometry','name','note','tags','style','createdAt','updatedAt'])||!id(f.id)||typeof f.layerId!=='string'||!layerIds.has(f.layerId)||!['Point','Polyline','Polygon'].includes(String(f.geometryType))||!text(f.name,120)||!f.name||!text(f.note,1000)||!Array.isArray(f.tags)||f.tags.length>8||!f.tags.every(v=>text(v,32)&&!!v)||new Set(f.tags).size!==f.tags.length||!shape(s,['color','pointSize','fillOpacity'])||typeof s.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(s.color)||!num(s.pointSize,3,18)||!num(s.fillOpacity,0,.6)||!num(f.createdAt,0,8.64e15)||!num(f.updatedAt,Number(f.createdAt),8.64e15))error('feature metadata/style');const geometry=validateGeometry(f.geometryType as GeometryType,f.geometry);count+=geometry.vertices.length;return {...f,geometry,style:{...s},tags:[...(f.tags as string[])]} as unknown as UserFeature;});
 if(count>MAPPING_LIMITS.vertices||new Set(features.map(f=>f.id)).size!==features.length)error('vertex limit/duplicate feature id');return {userLayers:layers,userFeatures:features};
}
export function createFeature(layerId:string,type:GeometryType,vertices:GameVertex[],name:string,featureId:string=crypto.randomUUID(),now=Date.now()):UserFeature{return {id:featureId,layerId,geometryType:type,geometry:validateGeometry(type,{mapId:'wm0',coordinateSpace:'GaiaGame',vertices}),name,note:'',tags:[],style:{color:'#ff82d1',pointSize:10,fillOpacity:.18},createdAt:now,updatedAt:now};}
export function editFeature(m:UserMappingData,id:string,patch:Partial<Pick<UserFeature,'name'|'note'|'tags'|'style'|'layerId'|'geometry'>>,now=Date.now()){const f=m.userFeatures.find(f=>f.id===id);if(!f)error('missing feature');Object.assign(f!,patch,{updatedAt:Math.max(now,f!.createdAt)});}
export function moveFeature(f:UserFeature,east:number,north:number){return validateGeometry(f.geometryType,{...f.geometry,vertices:f.geometry.vertices.map(v=>({game_east:wrapEast(v.game_east+east),game_north:v.game_north+north}))});}
export function deleteLayer(m:UserMappingData,id:string){m.userFeatures=m.userFeatures.filter(f=>f.layerId!==id);m.userLayers=m.userLayers.filter(l=>l.id!==id).sort((a,b)=>a.order-b.order).map((l,order)=>({...l,order}));}
export function reorderLayer(m:UserMappingData,id:string,delta:number){const list=[...m.userLayers].sort((a,b)=>a.order-b.order),i=list.findIndex(l=>l.id===id),j=i+delta;if(i<0||j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]];m.userLayers=list.map((l,order)=>({...l,order}));}
export interface GaiaJSON {schema:'gaiagis-user-features';version:1;coordinateSpace:'GaiaGame';mapId:'wm0';layers:UserLayer[];features:UserFeature[];}
export function exportGaiaJSON(m:UserMappingData){const v=validateMapping({userLayers:m.userLayers,userFeatures:m.userFeatures}),data:GaiaJSON={schema:'gaiagis-user-features',version:1,coordinateSpace:'GaiaGame',mapId:'wm0',layers:v.userLayers,features:v.userFeatures};let text=JSON.stringify(data,null,2);if(new TextEncoder().encode(text).byteLength>MAPPING_LIMITS.bytes)text=JSON.stringify(data);if(new TextEncoder().encode(text).byteLength>MAPPING_LIMITS.bytes)error('export size limit');return text;}
export function importGaiaJSON(text:string):UserMappingData {if(new TextEncoder().encode(text).byteLength>MAPPING_LIMITS.bytes)error('file exceeds 4 MiB');let parsed:unknown;try{parsed=JSON.parse(text);}catch{error('malformed JSON');}const d=object(parsed);if(!shape(d,['schema','version','coordinateSpace','mapId','layers','features'])||d.schema!=='gaiagis-user-features'||d.version!==1||d.coordinateSpace!=='GaiaGame'||d.mapId!=='wm0')error('versioned GaiaJSON required (not GeoJSON/WGS84)');return validateMapping({userLayers:d.layers,userFeatures:d.features});}
export function mergeMapping(m:UserMappingData,incoming:UserMappingData,uid:()=>string=()=>crypto.randomUUID()){const layers=new Map<string,string>(),features=new Set(m.userFeatures.map(f=>f.id));m.userLayers=[...m.userLayers].sort((a,b)=>a.order-b.order).map((l,order)=>({...l,order}));for(const l of [...incoming.userLayers].sort((a,b)=>a.order-b.order)){let next=uid();while(m.userLayers.some(l=>l.id===next))next=uid();layers.set(l.id,next);m.userLayers.push({...l,id:next,order:m.userLayers.length});}for(const f of incoming.userFeatures){let next=uid();while(features.has(next))next=uid();features.add(next);m.userFeatures.push({...structuredClone(f),id:next,layerId:layers.get(f.layerId)!});}validateMapping({userLayers:m.userLayers,userFeatures:m.userFeatures});}


export interface MappingConflict {kind:'layer'|'feature';id:string;name:string;fields:string[];}
/** Stable comparison ignores JSON property insertion order, never vertex order. */
const mappingValue=(v:unknown):string=>JSON.stringify(v,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
export const mappingSnapshot=(m:UserMappingData)=>mappingValue({userLayers:m.userLayers,userFeatures:m.userFeatures});
export function mappingConflicts(current:UserMappingData,incoming:UserMappingData){
 const local=validateMapping({userLayers:current.userLayers,userFeatures:current.userFeatures}),next=validateMapping({userLayers:incoming.userLayers,userFeatures:incoming.userFeatures}),conflicts:MappingConflict[]=[];let added=0,unchanged=0;
 for(const [kind,rows,old]of [['layer',next.userLayers,local.userLayers],['feature',next.userFeatures,local.userFeatures]] as const){for(const row of rows){const existing=old.find(r=>r.id===row.id);if(!existing){added++;continue;}const fields=Object.keys(row).filter(k=>k!=='id'&&(kind!=='layer'||k!=='order')&&mappingValue(row[k as keyof typeof row])!==mappingValue(existing[k as keyof typeof existing]));if(fields.length)conflicts.push({kind,id:row.id,name:row.name,fields});else unchanged++;}}
 return {conflicts,added,unchanged};
}
/** Explicit selected conflicts only. Missing incoming identities never delete local data. */
export function updateMapping(current:UserMappingData,incoming:UserMappingData,accepted:ReadonlySet<string>=new Set()){
 const plan=mappingConflicts(current,incoming),allowed=new Set(plan.conflicts.map(c=>c.kind+':'+c.id));for(const key of accepted)if(!allowed.has(key))error('unknown conflict selection');
 const next=structuredClone({userLayers:current.userLayers,userFeatures:current.userFeatures}),ids=new Set(next.userLayers.map(l=>l.id));next.userLayers.sort((a,b)=>a.order-b.order).forEach((l,order)=>l.order=order);
 for(const l of [...incoming.userLayers].sort((a,b)=>a.order-b.order)){const old=next.userLayers.find(r=>r.id===l.id);if(!old){next.userLayers.push({...l,order:next.userLayers.length});ids.add(l.id);}else if(accepted.has('layer:'+l.id))Object.assign(old,{...l,order:old.order});}
 for(const f of incoming.userFeatures){if(!ids.has(f.layerId))error('missing layer');const i=next.userFeatures.findIndex(r=>r.id===f.id);if(i<0)next.userFeatures.push(structuredClone(f));else if(accepted.has('feature:'+f.id))next.userFeatures[i]=structuredClone(f);}
 const validated=validateMapping(next);current.userLayers=validated.userLayers;current.userFeatures=validated.userFeatures;
}
