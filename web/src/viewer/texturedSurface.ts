// SPDX-License-Identifier: GPL-3.0-only
import {BufferAttribute,BufferGeometry,LinearFilter,NearestFilter,SRGBColorSpace,Texture} from 'three';
import type {MeshBasicMaterial} from 'three';
import type {DecodedTextures} from '../data/textures';
export class TexturedSurface {
 readonly uniforms={gaiaAtlas:{value:null as Texture|null},gaiaTextureEnabled:{value:0},gaiaShading:{value:0}};
 texture:Texture|null=null;
 constructor(material:MeshBasicMaterial,geometry:BufferGeometry){const n=geometry.getAttribute('position')?.count??0;geometry.setAttribute('gaiaUV',new BufferAttribute(new Float32Array(n*2),2));geometry.setAttribute('gaiaRect',new BufferAttribute(new Float32Array(n*4),4));geometry.setAttribute('gaiaTint',new BufferAttribute(new Float32Array(n),1));const before=material.onBeforeCompile;material.onBeforeCompile=(shader,renderer)=>{before(shader,renderer);Object.assign(shader.uniforms,this.uniforms);
 shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 gaiaUV; attribute vec4 gaiaRect; attribute float gaiaTint; varying vec2 vGaiaUV; varying vec4 vGaiaRect; varying float vGaiaTint; varying vec3 vGaiaWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGaiaUV=gaiaUV; vGaiaRect=gaiaRect; vGaiaTint=gaiaTint; vGaiaWorld=(modelMatrix*vec4(position,1.0)).xyz;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D gaiaAtlas; uniform float gaiaTextureEnabled; uniform float gaiaShading; varying vec2 vGaiaUV; varying vec4 vGaiaRect; varying float vGaiaTint; varying vec3 vGaiaWorld;').replace('#include <color_fragment>',`#include <color_fragment>
 if(gaiaTextureEnabled>0.5 && vGaiaRect.z>0.0){vec4 artwork=texture2D(gaiaAtlas,vGaiaRect.xy+fract(vGaiaUV)*vGaiaRect.zw);diffuseColor.rgb=mix(artwork.rgb,diffuseColor.rgb,vGaiaTint);diffuseColor.a*=artwork.a;if(diffuseColor.a<0.005)discard;}
 if(gaiaShading>0.0){vec3 normal=normalize(cross(dFdx(vGaiaWorld),dFdy(vGaiaWorld)));float light=0.65+0.35*abs(dot(normal,normalize(vec3(-0.35,0.5,1.0))));diffuseColor.rgb*=mix(1.0,light,gaiaShading);}`);
 };material.customProgramCacheKey=()=> 'gaia-textured-surface-v1';}
 load(pack:DecodedTextures,geometry:BufferGeometry,attributes:{uv:Float32Array;rect:Float32Array}){this.texture?.dispose();const texture=new Texture(pack.image);texture.flipY=false;texture.colorSpace=SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=texture.magFilter=NearestFilter;texture.needsUpdate=true;this.texture=texture;this.uniforms.gaiaAtlas.value=texture;geometry.setAttribute('gaiaUV',new BufferAttribute(attributes.uv,2));geometry.setAttribute('gaiaRect',new BufferAttribute(attributes.rect,4));}
 filtering(linear:boolean){if(this.texture){this.texture.minFilter=this.texture.magFilter=linear?LinearFilter:NearestFilter;this.texture.needsUpdate=true;}}
 dispose(){this.texture?.dispose();}
}
