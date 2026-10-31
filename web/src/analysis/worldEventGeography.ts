// SPDX-License-Identifier: GPL-3.0-only
import type {WM0Source} from './wm0Source';
import type {EventsDataset} from '../data/events';
/** Source-face union, never a polygon union, runtime area or placement footprint. */
export function createWorldEventGeography(source:WM0Source,data:EventsDataset){
 if(data.sources['wm0.map']!==source.sourceSHA)throw Error('World event source mismatch');
 const key=(s:number,m:number,t:number)=>`${s}/${m}/${t}`,wanted=new Map<string,number>(),byFace=new Map<number,string[]>(),eventFaces=new Map<string,number[]>();
 for(const e of data.events)for(const t of e.trigger_triangle_ids)wanted.set(key(e.section_id,e.mesh_id,t),-1);
 for(let i=0;i<source.count;i++){const s=source.source(i),k=key(s.section!,s.mesh!,s.triangle!);if(wanted.has(k)){if(wanted.get(k)!>=0)throw Error('Ambiguous source identity');wanted.set(k,i);}}
 if([...wanted.values()].some(i=>i<0))throw Error('Missing event Source Face');
 for(const e of data.events){const faces=[...new Set(e.trigger_triangle_ids.map(t=>wanted.get(key(e.section_id,e.mesh_id,t))!))];eventFaces.set(e.id,faces);for(const f of faces){const list=byFace.get(f)??[];list.push(e.id);byFace.set(f,list);}}
 const triggers=data.events.filter(e=>e.trigger_triangle_ids.length),placements=data.events.filter(e=>!e.trigger_triangle_ids.length);
 return {source,data,triggers,placements,eventFaces,byFace,
  query(region?:number,terrain?:number,eventId?:string){
   const ids=eventId===undefined?[...byFace.keys()]:eventFaces.get(eventId)??[],faces=ids.filter(id=>{const s=source.source(id);return (region===undefined||s.region===region)&&(terrain===undefined||s.terrain===terrain);}).sort((a,b)=>a-b),regions=new Map<number,{faces:number;area:number}>(),terrains=new Map<number,{faces:number;area:number}>();let area=0,zero=0,duplicates=0;
   for(const f of faces){const s=source.source(f),m=source.metrics(f);area+=m.area;zero+=Number(m.zeroXZ);duplicates+=Number(m.duplicateCount>1);for(const [map,id]of [[regions,s.region!],[terrains,s.terrain!]] as const){const row=map.get(id)??{faces:0,area:0};row.faces++;row.area+=m.area;map.set(id,row);}}
   return {faces,area,zero,duplicates,regions,terrains};
  }};
}
