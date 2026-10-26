// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect,vi} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createRegionalTerrain,releaseRegionalTerrain,regionalDistribution,contributionPercent} from '../src/analysis/regionalTerrain';
import {createWM0Source,WM0_SOURCE_SHA} from '../src/analysis/wm0Source';
import type {WM0Source} from '../src/analysis/wm0Source';
import type {NativePoint} from '../src/analysis/native';
import {nativeTriangle} from '../src/analysis/native';
import {parseMesh} from '../src/data/mesh';
import {regionalTerrainCatalog} from '../src/i18n/regionalTerrainCatalog';
import {dictionaries,locales} from '../src/i18n';

interface Face {region:number;terrain:number;points:NativePoint[];duplicates?:number;}
const flat=(width=2,height=2,x=0,y=7):NativePoint[]=>[[x,0,y],[x+width,0,y],[x,height,y]];
function source(faces:Face[]):WM0Source{
 const metrics=faces.map(f=>({...nativeTriangle(f.points),bounds:[0,1,0,1],duplicateCount:f.duplicates??1}));
 return {count:faces.length,sourceSHA:WM0_SOURCE_SHA,summary:{faces:faces.length,corners:faces.length*3,zeroXZ:0,degenerate3D:0,duplicateExcess:0,milliseconds:0},corners:i=>faces[i].points,metrics:i=>metrics[i],source:i=>({origin:0,map:0,region:faces[i].region,terrain:faces[i].terrain,script:0,texture:0,chocobo:false,section:0,mesh:0,triangle:i,capTriangle:null,mapId:'WM0',sourceSHA:WM0_SOURCE_SHA,sourceFace:i,wrapOffset:0})};
}
describe('regional source aggregation',()=>{
 it('preserves raw IDs, Unknown categories, both denominators and marginal sums',()=>{
  const s=createRegionalTerrain(source([
   {region:16,terrain:16,points:flat()}, // area 2
   {region:16,terrain:24,points:flat(6)}, // area 6
   {region:17,terrain:16,points:flat(8)}, // area 8
   {region:17,terrain:21,points:flat()},
   {region:17,terrain:26,points:flat()},
  ]));
  expect([...s.regions.keys()]).toEqual([16,17]);expect([...s.terrains.keys()]).toEqual([16,21,24,26]);expect(s.global).toMatchObject({faces:5,area:20});
  expect(s.marginals).toEqual({faces:[5,5,5,5],areas:[20,20,20,20],consistent:true});expect(s.cells.size).toBe(5);
  expect(regionalDistribution(s,'region',16,'id').map(r=>[r.id,r.countPercent,r.areaPercent])).toEqual([[16,50,25],[24,50,75]]);
  expect(regionalDistribution(s,'terrain',16,'id').map(r=>[r.id,r.countPercent,r.areaPercent])).toEqual([[16,50,20],[17,50,80]]);
  expect(regionalDistribution(s,'region',16,'area').map(r=>r.id)).toEqual([24,16]);expect(regionalDistribution(s,'region',16,'count').map(r=>r.id)).toEqual([16,24]);
 });
 it('retains zero-area counts and all corner Y extremes without inventing percentages',()=>{
  const wall:NativePoint[]=[[0,0,-738],[0,0,4086],[0,2,0]],s=createRegionalTerrain(source([{region:0,terrain:0,points:flat()},{region:0,terrain:21,points:wall}]));
  expect(s.global).toMatchObject({faces:2,area:2,zeroXZ:1,yMin:-738,yMax:4086,slopeFaces:1,slopeMean:0,aspectArea:0,flatArea:2});
  expect(s.terrains.get(21)?.summary).toMatchObject({faces:1,area:0,yMin:-738,yMax:4086,slopeMean:null,slopeArea:0,aspectArea:0});
  expect(regionalDistribution(s,'terrain',21)[0]).toMatchObject({countPercent:100,areaPercent:null});expect(contributionPercent(0,0)).toBeNull();
  expect(regionalDistribution(s,'region',0).find(r=>r.id===21)).toMatchObject({countPercent:50,areaPercent:0});expect(contributionPercent(s.global.aspectArea,s.global.area)).toBe(0);
  const empty=createRegionalTerrain(source([]));expect(empty.global).toMatchObject({faces:0,yMin:null,yMax:null,slopeMean:null});expect(empty.marginals.consistent).toBe(true);
 });
 it('keeps duplicate source identities and their full area contributions',()=>{
  const p=flat(),s=createRegionalTerrain(source([{region:0,terrain:1,points:p,duplicates:2},{region:0,terrain:1,points:p.slice().reverse(),duplicates:2}]));
  expect(s.global).toMatchObject({faces:2,area:4,duplicateMembers:2});expect(s.cells.get('0/1')).toMatchObject({count:2,area:4,faces:[0,1]});
 });
 it('uses defined-aspect area for eight directions and all positive area for coverage',()=>{
  const gradients=[[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1],[1,0],[1,1]];
  const faces:Face[]=gradients.map(([east,south])=>({region:0,terrain:0,points:[[0,0,0],[2,0,2*east],[0,2,2*south]]}));
  faces.push({region:0,terrain:0,points:flat()},{region:0,terrain:0,points:[[0,0,0],[0,0,20],[0,2,0]]});
  const s=createRegionalTerrain(source(faces)).global;
  expect(s).toMatchObject({faces:10,area:18,zeroXZ:1,slopeFaces:9,slopeArea:18,aspectFaces:8,aspectArea:16,flatFaces:1,flatArea:2});
  expect(s.aspectAreas).toEqual(Array(8).fill(2));expect(s.slopeAreas).toEqual([2,0,0,0,16,0,0]);expect(contributionPercent(s.aspectArea,s.area)).toBeCloseTo(88.8888889);
  expect(s.aspectAreas.map(a=>contributionPercent(a,s.aspectArea))).toEqual(Array(8).fill(12.5));
 });
 it('collinear/vertical faces have undefined slope and aspect, not invented north',()=>{
  const s=createRegionalTerrain(source([{region:0,terrain:0,points:[[0,0,0],[1,1,1],[2,2,2]]}])).global;
  expect(s).toMatchObject({zeroXZ:1,slopeFaces:0,slopeMean:null,aspectFaces:0,aspectArea:0});expect(s.aspectAreas).toEqual(Array(8).fill(0));
 });
 it('counts each stored X/Z boundary identity once without periodic copies or Z connections',()=>{
  const west=flat(),east=west.map(([x,z,y])=>[294912-x,z,y] as NativePoint),north=west.map(([x,z,y])=>[x,229376-z,y] as NativePoint);
  const s=createRegionalTerrain(source([{region:16,terrain:21,points:west},{region:16,terrain:21,points:east},{region:17,terrain:21,points:north}]));
  expect(s.global).toMatchObject({faces:3,area:6});expect(s.cells.get('16/21')?.faces).toEqual([0,1]);expect(s.cells.get('17/21')?.faces).toEqual([2]);
 });
 it('sorts and pages from existing cell IDs, caching only the current source identity',()=>{
  const a=source([{region:0,terrain:0,points:flat()},{region:0,terrain:1,points:flat(6)}]);a.corners=vi.fn(a.corners);a.metrics=vi.fn(a.metrics);
  const first=createRegionalTerrain(a);for(let i=0;i<3;i++){expect(createRegionalTerrain(a)).toBe(first);for(const sort of ['id','count','area'] as const)regionalDistribution(first,'region',0,sort);first.cells.get('0/0')?.faces.slice(0,50);}
  expect(a.corners).toHaveBeenCalledTimes(2);expect(a.metrics).toHaveBeenCalledTimes(2);
  releaseRegionalTerrain(a);const b=source([{region:17,terrain:21,points:flat()}]),next=createRegionalTerrain(b);expect(next.regions.has(0)).toBe(false);expect(next.cells.has('0/0')).toBe(false);expect(createRegionalTerrain(a)).not.toBe(first);expect(a.corners).toHaveBeenCalledTimes(4);
 });
 for(const locale of locales)it('has all new labels in '+locale,()=>{for(const [key]of regionalTerrainCatalog)expect(dictionaries[locale][key]?.length).toBeGreaterThan(0);});
});

