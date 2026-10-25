// SPDX-License-Identifier: GPL-3.0-only
import type {WM0Source} from './wm0Source';
import type {RoutingData} from '../data/routing';
import {nativePoint} from './native';
import {WM0_EXTENT} from '../explorer/coordinates';

// Same exact XYZ edge occurrence convention as Native analysis. WM0 adds a
// separate E/W relation; it never modulo-welds raw edges or the Z boundaries.
export const topologyFilters=['all','boundary','nonmanifold','collapsed','duplicate','periodic','ambiguous'] as const;
export type TopologyFilter=typeof topologyFilters[number];
const BOUNDARY=1,NONMANIFOLD=2,COLLAPSED=4,DUPLICATE=8,PERIODIC=16,AMBIGUOUS=32,REPEATED=64;
const bits:Record<TopologyFilter,number>={all:0,boundary:BOUNDARY,nonmanifold:NONMANIFOLD,collapsed:COLLAPSED,duplicate:DUPLICATE,periodic:PERIODIC,ambiguous:AMBIGUOUS};
const cache=new WeakMap<WM0Source,WM0Topology>();
export type WM0Topology=ReturnType<typeof buildTopology>;
export function createWM0Topology(source:WM0Source){let value=cache.get(source);if(!value){value=buildTopology(source);cache.set(source,value);}return value;}
export function releaseWM0Topology(source:WM0Source){cache.delete(source);}

