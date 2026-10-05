// SPDX-License-Identifier: GPL-3.0-only
import {Box3,BufferAttribute,BufferGeometry,DataTexture,DoubleSide,Group,Mesh,MeshBasicMaterial,NearestFilter,RGBAFormat,SRGBColorSpace,UnsignedByteType,Vector3} from 'three';
import type {ExplorerModel,ExplorerPack} from '../data/explorer';
export class OriginalModel {
 readonly object=new Group();readonly root=new Group();readonly orientation=new Group();readonly bones:Group[]=[];readonly meshes:Mesh[]=[];readonly textures:DataTexture[]=[];readonly geometryBytes:number;readonly textureBytes:number;readonly size:number;
 constructor(readonly pack:ExplorerPack,readonly model:ExplorerModel){
  // Keep source-local rotations and -Z bones intact. Convert the complete
  // source Y-down model frame to Explorer Y-up with a 180-degree X rotation.
  this.orientation.rotation.set(Math.PI,Math.PI,0);this.object.add(this.orientation);this.orientation.add(this.root);const textures=new Map<string,DataTexture>();let bytes=0,textureBytes=0;
  for(let i=0;i<model.bones.length;i++){const b=model.bones[i],node=new Group();node.name=b.name;this.bones.push(node);if(b.parent<0)this.root.add(node);else{node.position.z=-model.bones[b.parent].length;this.bones[b.parent].add(node);}}
  for(const part of model.parts){const values=pack.floats(part),geometry=new BufferGeometry(),p=new Float32Array(part.vertices*3),n=p.slice(),c=new Float32Array(part.vertices*4),uv=new Float32Array(part.vertices*2);
   for(let i=0;i<part.vertices;i++){p.set(values.subarray(i*12,i*12+3),i*3);n.set(values.subarray(i*12+3,i*12+6),i*3);c.set(values.subarray(i*12+6,i*12+10),i*4);uv.set(values.subarray(i*12+10,i*12+12),i*2);}
   geometry.setAttribute('position',new BufferAttribute(p,3));geometry.setAttribute('normal',new BufferAttribute(n,3));geometry.setAttribute('color',new BufferAttribute(c,4));geometry.setAttribute('uv',new BufferAttribute(uv,2));
   let texture:DataTexture|undefined;if(part.texture){texture=textures.get(part.texture);if(!texture){const r=pack.header.textures.find(t=>t.name===part.texture)!;texture=new DataTexture(new Uint8Array(pack.payload,r.offset,r.bytes),r.width,r.height,RGBAFormat,UnsignedByteType);texture.colorSpace=SRGBColorSpace;texture.magFilter=texture.minFilter=NearestFilter;texture.flipY=false;texture.needsUpdate=true;textures.set(r.name,texture);this.textures.push(texture);textureBytes+=r.bytes;}}
   const material=new MeshBasicMaterial({vertexColors:true,map:texture??null,side:DoubleSide,alphaTest:.005});const mesh=new Mesh(geometry,material);this.meshes.push(mesh);this.bones[part.bone].add(mesh);bytes+=p.byteLength+n.byteLength+c.byteLength+uv.byteLength;
  }
  this.pose(0,0);this.object.updateMatrixWorld(true);const box=new Box3().setFromObject(this.object);this.size=Math.max(...box.getSize(new Vector3()).toArray())*model.source_scale;
  this.geometryBytes=bytes;this.textureBytes=textureBytes;
 }
 pose(clipIndex:number,seconds:number){const clip=this.model.clips[Math.min(clipIndex,this.model.clips.length-1)],values=this.pack.floats(clip),stride=6+clip.bone_count*3,frame=Math.floor(seconds*30)%clip.frame_count,start=frame*stride;
  // Raw A Euler composition follows the header order. Coordinate conversion
  // belongs to the parent frame, not independent sign flips on every joint.
  const order=clip.rotation_order.map(i=>'XYZ'[i]).join('') as 'XYZ',rotation=(node:Group,offset:number)=>node.rotation.set(values[offset]*Math.PI/180,values[offset+1]*Math.PI/180,values[offset+2]*Math.PI/180,order);
  rotation(this.root,start);this.root.position.set(values[start+3],-values[start+4],values[start+5]);
  if(clip.bone_count)for(let i=0;i<this.bones.length;i++)rotation(this.bones[i],start+6+i*3);
 }
 tint(index:number){
  // C_0075E4D6 additive source color facts; shared aja.hrc, not five skeletons.
  const offsets=[[50,50,-30],[-30,50,-30],[-30,50,50],[-80,-80,-80],[69,17,-147]][index];if(!offsets)throw Error('Unsupported Chocobo tint');
  for(let g=0;g<this.meshes.length;g++){const color=this.meshes[g].geometry.getAttribute('color') as BufferAttribute,values=this.pack.floats(this.model.parts[g]);for(let i=0;i<color.count;i++)for(let j=0;j<3;j++)color.array[i*4+j]=Math.max(0,Math.min(1,values[i*12+6+j]+offsets[j]/255));color.needsUpdate=true;}
 }
 dispose(){this.object.removeFromParent();for(const mesh of this.meshes){mesh.geometry.dispose();(mesh.material as MeshBasicMaterial).dispose();}for(const texture of this.textures)texture.dispose();this.root.clear();this.object.clear();}
}
