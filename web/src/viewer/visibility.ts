// SPDX-License-Identifier: GPL-3.0-only
import type {Material} from 'three';
// Visibility/fade and optional gentle Globe depth are handled here. All projection
// positions and morph interpolation are computed on the CPU, not in shaders.
export function addVisibilityMask(material:Material,sphereDepth?:{value:number}) {
  material.onBeforeCompile=(shader)=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float gaiaMask; varying float vGaiaMask;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvGaiaMask=gaiaMask;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vGaiaMask;')
      .replace('#include <color_fragment>','#include <color_fragment>\nif(vGaiaMask<0.0) discard; diffuseColor.a*=smoothstep(0.0,0.035,vGaiaMask);');
    if(sphereDepth){
      shader.uniforms.gaiaSphereDepth=sphereDepth;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGaiaRadial;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvGaiaRadial=mat3(modelViewMatrix)*position;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float gaiaSphereDepth; varying vec3 vGaiaRadial;')
        .replace('#include <color_fragment>','#include <color_fragment>\nvec3 radial=vGaiaRadial/max(length(vGaiaRadial),0.000001); float globeLight=0.68+0.32*max(0.0,dot(radial,normalize(vec3(-0.35,0.5,1.0)))); diffuseColor.rgb*=mix(1.0,globeLight,gaiaSphereDepth);');
    }
  };
  material.customProgramCacheKey=()=> sphereDepth?'gaia-visibility-depth-v1':'gaia-visibility-v1';
}
