// SPDX-License-Identifier: GPL-3.0-only
/** Independent draw/picking namespace. Borrows the WM0 Atlas texture. */
import {BufferAttribute,BufferGeometry,Color,Mesh,Raycaster,Sphere,Triangle,Vector3} from 'three';
import type {Texture} from 'three';
import type {GaiaMesh} from '../data/mesh';
import {prepareDisplay,projectDisplay} from '../data/display';
import {sourceGeographic} from '../explorer/coordinates';
import {projections} from '../projections';
import type {ProjectionContext,ProjectionId} from '../projections/Projection';
import {visibleVariantFaces,VARIANT_GROUPS} from '../data/worldVariants';
import type {VariantFace,WorldVariants} from '../data/worldVariants';
import {createSurfaceMaterial} from './surfaceMaterial';
import {applyRelief} from './relief';
import {TexturedSurface} from './texturedSurface';
import {cornerWeights,textureAlpha} from '../data/textures';
import type {DecodedTextures} from '../data/textures';
import {CartographicLine} from './cartographicLines';
export class WorldVariantSurface {
 readonly faces:VariantFace[];readonly display;readonly surface;readonly boundary=new CartographicLine('#ffce70');
 private textured:TexturedSurface;private positions:Float32Array;private mask:Float32Array;private key='';private from?:{positions:Float32Array;mask:Float32Array};
 private atlas:DecodedTextures|null=null;private atlasObject:Texture|null=null;private selected:string|null=null;private boundaryRaw=new Float32Array();private boundaryRelief=1;
 milliseconds=0;projectionMilliseconds=0;renderSubmissionMs=0;
 constructor(readonly data:WorldVariants,readonly state:number){
  const start=performance.now();this.faces=visibleVariantFaces(data,state);
  const geographic=Float32Array.from(this.faces.flatMap(f=>f.points.flatMap(([x,z,h])=>sourceGeographic(x,z,h)))),indices=Uint32Array.from({length:this.faces.length*3},(_,i)=>i);
  // This adapter exists only for display tessellation, never canonical transport.
  const adapter={geographic,indices,triangleCount:this.faces.length,sourceTriangleCount:this.faces.length,capTriangleCount:0,vertexCount:indices.length} as GaiaMesh;
  this.display=prepareDisplay(adapter);this.positions=new Float32Array(this.display.geographic.length);this.mask=new Float32Array(this.display.geographic.length/3);
  const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(this.positions,3));geometry.setAttribute('gaiaMask',new BufferAttribute(this.mask,1));geometry.setAttribute('color',new BufferAttribute(new Float32Array(this.positions.length),3));
  geometry.boundingSphere=new Sphere(new Vector3(),6);
  const material=createSurfaceMaterial();this.textured=new TexturedSurface(material,geometry);material.customProgramCacheKey=()=> 'gaia-world-variant-surface-v1';this.surface=new Mesh(geometry,material);this.surface.frustumCulled=false;this.surface.userData.namespace='wm0-source-variant';
  this.colors();const boundary:number[]=[];
  for(const f of this.faces){const [,bb]=VARIANT_GROUPS[f.group-1],placements=new Set<number>(bb),x=f.placement%9*32768,z=Math.floor(f.placement/9)*32768;
   const sides=[[0,x,f.placement%9?f.placement-1:-1],[0,x+32768,f.placement%9<8?f.placement+1:-1],[1,z,f.placement-9],[1,z+32768,f.placement+9]];
   for(let i=0;i<3;i++){const a=f.points[i],b=f.points[(i+1)%3];if(sides.some(([axis,limit,next])=>a[axis]===limit&&b[axis]===limit&&!placements.has(next)))boundary.push(...sourceGeographic(...a),...sourceGeographic(...b));}
  }
  this.boundaryRaw=new Float32Array(boundary);this.boundary.set(this.boundaryRaw);this.milliseconds=performance.now()-start;
 }
 private colors(){
  const colors=this.surface.geometry.getAttribute('color'),tint=this.surface.geometry.getAttribute('gaiaTint'),palette={selected:new Color('#ffeb62'),ambiguous:new Color('#c69bed'),changed:new Color('#de8262'),alternative:new Color('#81c8a3'),base:new Color('#789cb2')};
  for(let i=0;i<this.display.renderToSource.length;i++){const f=this.faces[this.display.renderToSource[i]],bucket=this.data.groups[f.group-1].buckets.get(f.geometry)!,selected=f.id===this.selected,c=selected?palette.selected:bucket.ambiguous?palette.ambiguous:bucket.changed?palette.changed:f.section>=63?palette.alternative:palette.base;
   for(let j=0;j<3;j++){colors.setXYZ(i*3+j,c.r,c.g,c.b);tint.setX(i*3+j,selected?.8:bucket.changed||bucket.ambiguous?.55:0);}
  }
  colors.needsUpdate=tint.needsUpdate=true;
 }
 select(id:string|null){this.selected=id;this.colors();}
 private frame(id:ProjectionId,c:ProjectionContext,relief:number){const f=projectDisplay(this.display,projections[id],c);if(id==='globe')applyRelief(this.display,f.positions,c.radius,relief);return f;}
 begin(_from:ProjectionId,_to:ProjectionId,_c:ProjectionContext,_relief:number){this.boundary.begin(_from,_to,_c);this.from={positions:this.positions.slice(),mask:this.mask.slice()};this.key='';}
 update(id:ProjectionId,c:ProjectionContext,relief:number,atlas:DecodedTextures|null,texture:Texture|null,original:boolean,shading:boolean,ease?:number,camera?:Vector3){
  const started=performance.now(),key=`${id}/${c.centerLon}/${c.centerLat}/${relief}`;
  if(key!==this.key||ease!==undefined){const f=this.frame(id,c,relief);for(let i=0;i<f.positions.length;i++)this.positions[i]=ease!==undefined&&this.from?this.from.positions[i]+(f.positions[i]-this.from.positions[i])*ease:f.positions[i];for(let i=0;i<f.mask.length;i++)this.mask[i]=ease!==undefined&&this.from?this.from.mask[i]+(f.mask[i]-this.from.mask[i])*ease:f.mask[i];this.surface.geometry.getAttribute('position').needsUpdate=this.surface.geometry.getAttribute('gaiaMask').needsUpdate=true;this.key=key;}
  if(ease===undefined)this.from=undefined;
  if(atlas!==this.atlas||texture!==this.atlasObject){this.atlas=atlas;this.atlasObject=texture;this.textureAttributes();}
  this.textured.uniforms.gaiaAtlas.value=texture;this.textured.uniforms.gaiaTextureEnabled.value=Number(original&&!!texture);this.textured.uniforms.gaiaShading.value=Number(shading&&id==='globe');const factor=id==='globe'?relief:1;if(factor!==this.boundaryRelief){const visible=this.boundary.line.visible,geo=this.boundaryRaw.slice();for(let i=2;i<geo.length;i+=3)geo[i]*=factor;this.boundary.set(geo);this.boundary.line.visible=visible;this.boundaryRelief=factor;}this.boundary.update(id,c,ease,camera);this.projectionMilliseconds=performance.now()-started;
 }
 private textureAttributes(){const pack=this.atlas;if(!pack)return;const uv=new Float32Array(this.mask.length*2),rect=new Float32Array(this.mask.length*4);
  for(let i=0;i<this.display.renderToSource.length;i++){const f=this.faces[this.display.renderToSource[i]],r=pack.resources.get(f.raw[10]&511);if(!r)continue;const points=f.points.map(p=>sourceGeographic(...p));
   for(let j=0;j<3;j++){const v=i*3+j,direct=points.findIndex(p=>p.every((n,k)=>Math.fround(n)===this.display.geographic[v*3+k])),w=direct>=0?[0,1,2].map(k=>Number(k===direct)):cornerWeights(this.display.geographic[v*3],this.display.geographic[v*3+1],points,this.display.geographic[v*3+2]);let u=0,t=0;for(let k=0;k<3;k++){u+=w[k]*(f.uv[k][0]-r.u_offset)/r.width;t+=w[k]*(f.uv[k][1]-r.v_offset)/r.height;}uv.set([u,t],v*2);rect.set([r.x/pack.metadata.atlas.width,r.y/pack.metadata.atlas.height,r.width/pack.metadata.atlas.width,r.height/pack.metadata.atlas.height],v*4);}
  }
  this.surface.geometry.setAttribute('gaiaUV',new BufferAttribute(uv,2));this.surface.geometry.setAttribute('gaiaRect',new BufferAttribute(rect,4));
 }
 pick(ray:Raycaster,original:boolean,maxDistance=Infinity){const bary=new Vector3(),a=new Vector3(),b=new Vector3(),c=new Vector3();for(const hit of ray.intersectObject(this.surface,false)){if(hit.distance>maxDistance)break;if(hit.faceIndex==null)continue;const i=hit.faceIndex,v=i*3;a.fromArray(this.positions,v*3);b.fromArray(this.positions,v*3+3);c.fromArray(this.positions,v*3+6);Triangle.getBarycoord(hit.point,a,b,c,bary);if(this.mask[v]*bary.x+this.mask[v+1]*bary.y+this.mask[v+2]*bary.z<.01)continue;const face=this.faces[this.display.renderToSource[i]];if(original&&this.atlas){const uv=this.surface.geometry.getAttribute('gaiaUV'),u=uv.getX(v)*bary.x+uv.getX(v+1)*bary.y+uv.getX(v+2)*bary.z,t=uv.getY(v)*bary.x+uv.getY(v+1)*bary.y+uv.getY(v+2)*bary.z;if(textureAlpha(this.atlas,face.raw[10]&511,u,t,this.atlasObject?.magFilter===1006)<.005)continue;}this.select(face.id);return face;}this.select(null);return null;}
 dispose(){this.surface.removeFromParent();this.boundary.line.removeFromParent();this.surface.geometry.dispose();this.surface.material.dispose();this.textured.dispose();this.boundary.dispose();this.atlas=this.atlasObject=null;this.from=undefined;}
 get heldBytes(){let bytes=0;for(const attr of Object.values(this.surface.geometry.attributes))bytes+=attr.array.byteLength;return bytes+this.display.geographic.byteLength+this.display.unitSphere.byteLength+this.display.renderToSource.byteLength+this.boundary.geo.byteLength;}
}