const workspace=process.env.GAIA_BROWSER_WORKSPACE??fileURLToPath(new URL('../../output/local-workspace/',import.meta.url));
it.skipIf(!existsSync(resolve(workspace,'gaia-meta.json'))||!existsSync(resolve(workspace,'gaia-mesh.bin')))('product aggregation matches the existing real-source research baseline',()=>{
 const meta=JSON.parse(readFileSync(resolve(workspace,'gaia-meta.json'),'utf8')),bytes=readFileSync(resolve(workspace,'gaia-mesh.bin')),mesh=parseMesh(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),meta);
 // Only the product aggregator runs: no second oracle pass or original MAP.
 const source=createWM0Source(mesh,meta),s=createRegionalTerrain(source);
 expect(s.regions.size).toBe(18);expect(s.terrains.size).toBe(29);expect(s.cells.size).toBe(161);
 expect(s.global).toMatchObject({faces:142586,area:67692515599,zeroXZ:246,duplicateMembers:168,yMin:-738,yMax:4086,slopeArea:67692515599,aspectArea:14822476168,flatArea:52870039431});
 expect(s.global.slopeMean).toBeCloseTo(5.036422,6);expect(contributionPercent(s.global.aspectArea,s.global.area)).toBeCloseTo(21.8968,4);expect(s.marginals.consistent).toBe(true);
 expect(s.regions.get(17)?.summary).toMatchObject({faces:87361,area:45608028623.5});expect(s.regions.get(11)?.summary).toMatchObject({faces:8509,yMin:-738,yMax:4086});expect(s.regions.get(11)?.summary.slopeMean).toBeCloseTo(26.482229,6);
 expect(s.terrains.get(21)?.summary).toMatchObject({faces:236,area:52783225});
 for(const [key,count,area]of [['17/3',87341,45600155477.5],['17/26',20,7873146],['11/10',1908,868412552],['4/24',306,143581279.5],['16/1',91,18225689]] as const)expect(s.cells.get(key)).toMatchObject({count,area});
 const research=new URL('../../output/dev/current/research/v5.5-regional-statistics.md',import.meta.url);
 if(existsSync(research)){
  let checked=0;const appendix=readFileSync(research,'utf8').split('## 附：Region × Terrain 稀疏交叉表')[1];
  for(const line of appendix.split('\n')){const row=line.match(/^\| (\d+) \| (.*) \|$/);if(!row)continue;for(const item of row[2].matchAll(/T(\d+): (\d+)\/([\d.]+)/g)){expect(s.cells.get(row[1]+'/'+item[1])).toMatchObject({count:Number(item[2]),area:Number(item[3])});checked++;}}
  expect(checked).toBe(161);
 }
 expect(createRegionalTerrain(source)).toBe(s);console.log(JSON.stringify({regionalTerrain:{faces:s.global.faces,regions:s.regions.size,terrains:s.terrains.size,cells:s.cells.size,area:s.global.area,slopeMean:s.global.slopeMean,aspectCoverage:contributionPercent(s.global.aspectArea,s.global.area),milliseconds:s.milliseconds}}));
},10000);
