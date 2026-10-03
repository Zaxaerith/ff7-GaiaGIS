// SPDX-License-Identifier: GPL-3.0-only
export type ProjectionId='globe'|'equirectangular'|'mercator'|'mollweide'|'orthographic';
export type GeoPoint=[number,number,number];
export type Position=[number,number,number];
export interface ProjectionContext {radius:number;mercatorLimit:number;centerLon:number;centerLat:number;}
export interface Bounds {minX:number;maxX:number;minY:number;maxY:number;}
export interface GaiaProjection {
  id:ProjectionId; name:string;
  project(lon:number,lat:number,height:number,context:ProjectionContext):Position;
  visibility(lon:number,lat:number,context:ProjectionContext):number;
  bounds(context:ProjectionContext):Bounds;
}
export const radians=(degree:number)=>degree*Math.PI/180;
export const wrapLongitude=(lon:number)=>((lon+180)%360+360)%360-180;
export function fitProjectionToViewport(bounds:Bounds,aspect:number,padding=1.14) {
  if(!(aspect>0)||![bounds.minX,bounds.maxX,bounds.minY,bounds.maxY].every(Number.isFinite)) throw new Error('Invalid viewport/bounds');
  const height=Math.max(bounds.maxY-bounds.minY,(bounds.maxX-bounds.minX)/aspect)*padding;
  return {halfHeight:height/2,halfWidth:height*aspect/2,centerX:(bounds.minX+bounds.maxX)/2,centerY:(bounds.minY+bounds.maxY)/2};
}
