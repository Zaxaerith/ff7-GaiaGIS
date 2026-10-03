// SPDX-License-Identifier: GPL-3.0-only
import type {GaiaMesh,GaiaMeta} from './mesh';
export interface RegionSummary {id:number;name:string;triangles:number;lon:number;lat:number;concentration:number;}
export function summarizeRegions(mesh:GaiaMesh,meta:GaiaMeta):RegionSummary[]{
  const sums=new Map<number,{triangles:number;x:number;y:number;z:number;area:number}>();
  for(let t=0;t<mesh.triangleCount;t++){
    const a=mesh.attributes(t);if(a.origin||a.region===null)continue;
    const p:number[][]=[];
    for(let j=0;j<3;j++){
      const i=mesh.indices[t*3+j]*3,l=mesh.geographic[i]*Math.PI/180,f=mesh.geographic[i+1]*Math.PI/180;
      p.push([Math.cos(f)*Math.sin(l),Math.sin(f),Math.cos(f)*Math.cos(l)]);
    }
    const ab=p[1].map((v,i)=>v-p[0][i]),ac=p[2].map((v,i)=>v-p[0][i]);
    const area=Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0])/2;
    const s=sums.get(a.region)||{triangles:0,x:0,y:0,z:0,area:0};s.triangles++;s.area+=area;
    s.x+=area*(p[0][0]+p[1][0]+p[2][0])/3;s.y+=area*(p[0][1]+p[1][1]+p[2][1])/3;s.z+=area*(p[0][2]+p[1][2]+p[2][2])/3;sums.set(a.region,s);
  }
  return [...sums].sort(([a],[b])=>a-b).map(([id,s])=>({id,name:meta.region_names[id]||`Region ${id}`,triangles:s.triangles,lon:Math.atan2(s.x,s.z)*180/Math.PI,lat:Math.atan2(s.y,Math.hypot(s.x,s.z))*180/Math.PI,concentration:Math.hypot(s.x,s.y,s.z)/Math.max(s.area,1e-30)}));
}
export const regionColor=(id:number)=>`hsl(${(id*137.508+18)%360}, 46%, 63%)`;
