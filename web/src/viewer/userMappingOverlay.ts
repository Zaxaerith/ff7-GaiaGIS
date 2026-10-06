// SPDX-License-Identifier: GPL-3.0-only
import {BufferAttribute,BufferGeometry,Color,DoubleSide,LineSegments,Mesh,Points,Raycaster,Scene,ShaderMaterial,ShapeUtils,Vector2,Vector3} from 'three';
import type {Camera} from 'three';
import {centralAngle} from '../analysis/sphere';
import {polygonPlane,vertexGeographic} from '../app/userMapping';
import type {GameVertex,UserMappingData} from '../app/userMapping';
import {projections} from '../projections';
import type {GeoPoint,ProjectionContext,ProjectionId} from '../projections/Projection';


interface Batch {geo:number[];color:number[];size:number[];ids:string[];vertices:number[];}
export interface MappingFrame {points:Batch;lines:Batch;fills:Batch;}
const batch=():Batch=>({geo:[],color:[],size:[],ids:[],vertices:[]});
const vector=([lon,lat]:GeoPoint)=>new Vector3(Math.cos(lat*Math.PI/180)*Math.cos(lon*Math.PI/180),Math.cos(lat*Math.PI/180)*Math.sin(lon*Math.PI/180),Math.sin(lat*Math.PI/180));
const geographic=(v:Vector3):GeoPoint=>[Math.atan2(v.y,v.x)*180/Math.PI,Math.asin(Math.max(-1,Math.min(1,v.z)))*180/Math.PI,8000];
/** Bounded great-circle tessellation; authored coordinates are never changed. */
export function sampledEdge(a:GeoPoint,b:GeoPoint){const angle=centralAngle(a,b),steps=Math.max(1,Math.min(24,Math.ceil(angle/(Math.PI/36)))),u=vector(a),v=vector(b),result:GeoPoint[]=[];for(let i=0;i<=steps;i++){const f=i/steps,w=angle<1e-10?u.clone():u.clone().multiplyScalar(Math.sin((1-f)*angle)).addScaledVector(v,Math.sin(f*angle)).normalize();result.push(geographic(w));}return result;}
/** Clip tessellated display triangles at ±180; no longitude-spanning fill. */
export function splitDisplayTriangle(points:GeoPoint[]):GeoPoint[][] {
 const unwrapped=points.map(p=>[p[0]+360*Math.round((points[0][0]-p[0])/360),p[1],p[2]] as GeoPoint),lo=Math.floor((Math.min(...unwrapped.map(p=>p[0]))+180)/360),hi=Math.floor((Math.max(...unwrapped.map(p=>p[0]))+180)/360),result:GeoPoint[][]=[];
 for(let shift=lo;shift<=hi;shift++){let ring=unwrapped;for(const [boundary,side]of [[-180+shift*360,1],[180+shift*360,-1]]){const next:GeoPoint[]=[];for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],insideA=(a[0]-boundary)*side>=0,insideB=(b[0]-boundary)*side>=0;if(insideA)next.push(a);if(insideA!==insideB){const f=(boundary-a[0])/(b[0]-a[0]);next.push([boundary,a[1]+f*(b[1]-a[1]),8000]);}}ring=next;}for(let i=1;i<ring.length-1;i++)result.push([ring[0],ring[i],ring[i+1]].map(p=>[p[0]-shift*360,p[1],p[2]] as GeoPoint));}
 return result;
}
export function compileMapping(data:UserMappingData,selected:string|null=null,draft:GameVertex[]=[],closed=false):MappingFrame {
 const frame={points:batch(),lines:batch(),fills:batch()},layers=[...data.userLayers].sort((a,b)=>a.order-b.order),total=data.userFeatures.reduce((n,f)=>n+f.geometry.vertices.length,0),level=total>4000?0:total>1000?1:2;
 const put=(b:Batch,p:GeoPoint,id:string,color:Color,alpha:number,size=10,vertex=-1)=>{b.geo.push(p[0],p[1],8000);b.color.push(color.r,color.g,color.b,alpha);b.size.push(size);b.ids.push(id);b.vertices.push(vertex);};
 const edges=(points:GeoPoint[],id:string,color:Color,alpha:number,ring:boolean)=>{for(let i=1;i<points.length+(ring?1:0);i++){const line=sampledEdge(points[i-1],points[i%points.length]);for(let j=1;j<line.length;j++){const a=line[j-1],b=line[j],lon=b[0]+360*Math.round((a[0]-b[0])/360);if(lon>180||lon< -180){const seam=lon>180?180:-180,k=(seam-a[0])/(lon-a[0]),lat=a[1]+k*(b[1]-a[1]);for(const p of [a,[seam,lat,8000],[-seam,lat,8000],b] as GeoPoint[])put(frame.lines,p,id,color,alpha);}else{put(frame.lines,a,id,color,alpha);put(frame.lines,b,id,color,alpha);}}}};
 for(const layer of layers){if(!layer.visible||layer.opacity===0)continue;for(const f of data.userFeatures.filter(f=>f.layerId===layer.id)){const points=f.geometry.vertices.map(vertexGeographic),color=new Color(f.id===selected?'#ffffff':f.style.color),alpha=layer.opacity;
  if(f.geometryType==='Point')put(frame.points,points[0],f.id,color,alpha,f.style.pointSize);
  else edges(points,f.id,color,alpha,f.geometryType==='Polygon');
  if(f.id===selected&&f.geometryType!=='Point')points.forEach((p,i)=>put(frame.points,p,f.id,new Color('#ffffff'),alpha,12,i));
  if(f.geometryType==='Polygon'&&f.style.fillOpacity>0){const triangles=ShapeUtils.triangulateShape(polygonPlane(f.geometry.vertices).map(([x,y])=>new Vector2(x,y)),[]),vectors=points.map(vector);
   const triangle=(a:Vector3,b:Vector3,c:Vector3,depth:number)=>{if(depth){const ab=a.clone().add(b).normalize(),bc=b.clone().add(c).normalize(),ca=c.clone().add(a).normalize();triangle(a,ab,ca,depth-1);triangle(ab,b,bc,depth-1);triangle(ca,bc,c,depth-1);triangle(ab,bc,ca,depth-1);}else for(const tri of splitDisplayTriangle([a,b,c].map(geographic)))for(const p of tri)put(frame.fills,p,f.id,color,alpha*f.style.fillOpacity);};
   for(const [a,b,c]of triangles)triangle(vectors[a],vectors[b],vectors[c],level);
  }
 }}
 if(draft.length){const points=draft.map(vertexGeographic),color=new Color('#ff82d1');points.forEach((p,i)=>put(frame.points,p,'',color,1,12,i));edges(points,'',color,1,closed&&points.length>2);}
 return frame;
}
const vertexShader=`attribute vec4 userColor; attribute float userSize; attribute float userMask; varying vec4 tint; varying float mask; uniform float globe; uniform float pixelRatio;
void main(){tint=userColor;mask=userMask;if(globe>.5&&dot(position,cameraPosition)<dot(position,position))mask=0.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=userSize*pixelRatio;}`;
const fragmentShader=`varying vec4 tint;varying float mask;uniform float point;void main(){if(mask<.5||tint.a<=0.)discard;if(point>.5&&length(gl_PointCoord-vec2(.5))>.5)discard;gl_FragColor=tint;
#include <colorspace_fragment>
}`;
export function projectMapping(batch:Batch,id:ProjectionId,c:ProjectionContext,arity:number){const p=projections[id],bounds=p.bounds(c),position=new Float32Array(batch.geo.length),mask=new Float32Array(batch.geo.length/3);for(let i=0;i<mask.length;i++){const at=i*3,geo=batch.geo.slice(at,at+3);const pos=p.project(geo[0],geo[1],geo[2],c);position.set(id==='globe'?pos:[pos[0],pos[1],.003],at);mask[i]=p.visibility(geo[0],geo[1],c)>0&&pos.every(Number.isFinite)?1:0;}
 if(id!=='globe'&&arity>1)for(let i=0;i<mask.length;i+=arity){let good=true;for(let a=0;a<arity;a++)for(let b=a+1;b<arity;b++){const ai=(i+a)*3,bi=(i+b)*3;if(Math.abs(position[ai]-position[bi])>(bounds.maxX-bounds.minX)*.5||Math.abs(position[ai+1]-position[bi+1])>(bounds.maxY-bounds.minY)*.5)good=false;}if(!good)mask.fill(0,i,i+arity);}
 return {position,mask};
}
/** Exactly three shared render objects per viewport, rebuilt only on dirty data. */
export class UserMappingOverlay {
 readonly points:Points;readonly lines:LineSegments;readonly fills:Mesh;readonly objects:(Points|LineSegments|Mesh)[];frame:MappingFrame=compileMapping({userLayers:[],userFeatures:[]});rebuilds=0;projections=0;private key='';
 constructor(scene:Scene,pixelRatio=1){const material=(point:number)=>new ShaderMaterial({vertexShader,fragmentShader,uniforms:{point:{value:point},globe:{value:0},pixelRatio:{value:pixelRatio}},transparent:true,depthTest:false,depthWrite:false,side:DoubleSide});this.points=new Points(new BufferGeometry(),material(1));this.lines=new LineSegments(new BufferGeometry(),material(0));this.fills=new Mesh(new BufferGeometry(),material(0));this.objects=[this.points,this.lines,this.fills];this.objects.forEach((o,i)=>{o.frustumCulled=false;o.renderOrder=15+(2-i);scene.add(o);});this.set(this.frame);}
 set(frame:MappingFrame){if(this.frame===frame&&this.rebuilds)return;this.frame=frame;this.key='';this.rebuilds++;[frame.points,frame.lines,frame.fills].forEach((b,i)=>{const o=this.objects[i];o.geometry.dispose();o.geometry=new BufferGeometry();o.geometry.setAttribute('position',new BufferAttribute(new Float32Array(b.geo.length),3));o.geometry.setAttribute('userMask',new BufferAttribute(new Float32Array(b.ids.length),1));o.geometry.setAttribute('userColor',new BufferAttribute(new Float32Array(b.color),4));o.geometry.setAttribute('userSize',new BufferAttribute(new Float32Array(b.size),1));});}
 update(id:ProjectionId,c:ProjectionContext,visible=true){this.objects.forEach(o=>o.visible=visible);if(!visible)return;const key=`${id}:${c.radius}:${c.mercatorLimit}:${c.centerLon}:${c.centerLat}`;if(key===this.key)return;this.key=key;this.projections++;[this.frame.points,this.frame.lines,this.frame.fills].forEach((b,i)=>{const o=this.objects[i],v=projectMapping(b,id,c,i===0?1:i===1?2:3);(o.geometry.getAttribute('position').array as Float32Array).set(v.position);(o.geometry.getAttribute('userMask').array as Float32Array).set(v.mask);o.geometry.getAttribute('position').needsUpdate=o.geometry.getAttribute('userMask').needsUpdate=true;o.geometry.boundingSphere=null;o.geometry.boundingBox=null;(o.material as ShaderMaterial).uniforms.globe.value=Number(id==='globe');});}
 hit(x:number,y:number,width:number,height:number,camera:Camera,radius=14):{id:string;vertex:number}|null {
  if(!this.points.visible)return null;const screen=(o:Points|LineSegments,i:number)=>{const pos=o.geometry.getAttribute('position'),mask=o.geometry.getAttribute('userMask');if(mask.getX(i)<.5)return null;const v=new Vector3().fromBufferAttribute(pos,i);if((o.material as ShaderMaterial).uniforms.globe.value&&v.dot(camera.position)<v.lengthSq())return null;v.project(camera);if(v.z< -1||v.z>1)return null;return [(v.x+1)*width/2,(1-v.y)*height/2];};
  let result:{id:string;vertex:number}|null=null,best=radius;for(let i=0;i<this.frame.points.ids.length;i++){const p=screen(this.points,i);if(p){const distance=Math.hypot(p[0]-x,p[1]-y);if(distance<best){best=distance;result={id:this.frame.points.ids[i],vertex:this.frame.points.vertices[i]};}}}if(result)return result;
  for(let i=0;i<this.frame.lines.ids.length;i+=2){const a=screen(this.lines,i),b=screen(this.lines,i+1);if(!a||!b)continue;const dx=b[0]-a[0],dy=b[1]-a[1],f=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(x-a[0]-f*dx,y-a[1]-f*dy);if(d<best){best=d;result={id:this.frame.lines.ids[i],vertex:-1};}}
  if(result)return result;const ray=new Raycaster();ray.setFromCamera(new Vector2(x/width*2-1,1-y/height*2),camera);for(const hit of ray.intersectObject(this.fills)){const face=hit.faceIndex??-1;if(face<0||this.fills.geometry.getAttribute('userMask').getX(face*3)<.5)continue;if((this.fills.material as ShaderMaterial).uniforms.globe.value&&hit.point.dot(camera.position)<hit.point.lengthSq())continue;return {id:this.frame.fills.ids[face*3],vertex:-1};}return null;
 }
 dispose(){for(const o of this.objects){o.removeFromParent();o.geometry.dispose();(o.material as ShaderMaterial).dispose();}}
}
