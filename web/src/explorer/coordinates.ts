// SPDX-License-Identifier: GPL-3.0-only
// Fixed V1 Mapping mirror of gaiagis.reconstruction.Mapping; no new definition.
import {globe} from '../projections/globe';
import type {ProjectionContext} from '../projections/Projection';
import {Vector3} from 'three';
export const WM0_EXTENT=[294912,229376] as const;
export function sourceGeographic(x:number,z:number,h:number){return [360*(x/WM0_EXTENT[0]-.5),Math.atan(Math.sinh((WM0_EXTENT[1]/2-z)/(WM0_EXTENT[0]/(2*Math.PI))))*180/Math.PI,h] as [number,number,number];}
export function geographicSource(lon:number,lat:number){return [WM0_EXTENT[0]*(lon/360+.5),WM0_EXTENT[1]/2-WM0_EXTENT[0]/(2*Math.PI)*Math.asinh(Math.tan(lat*Math.PI/180))];}
export function sourceGlobe(x:number,z:number,h:number,relief:number,c:ProjectionContext){const [lon,lat]=sourceGeographic(x,z,h);return new Vector3(...globe.project(lon,lat,h*relief,c));}
export function tangentFrame(position:Vector3){const up=position.clone().normalize(),east=new Vector3(up.z,0,-up.x).normalize(),north=new Vector3().crossVectors(up,east).normalize();return {up,east,north};}
