// SPDX-License-Identifier: GPL-3.0-only
import type {GaiaMesh} from './mesh';
import type {GeoPoint,GaiaProjection,ProjectionContext} from '../projections/Projection';

export function unwrap(points:GeoPoint[]):GeoPoint[] {
  const result:GeoPoint[]=[];
  for(const p of points) result.push([p[0]+(result.length?360*Math.round((result.at(-1)![0]-p[0])/360):0),p[1],p[2]]);
  if(Math.max(...result.map(p=>p[0]))-Math.min(...result.map(p=>p[0]))>180.0001) throw new Error('Non-local longitude cell');
  return result;
}
function clip(points:GeoPoint[],limit:number,above:boolean):GeoPoint[] {
  if(!points.length) return [];
  if(points.every(p=>above?p[0]>=limit:p[0]<=limit)) return points;
  const result:GeoPoint[]=[];
  let a=points.at(-1)!,insideA=above?a[0]>=limit:a[0]<=limit;
  for(const b of points) {
    const insideB=above?b[0]>=limit:b[0]<=limit;
    if(insideA!==insideB) {const t=(limit-a[0])/(b[0]-a[0]);result.push([limit,a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])]);}
    if(insideB) result.push(b);
    a=b;insideA=insideB;
  }
  return result;
}
export function splitAntimeridian(points:GeoPoint[]):GeoPoint[][] {
  const unwrapped=unwrap(points),lo=Math.min(...unwrapped.map(p=>p[0])),hi=Math.max(...unwrapped.map(p=>p[0]));
  const first=Math.floor((lo+180)/360),last=Math.max(first,Math.floor((hi+180-1e-9)/360));
  const parts:GeoPoint[][]=[];
  for(let k=first;k<=last;k++) {
    const part=clip(clip(unwrapped,-180+k*360,true),180+k*360,false);
    if(part.length>=3) parts.push(part.map(p=>[p[0]-k*360,p[1],p[2]]));
  }
  return parts;
}
export interface DisplayMesh {geographic:Float32Array;unitSphere:Float32Array;renderToSource:Uint32Array;edgeIndices:Uint32Array;}
export function prepareDisplay(mesh:GaiaMesh):DisplayMesh {
  const geographic:number[]=[],lookup:number[]=[],edges:number[]=[];
  for(let t=0;t<mesh.triangleCount;t++) {
    const tri:GeoPoint[]=[];
    for(let j=0;j<3;j++){const i=mesh.indices[t*3+j]*3;tri.push([mesh.geographic[i],mesh.geographic[i+1],mesh.geographic[i+2]]);}
    let polygon=tri;
    // A pole has no unique longitude. A sector quad fills the map's polar
    // latitude row; both upper corners are the SAME point on the globe.
    // This is display tessellation only, never new canonical source triangles.
    const pole=tri.find(p=>Math.abs(p[1])===90);
    if(pole) {const [a,b]=unwrap(tri.filter(p=>Math.abs(p[1])!==90));polygon=[a,b,[b[0],pole[1],pole[2]],[a[0],pole[1],pole[2]]];}
    const parts=splitAntimeridian(polygon);
    if(!parts.length) throw new Error(`Triangle ${t} disappeared in display split`);
    for(const part of parts) {
      const cornerIndices:number[]=[];
      for(let j=1;j<part.length-1;j++) {
        const ids=[0,j,j+1];
        for(const id of ids) {cornerIndices[id]??=geographic.length/3;geographic.push(...part[id]);}
        lookup.push(t);
      }
      // FF7 grid draws polygon perimeter only, not extra triangulation edges.
      if(t<mesh.sourceTriangleCount) for(let j=0;j<part.length;j++) edges.push(cornerIndices[j],cornerIndices[(j+1)%part.length]);
    }
  }
  const geo=new Float32Array(geographic),sphere=new Float32Array(geo.length);
  for(let i=0;i<geo.length;i+=3){const l=geo[i]*Math.PI/180,p=geo[i+1]*Math.PI/180;sphere[i]=Math.cos(p)*Math.sin(l);sphere[i+1]=Math.sin(p);sphere[i+2]=Math.cos(p)*Math.cos(l);}
  return {geographic:geo,unitSphere:sphere,renderToSource:new Uint32Array(lookup),edgeIndices:new Uint32Array(edges)};
}
export function projectDisplay(display:DisplayMesh,projection:GaiaProjection,context:ProjectionContext,positions:Float32Array=new Float32Array(display.geographic.length),mask:Float32Array=new Float32Array(display.geographic.length/3)) {
  const g=display.geographic;
  if(projection.id==='orthographic') {
    const l=context.centerLon*Math.PI/180,p=context.centerLat*Math.PI/180,cl=Math.cos(l),sl=Math.sin(l),cp=Math.cos(p),sp=Math.sin(p),s=display.unitSphere;
    for(let i=0;i<g.length;i+=3){const front=s[i+2]*cl+s[i]*sl;positions[i]=s[i]*cl-s[i+2]*sl;positions[i+1]=s[i+1]*cp-front*sp;positions[i+2]=0;mask[i/3]=s[i+1]*sp+front*cp;}
  } else {
    for(let i=0;i<g.length;i+=3) {const p=projection.project(g[i],g[i+1],g[i+2],context);positions[i]=p[0];positions[i+1]=p[1];positions[i+2]=p[2];mask[i/3]=projection.visibility(g[i],g[i+1],context);}
    if(projection.id==='mercator') for(let i=0;i<mask.length;i+=3) {const visible=Math.min(mask[i],mask[i+1],mask[i+2]);mask[i]=mask[i+1]=mask[i+2]=visible;}
    if(projection.id==='laea'||projection.id==='aeqd') for(let t=0;t<mask.length;t+=3){
      const limit=projection.id==='laea'?2:Math.PI;let visible=Math.min(mask[t],mask[t+1],mask[t+2]);
      for(const [a,b]of [[0,1],[1,2],[2,0]]){const i=(t+a)*3,j=(t+b)*3;if(Math.hypot(positions[i]-positions[j],positions[i+1]-positions[j+1])>limit)visible=-1;}
      mask[t]=mask[t+1]=mask[t+2]=visible;
    }
  }
  return {positions,mask};
}