function buildTopology(source:WM0Source){
 const began=performance.now(),n=source.count,total=n*3;
 const faceFlags=new Uint8Array(n),edgeFor=new Uint32Array(total),leader=new Uint32Array(n),duplicateNext=new Int32Array(n).fill(-1);
 const vertices=new Map<string,number>(),edges=new Map<string,number>(),faces=new Map<string,number>();
 const counts:number[]=[],flags:number[]=[],sides:number[]=[],seams=new Map<string,[number,number]>();
 let duplicateExcess=0,duplicateGroups=0;
 for(let face=0;face<n;face++){
  const points=source.corners(face);if(points.length!==3)throw Error('WM0 topology source triangle');points.forEach(nativePoint);
  const ids=points.map(p=>{const key=p.join(',');let id=vertices.get(key);if(id===undefined){id=vertices.size;vertices.set(key,id);}return id;});
  const faceKey=ids.slice().sort((a,b)=>a-b).join('/'),first=faces.get(faceKey);leader[face]=first??face;
  if(first===undefined)faces.set(faceKey,face);else{
   if(duplicateNext[first]===-1)duplicateGroups++;
   duplicateNext[face]=duplicateNext[first];duplicateNext[first]=face;faceFlags[first]|=DUPLICATE;faceFlags[face]|=DUPLICATE;duplicateExcess++;
  }
  for(let slot=0;slot<3;slot++){
   const next=(slot+1)%3,a=ids[slot],b=ids[next],key=a<b?`${a}/${b}`:`${b}/${a}`;
   let edge=edges.get(key);
   if(edge===undefined){
    edge=edges.size;edges.set(key,edge);counts.push(0);flags.push(a===b?COLLAPSED:0);
    const p=points[slot],q=points[next],side=p[0]===q[0]?(p[0]===0?1:p[0]===WM0_EXTENT[0]?2:0):0;sides.push(side);
    if(side){const seamKey=[p.slice(1).join(','),q.slice(1).join(',')].sort().join('|'),pair=seams.get(seamKey)??[-1,-1];pair[side-1]=edge;seams.set(seamKey,pair);flags[edge]|=PERIODIC;}
   }
   edgeFor[face*3+slot]=edge;counts[edge]++;
  }
 }
 const offsets=new Uint32Array(edges.size+1);for(let e=0;e<counts.length;e++)offsets[e+1]=offsets[e]+counts[e];
 const owners=new Uint32Array(total),cursor=offsets.slice(0,-1);for(let o=0;o<total;o++)owners[cursor[edgeFor[o]]++]=o;
 const edgeFlags=Uint8Array.from(flags),side=Uint8Array.from(sides),partner=new Int32Array(edges.size).fill(-1),confirmed=new Uint8Array(edges.size);
 const incidence:Record<number,number>={},multiplicity:Record<number,number>={};
 let collapsedKeys=0,collapsedOccurrences=0,repeatedKeys=0,repeatedOccurrences=0,duplicateEdges=0,geometricAmbiguous=0,periodicPairs=0,periodicEdges=0,periodicUnresolved=0;
 for(let e=0;e<counts.length;e++){
  const count=counts[e];incidence[count]=(incidence[count]??0)+1;
  if(count===1)edgeFlags[e]|=BOUNDARY;else if(count>2)edgeFlags[e]|=NONMANIFOLD;
  let repeated=0,hasDuplicate=false;
  for(let at=offsets[e];at<offsets[e+1];){const f=Math.floor(owners[at]/3);let end=at+1;while(end<offsets[e+1]&&Math.floor(owners[end]/3)===f)end++;if(end-at>1)repeated+=end-at;hasDuplicate||=!!(faceFlags[f]&DUPLICATE);at=end;}
  if(repeated){edgeFlags[e]|=REPEATED;repeatedKeys++;repeatedOccurrences+=repeated;}
  if(hasDuplicate){edgeFlags[e]|=DUPLICATE;duplicateEdges++;}
  if(edgeFlags[e]&COLLAPSED){collapsedKeys++;collapsedOccurrences+=count;}
  if(edgeFlags[e]&(COLLAPSED|NONMANIFOLD|DUPLICATE|REPEATED)){edgeFlags[e]|=AMBIGUOUS;geometricAmbiguous++;}
 }
 for(const [west,east]of seams.values()){
  if(west>=0&&east>=0){
   partner[west]=east;partner[east]=west;
   if(counts[west]===1&&counts[east]===1&&!(edgeFlags[west]&AMBIGUOUS)&&!(edgeFlags[east]&AMBIGUOUS)&&Math.floor(owners[offsets[west]]/3)!==Math.floor(owners[offsets[east]]/3)){confirmed[west]=confirmed[east]=1;periodicPairs++;}
  }
 }
 let unresolvedEdges=0;
 for(let e=0;e<counts.length;e++){
  if(side[e]){periodicEdges++;if(!confirmed[e]){periodicUnresolved++;edgeFlags[e]|=AMBIGUOUS;}}
  unresolvedEdges+=Number(!!(edgeFlags[e]&AMBIGUOUS));
  // Duplicate filter means actual duplicate faces, not every adjacent face.
  for(let at=offsets[e];at<offsets[e+1];at++)faceFlags[Math.floor(owners[at]/3)]|=edgeFlags[e]&~DUPLICATE;
 }
 for(let f=0;f<n;f++)if(leader[f]===f&&duplicateNext[f]>=0){let count=1;for(let i=duplicateNext[f];i>=0;i=duplicateNext[i])count++;multiplicity[count]=(multiplicity[count]??0)+1;}
 const filtered=new Map<TopologyFilter,number[]>();
 const valid=(face:number)=>{if(!Number.isInteger(face)||face<0||face>=n)throw Error('WM0 topology face');};
 const refs=(edge:number)=>Array.from(owners.subarray(offsets[edge],offsets[edge+1]),o=>({face:Math.floor(o/3),slot:o%3}));
 const summary={faces:n,vertexRecords:total,uniqueVertices:vertices.size,edgeKeys:edges.size,edgeRecords:total,incidence,
  boundaryEdges:incidence[1]??0,regularEdges:incidence[2]??0,nonmanifoldEdges:Object.entries(incidence).reduce((s,[k,v])=>s+(Number(k)>2?v:0),0),
  collapsedKeys,collapsedOccurrences,repeatedKeys,repeatedOccurrences,duplicateGroups,duplicateFaces:duplicateExcess+duplicateGroups,duplicateExcess,duplicateEdges,multiplicity,
  geometricAmbiguous,periodicEdges,periodicPairs,periodicUnresolved,unresolvedEdges,milliseconds:performance.now()-began};
 // Discard construction maps and temporary counts. Retain only compact edge
 // incidence/occurrence indices; ordered corner records remain in WM0Source.
 vertices.clear();edges.clear();faces.clear();seams.clear();
 return {source,summary,
  faces(filter:TopologyFilter){let rows=filtered.get(filter);if(!rows){rows=[];for(let f=0;f<n;f++)if(!bits[filter]||faceFlags[f]&bits[filter])rows.push(f);filtered.set(filter,rows);}return rows;},
  duplicates(face:number){valid(face);const rows=[leader[face]];for(let i=duplicateNext[leader[face]];i>=0;i=duplicateNext[i])rows.push(i);return rows.sort((a,b)=>a-b);},
  face(face:number){valid(face);const points=source.corners(face);return [0,1,2].map(slot=>{
   const e=edgeFor[face*3+slot],f=edgeFlags[e],opposite=partner[e],references=refs(e);
   return {id:e,slot,a:points[slot],b:points[(slot+1)%3],key:[points[slot].join(','),points[(slot+1)%3].join(',')].sort().join('|'),incidence:offsets[e+1]-offsets[e],references,
    boundary:!!(f&BOUNDARY),collapsed:!!(f&COLLAPSED),nonmanifold:!!(f&NONMANIFOLD),duplicate:!!(f&DUPLICATE),repeated:!!(f&REPEATED),geometricAmbiguous:!!(f&(COLLAPSED|NONMANIFOLD|DUPLICATE|REPEATED)),ambiguous:!!(f&AMBIGUOUS),
    uniqueRaw:offsets[e+1]-offsets[e]===2&&!(f&(COLLAPSED|NONMANIFOLD|DUPLICATE|REPEATED)),
    periodic:{side:side[e]===1?'west':side[e]===2?'east':null,status:!side[e]?'none':confirmed[e]?'paired':opposite<0?'unmatched':'ambiguous',edge:opposite<0?null:opposite,references:opposite<0?[]:refs(opposite)}};
   });}
 };
}

