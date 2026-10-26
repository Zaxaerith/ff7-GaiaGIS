// SPDX-License-Identifier: GPL-3.0-only
import type {WM0Source} from './wm0Source';
import {tinGradient,aspectCategory} from './spatial';
import type {TinPoint} from './spatial';

export const regionalSlopeBins=[[0,5],[5,15],[15,30],[30,45],[45,60],[60,75],[75,90]] as const;
export const regionalDirections=['N','NE','E','SE','S','SW','W','NW'] as const;
export type RegionalAxis='region'|'terrain';
export type RegionalSort='id'|'count'|'area';
export interface RegionalMetrics {
 faces:number;area:number;zeroXZ:number;yMin:number|null;yMax:number|null;duplicateMembers:number;
 slopeFaces:number;slopeArea:number;slopeMean:number|null;slopeAreas:number[];
 aspectFaces:number;aspectArea:number;aspectAreas:number[];flatFaces:number;flatArea:number;
}
export interface RegionalCell {key:string;region:number;terrain:number;faces:number[];count:number;area:number;}
export interface RegionalGroup {id:number;summary:RegionalMetrics;cells:RegionalCell[];}
export interface RegionalTerrainStatistics {
 sourceSHA:string;global:RegionalMetrics;regions:ReadonlyMap<number,RegionalGroup>;terrains:ReadonlyMap<number,RegionalGroup>;cells:ReadonlyMap<string,RegionalCell>;
 marginals:{faces:number[];areas:number[];consistent:boolean};milliseconds:number;
}
type Accumulator=RegionalMetrics&{slopeSum:number};
const accumulator=():Accumulator=>({faces:0,area:0,zeroXZ:0,yMin:null,yMax:null,duplicateMembers:0,slopeFaces:0,slopeArea:0,slopeMean:null,slopeSum:0,slopeAreas:Array(7).fill(0),aspectFaces:0,aspectArea:0,aspectAreas:Array(8).fill(0),flatFaces:0,flatArea:0});
const finish=({slopeSum,...a}:Accumulator):RegionalMetrics=>({...a,slopeMean:a.slopeArea>0?slopeSum/a.slopeArea:null});
const cache=new WeakMap<WM0Source,RegionalTerrainStatistics>();
export const contributionPercent=(value:number,total:number)=>total>0?100*value/total:null;

/** One BASE source pass. No encounter aliases, periodic copies or geometry union.
 * Only compact cell face-ID lists survive; coordinates remain with WM0Source. */
export function createRegionalTerrain(source:WM0Source):RegionalTerrainStatistics {
 const previous=cache.get(source);if(previous)return previous;
 const began=performance.now(),global=accumulator(),regions=new Map<number,{summary:Accumulator;cells:RegionalCell[]}>(),terrains=new Map<number,{summary:Accumulator;cells:RegionalCell[]}>(),cells=new Map<string,RegionalCell>();
 const group=(map:typeof regions,id:number)=>{let g=map.get(id);if(!g){g={summary:accumulator(),cells:[]};map.set(id,g);}return g;};
 for(let face=0;face<source.count;face++){
  const a=source.source(face);if(a.origin||a.region===null||a.terrain===null)throw Error('WM0 BASE attributes required');
  const points=source.corners(face),metric=source.metrics(face),area=metric.area,gradient=tinGradient(points as TinPoint[]),r=group(regions,a.region),t=group(terrains,a.terrain),key=`${a.region}/${a.terrain}`;
  let cell=cells.get(key);if(!cell){cell={key,region:a.region,terrain:a.terrain,faces:[],count:0,area:0};cells.set(key,cell);r.cells.push(cell);t.cells.push(cell);}
  cell.count++;cell.area+=area;cell.faces.push(face);
  const low=Math.min(...points.map(p=>p[2])),high=Math.max(...points.map(p=>p[2]));
  for(const s of [global,r.summary,t.summary]){
   s.faces++;s.area+=area;s.zeroXZ+=Number(metric.zeroXZ);s.duplicateMembers+=Number(metric.duplicateCount>1);
   s.yMin=s.yMin===null?low:Math.min(s.yMin,low);s.yMax=s.yMax===null?high:Math.max(s.yMax,high);
   if(gradient.slope!==null){s.slopeFaces++;s.slopeArea+=area;s.slopeSum+=area*gradient.slope;const bin=regionalSlopeBins.findIndex(([,end])=>gradient.slope!<end);s.slopeAreas[bin<0?6:bin]+=area;}
   if(gradient.aspect===null){if(gradient.slope!==null){s.flatFaces++;s.flatArea+=area;}}
   else{s.aspectFaces++;s.aspectArea+=area;s.aspectAreas[aspectCategory(gradient.aspect)]+=area;}
  }
 }
 const finalized=(map:typeof regions)=>new Map([...map].sort(([a],[b])=>a-b).map(([id,g])=>[id,{id,summary:finish(g.summary),cells:g.cells}]));
 const total=finish(global),byRegion=finalized(regions),byTerrain=finalized(terrains);
 const faceTotals=[total.faces,...[byRegion,byTerrain].map(m=>[...m.values()].reduce((sum,g)=>sum+g.summary.faces,0)),[...cells.values()].reduce((sum,c)=>sum+c.count,0)];
 const areaTotals=[total.area,...[byRegion,byTerrain].map(m=>[...m.values()].reduce((sum,g)=>sum+g.summary.area,0)),[...cells.values()].reduce((sum,c)=>sum+c.area,0)];
 const result={sourceSHA:source.sourceSHA,global:total,regions:byRegion,terrains:byTerrain,cells,marginals:{faces:faceTotals,areas:areaTotals,consistent:faceTotals.every(n=>n===total.faces)&&areaTotals.every(n=>n===total.area)},milliseconds:performance.now()-began};
 cache.set(source,result);return result;
}
export function releaseRegionalTerrain(source:WM0Source){cache.delete(source);}

/** Sorts at most the categorical cells, never rescans source geometry. */
export function regionalDistribution(stats:RegionalTerrainStatistics,axis:RegionalAxis,id:number,sort:RegionalSort='area'){
 const group=(axis==='region'?stats.regions:stats.terrains).get(id);if(!group)return [];
 return group.cells.map(cell=>({cell,id:axis==='region'?cell.terrain:cell.region,countPercent:contributionPercent(cell.count,group.summary.faces),areaPercent:contributionPercent(cell.area,group.summary.area)}))
  .sort((a,b)=>(sort==='count'?b.cell.count-a.cell.count:sort==='area'?b.cell.area-a.cell.area:0)||a.id-b.id);
}
