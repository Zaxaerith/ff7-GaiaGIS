// SPDX-License-Identifier: GPL-3.0-only
import type {GaiaMesh} from '../data/mesh';
import type {EncounterDataset,EncounterSet} from '../data/encounters';
import {resolveEncounter} from '../data/encounters';
import {geographicSource,sourceGeographic,WM0_EXTENT} from '../explorer/coordinates';
import {centralAngle,REFERENCE_RADIUS} from './sphere';
import {terrainPalette} from '../styles/terrainPalette';
export type TinPoint=[number,number,number]; // east X, south Z, raw height
export function sourceCorners(mesh:GaiaMesh,face:number):TinPoint[]{
 if(face<0||face>=mesh.sourceTriangleCount||mesh.attributes(face).origin)throw Error('Source TIN required');
 return [0,1,2].map(j=>{const i=mesh.indices[face*3+j]*3,p=[...geographicSource(mesh.geographic[i],mesh.geographic[i+1]),mesh.geographic[i+2]];if(p.some(v=>!Number.isFinite(v)||Math.abs(v-Math.round(v))>.125))throw Error('Ambiguous V1 source corner');return p.map(Math.round) as TinPoint;});
}
export function tinGradient(p:TinPoint[],horizontalScale=1,verticalScale=1){
 if(p.length!==3||p.flat().some(v=>!Number.isFinite(v))||!Number.isFinite(horizontalScale)||!Number.isFinite(verticalScale)||horizontalScale<=0||verticalScale<=0)throw Error('Invalid TIN scales');
 const [a,b,c]=p,dx=b[0]-a[0],dz=b[1]-a[1],ex=c[0]-a[0],ez=c[1]-a[1],d=dx*ez-ex*dz;
 if(Math.abs(d)<=1e-10*Math.max(1,Math.hypot(dx,dz)*Math.hypot(ex,ez)))return {slope:null,aspect:null,east:null,south:null};
 const east=((b[2]-a[2])*ez-(c[2]-a[2])*dz)/d*verticalScale/horizontalScale,south=(dx*(c[2]-a[2])-ex*(b[2]-a[2]))/d*verticalScale/horizontalScale,g=Math.hypot(east,south);
 return {slope:Math.atan(g)*180/Math.PI,aspect:g<1e-8?null:(Math.atan2(-east,south)*180/Math.PI+360)%360,east,south};
}
export function surfaceAttributes(mesh:GaiaMesh){const begin=performance.now(),slope=new Float32Array(mesh.sourceTriangleCount).fill(NaN),aspect=slope.slice();for(let i=0;i<slope.length;i++){const a=tinGradient(sourceCorners(mesh,i));slope[i]=a.slope??NaN;aspect[i]=a.aspect??NaN;}return {slope,aspect,elapsedMs:performance.now()-begin,bytes:slope.byteLength+aspect.byteLength};}
export const slopeRamp=[terrainPalette[1],terrainPalette[8],terrainPalette[2],terrainPalette[27]] as const;
export const aspectRamp=[terrainPalette[3],terrainPalette[5],terrainPalette[4],terrainPalette[1],terrainPalette[8],terrainPalette[9],terrainPalette[2],terrainPalette[27]] as const;
export const serviceColor='#83939a',undefinedColor='#586474';
export function aspectCategory(degrees:number){return Math.floor(((degrees+22.5)%360)/45);}
export interface ProfileSample {distance:number;rawHeight:number;elevation:number;triangle:number;}
export interface ExposureRow {id:string;distance:number;percentage:number;set?:EncounterSet;}
export function summarizeProfile(samples:ProfileSample[]){if(!samples.length)return null;let ascent=0,descent=0,min=Infinity,max=-Infinity,previous=-1;for(let i=0;i<samples.length;i++){const s=samples[i];if(!Number.isFinite(s.distance)||!Number.isFinite(s.elevation)||s.distance<previous)throw Error('Invalid profile order');previous=s.distance;min=Math.min(min,s.elevation);max=Math.max(max,s.elevation);if(i){const d=s.elevation-samples[i-1].elevation;ascent+=Math.max(0,d);descent+=Math.max(0,-d);}}return {distance:samples.at(-1)!.distance,min,max,ascent,descent};}
export interface RouteLeg {triangle:number;from:TinPoint;to:TinPoint;distance:number;}
const center=(p:TinPoint[])=>[0,1,2].map(k=>p.reduce((s,v)=>s+v[k]/p.length,0)) as TinPoint;
const distance=(a:TinPoint,b:TinPoint)=>centralAngle(sourceGeographic(...a),sourceGeographic(...b))*REFERENCE_RADIUS;
/** Center → shared source-edge midpoint → center, confined to the solved TIN corridor. */
export function corridorLegs(mesh:GaiaMesh,nodes:number[]):RouteLeg[]{const legs:RouteLeg[]=[];if(nodes.length>mesh.sourceTriangleCount)throw Error('Route length');let a=nodes.length?sourceCorners(mesh,nodes[0]):[];
 if(nodes.length===1){const p=center(a);return [{triangle:nodes[0],from:p,to:p,distance:0}];}
 for(let i=1;i<nodes.length;i++){const b=sourceCorners(mesh,nodes[i]),key=(p:TinPoint)=>`${p[0]%WM0_EXTENT[0]}/${p[1]}/${p[2]}`,shared=a.filter(p=>b.some(q=>key(q)===key(p)));if(shared.length!==2)throw Error('Route edge is not a verified source edge');const mid=center(shared),ca=center(a),cb=center(b),mb=mid.slice() as TinPoint;mb[0]+=Math.round((cb[0]-mb[0])/WM0_EXTENT[0])*WM0_EXTENT[0];for(const [triangle,from,to]of [[nodes[i-1],ca,mid],[nodes[i],mb,cb]] as [number,TinPoint,TinPoint][])legs.push({triangle,from,to,distance:distance(from,to)});a=b;}return legs;
}
/** Single traversal for elevation, terrain and static encounter exposure. */
export function analyzeLegs(mesh:Pick<GaiaMesh,'attributes'>,legs:RouteLeg[],encounters:EncounterDataset|null,verticalScale=1){
 const samples:ProfileSample[]=[],terrain=new Map<string,ExposureRow>(),exposure=new Map<string,ExposureRow>();let total=0,chocoboDistance=0;
 if(!Number.isFinite(verticalScale)||verticalScale<=0)throw Error('Invalid display height scale');
 for(const leg of legs){if(!Number.isFinite(leg.distance)||leg.distance<0)throw Error('Invalid route segment');const a=mesh.attributes(leg.triangle);if(a.origin||a.terrain===null||a.region===null)throw Error('Source attributes required');if(!samples.length)samples.push({distance:0,rawHeight:leg.from[2],elevation:leg.from[2]*verticalScale,triangle:leg.triangle});total+=leg.distance;samples.push({distance:total,rawHeight:leg.to[2],elevation:leg.to[2]*verticalScale,triangle:leg.triangle});
  const add=(m:Map<string,ExposureRow>,id:string,set?:EncounterSet)=>{const r=m.get(id)??{id,distance:0,percentage:0,set};r.distance+=leg.distance;m.set(id,r);};add(terrain,String(a.terrain));if(encounters){const {set}=resolveEncounter(encounters,a.region,a.terrain);add(exposure,set.id,set);}if(a.chocobo)chocoboDistance+=leg.distance;
 }
 const rows=(m:Map<string,ExposureRow>)=>[...m.values()].map(r=>({...r,percentage:total?r.distance/total*100:0})).sort((a,b)=>b.distance-a.distance||a.id.localeCompare(b.id));return {samples,metrics:summarizeProfile(samples),terrain:rows(terrain),exposure:rows(exposure),encountersAvailable:!!encounters,chocoboDistance,total};
}
export function analyzeRoute(mesh:GaiaMesh,nodes:number[],encounters:EncounterDataset|null){const begin=performance.now(),result=analyzeLegs(mesh,corridorLegs(mesh,nodes),encounters);return {...result,elapsedMs:performance.now()-begin};}
