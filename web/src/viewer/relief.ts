// SPDX-License-Identifier: GPL-3.0-only
import type {DisplayMesh} from '../data/display';
export function validateExaggeration(value:number){if(!Number.isFinite(value)||value<0||value>100)throw new Error('Visual relief must be 0–100×');return value;}
export function reliefRadius(height:number,radius:number,exaggeration:number){validateExaggeration(exaggeration);return (radius+height*exaggeration)/radius;}
export function applyRelief(display:DisplayMesh,positions:Float32Array,radius:number,exaggeration:number){for(let i=0;i<positions.length;i+=3){const r=reliefRadius(display.geographic[i+2],radius,exaggeration);positions[i]=display.unitSphere[i]*r;positions[i+1]=display.unitSphere[i+1]*r;positions[i+2]=display.unitSphere[i+2]*r;}return positions;}
