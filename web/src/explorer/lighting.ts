// SPDX-License-Identifier: GPL-3.0-only
import {NoToneMapping,SRGBColorSpace,Vector3} from 'three';
import type {MeshBasicMaterial,WebGLRenderer} from 'three';
import type {LightingPreset} from '../app/presentation';
export function srgbToLinear(v:number){return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);}
export function configureOutput(renderer:WebGLRenderer){renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=NoToneMapping;renderer.toneMappingExposure=1;}
export function modelLighting(material:MeshBasicMaterial){const uniforms={modelAmbient:{value:.6},modelDirectional:{value:.4},modelLight:{value:new Vector3(-.35,.8,.5).normalize()}};
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 modelWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nmodelWorld=(modelMatrix*vec4(position,1.0)).xyz;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 modelWorld; uniform vec3 modelLight; uniform float modelAmbient; uniform float modelDirectional;').replace('#include <color_fragment>','#include <color_fragment>\nvec3 face=cross(dFdx(modelWorld),dFdy(modelWorld));float diffuse=length(face)>0.00000000001?abs(dot(normalize(face),modelLight)):0.0;diffuseColor.rgb*=modelAmbient+modelDirectional*diffuse;');};material.customProgramCacheKey=()=> 'gaiagis-original-model-diffuse-1';
 return {set(preset:LightingPreset){uniforms.modelAmbient.value=preset==='flat'?1:preset==='debug'?1.25:.6;uniforms.modelDirectional.value=preset==='original'?.4:0;},direction(v:Vector3){uniforms.modelLight.value.copy(v).normalize();},uniforms};
}
