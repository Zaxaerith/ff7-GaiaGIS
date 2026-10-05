// SPDX-License-Identifier: GPL-3.0-only
import {PlaneGeometry,ShaderMaterial,Mesh,DoubleSide,Vector3} from 'three';
export function contactPlaneNormal(points:Vector3[],up:Vector3){
 const normal=new Vector3().crossVectors(points[1].clone().sub(points[0]),points[2].clone().sub(points[0]));
 if(!Number.isFinite(normal.lengthSq())||normal.lengthSq()<1e-20)return up.clone();
 normal.normalize();return normal.dot(up)<0?normal.negate():normal;
}
export function shadowParameters(identity:string,altitude:number){const a=Math.max(0,altitude),air=identity==='highwind',radius:Record<string,number>={highwind:700,buggy:270,'tiny-bronco':360,chocobo:150,submarine:300};return {opacity:air?.24*Math.exp(-a/3500):.28*Math.exp(-a/1200),radius:(radius[identity]??120)*(1+(air?a/9000:0))};}
/** Procedural soft contact shadow: approximation, no original bitmap or shadow maps. */
export class ContactShadow{
 readonly geometry=new PlaneGeometry(2,2);readonly material=new ShaderMaterial({transparent:true,depthWrite:false,side:DoubleSide,uniforms:{opacity:{value:.28}},vertexShader:'varying vec2 shadowUV;void main(){shadowUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 shadowUV;uniform float opacity;void main(){float r=length((shadowUV-.5)*2.0);float a=opacity*(1.0-smoothstep(.1,1.0,r));if(a<.002)discard;gl_FragColor=vec4(0.0,0.0,0.0,a);}' });
 readonly object=new Mesh(this.geometry,this.material);
 constructor(){this.object.renderOrder=2;this.object.frustumCulled=false;}
 update(identity:string,altitude:number,scale:number){const p=shadowParameters(identity,altitude);this.material.uniforms.opacity.value=p.opacity;this.object.scale.setScalar(p.radius*scale);this.object.visible=p.opacity>.002;}
 dispose(){this.object.removeFromParent();this.geometry.dispose();this.material.dispose();}
}