/** Compare geometry evidence to actual source-matched CSR, never traversal. */
export function compareTopologyRouting(topology:WM0Topology,face:number,routing:RoutingData|null){
 const edges=topology.face(face),source=topology.source,key=(f:number)=>{const s=source.source(f);return `${s.section}/${s.mesh}/${s.triangle}`;};
 const raw=[...new Set(edges.flatMap(e=>e.references.map(r=>r.face)).filter(f=>f!==face))].sort((a,b)=>a-b);
 const periodic=[...new Set(edges.filter(e=>e.periodic.status==='paired').flatMap(e=>e.periodic.references.map(r=>r.face)).filter(f=>f!==face))].sort((a,b)=>a-b);
 const unknown=(reason:'unavailable'|'source_mismatch'|'identity_mismatch')=>({reason,raw,periodic,routing:[] as number[],shared:[] as number[],geometryOnly:[] as number[],routingOnly:[] as number[]});
 if(!routing)return unknown('unavailable');
 if(routing.sourceHash.toLowerCase()!==source.sourceSHA.toLowerCase())return unknown('source_mismatch');
 if(routing.count!==source.count||routing.lineage.get(key(face))!==face)return unknown('identity_mismatch');
 const neighbors=Array.from(routing.neighbors.subarray(routing.offsets[face],routing.offsets[face+1]));
 if([...raw,...periodic,...neighbors].some(f=>f>=source.count||routing.lineage.get(key(f))!==f))return unknown('identity_mismatch');
 const geometric=new Set([...raw,...periodic]),csr=new Set(neighbors);
 return {reason:null,raw,periodic,routing:neighbors,shared:[...geometric].filter(f=>csr.has(f)).sort((a,b)=>a-b),geometryOnly:[...geometric].filter(f=>!csr.has(f)).sort((a,b)=>a-b),routingOnly:neighbors.filter(f=>!geometric.has(f))};
}
