// SPDX-License-Identifier: GPL-3.0-only
import type {FieldCamera,FieldBackground,BaseTile} from './fieldCamera';
import type {FieldWalkmesh} from './fieldContext';

export interface SpatialSource {kind:'vertex'|'anchor'|'visual';id:string;fieldId:number;xyz?:readonly number[];sourceSHA256?:string;}
export interface CanvasProjection {width:number;height:number;scale:number;centerX:number;centerY:number;}
export interface ProjectionDiagnostic {q:number[]|null;screen:[number,number]|null;canvas:[number,number]|null;reason:'valid'|'missing_camera'|'invalid_numeric'|'invalid_depth';outsideBackground:boolean|null;outsideCanvas:boolean|null;occlusion:'unknown';}
const finite=(a:readonly number[],length:number)=>a.length===length&&a.every(Number.isFinite);
/** Re-encode the preserved Section-5 values, including padding and raw access slots. */
export async function walkmeshSourceHash(mesh:FieldWalkmesh){
 if(mesh.vertices.length!==mesh.triangles*12||mesh.access.length!==mesh.triangles*3)throw Error('Walkmesh shape');
 const raw=new ArrayBuffer(4+mesh.triangles*30),v=new DataView(raw);v.setUint32(0,mesh.triangles,true);
 mesh.vertices.forEach((n,i)=>v.setInt16(4+i*2,n,true));mesh.access.forEach((n,i)=>v.setUint16(4+mesh.vertices.length*2+i*2,n,true));
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),n=>n.toString(16).padStart(2,'0')).join('');
}
/** Same source formula as projectField; this view exposes its intermediate Q12 evidence. */
export function projectionDiagnostic(camera:FieldCamera|null,xyz:readonly number[],bounds?:readonly number[],view?:CanvasProjection):ProjectionDiagnostic{
 const out:ProjectionDiagnostic={q:null,screen:null,canvas:null,reason:'missing_camera',outsideBackground:null,outsideCanvas:null,occlusion:'unknown'};
 if(!camera)return out;
 out.reason='invalid_numeric';if(!finite(xyz,3)||!finite(camera.matrix,9)||!finite(camera.translation,3)||!Number.isFinite(camera.zoom)||camera.zoom<=0)return out;
 const q=[0,1,2].map(i=>camera.translation[i]+[0,1,2].reduce((s,k)=>s+camera.matrix[i*3+k]*xyz[k]/4096,0));out.q=q;
 if(!q.every(Number.isFinite))return out;
 if(q[2]<=1e-6){out.reason='invalid_depth';return out;}
 const screen:[number,number]=[camera.zoom*q[0]/q[2],camera.zoom*q[1]/q[2]];
 if(!screen.every(Number.isFinite))return out;out.reason='valid';out.screen=screen;
 if(bounds&&finite(bounds,4))out.outsideBackground=screen[0]<bounds[0]||screen[0]>=bounds[2]||screen[1]<bounds[1]||screen[1]>=bounds[3];
 if(view&&[view.width,view.height,view.scale,view.centerX,view.centerY].every(Number.isFinite)&&view.scale>0&&view.width>0&&view.height>0){
  // Canvas plane uses upward Y; original background pixel Y points down.
  out.canvas=[view.width/2+(screen[0]-view.centerX)*view.scale,view.height/2-(-screen[1]-view.centerY)*view.scale];
  out.outsideCanvas=out.canvas[0]<0||out.canvas[0]>=view.width||out.canvas[1]<0||out.canvas[1]>=view.height;
 }
 return out;
}

function contains(p:readonly number[],a:readonly number[],b:readonly number[],c:readonly number[]){
 const cross=(u:readonly number[],v:readonly number[],w:readonly number[])=> (v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0]);
 const area=cross(a,b,c);if(!Number.isFinite(area)||Math.abs(area)<1e-10)return false;
 const eps=Math.abs(area)*1e-10,sign=area>0?1:-1;return [cross(a,b,p),cross(b,c,p),cross(c,a,p)].every(v=>v*sign>=-eps);
}
/** All projected 2D footprint candidates, never a unique 3D hit or visible-object claim. */
export function screenAssociations(camera:FieldCamera,mesh:FieldWalkmesh,point:readonly number[],background?:FieldBackground){
 if(!finite(point,2))throw Error('Invalid screen point');
 const triangles:number[]=[],tiles:BaseTile[]=[];let invalidTriangles=0,degenerateTriangles=0;
 if(!Number.isSafeInteger(mesh.triangles)||mesh.triangles<0||mesh.triangles>65535||mesh.vertices.length!==mesh.triangles*12)throw Error('Projection work budget');
 for(let i=0;i<mesh.triangles;i++){
  const pts=[0,1,2].map(k=>projectionDiagnostic(camera,Array.from(mesh.vertices.subarray(i*12+k*4,i*12+k*4+3))).screen);
  if(pts.some(p=>!p)){invalidTriangles++;continue;}
  const a=pts[0]!,b=pts[1]!,c=pts[2]!,area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  if(!Number.isFinite(area)||Math.abs(area)<1e-10){degenerateTriangles++;continue;}
  if(contains(point,a,b,c))triangles.push(i);
 }
 for(const t of background?.tiles??[]){const size=t.size??16;if(point[0]>=t.x&&point[0]<t.x+size&&point[1]>=t.y&&point[1]<t.y+size)tiles.push(t);}
 return {triangles,tiles,invalidTriangles,degenerateTriangles,occlusion:'unknown' as const,uniqueXYZ:false as const};
}
