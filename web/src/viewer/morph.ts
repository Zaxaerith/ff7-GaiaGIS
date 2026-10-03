// SPDX-License-Identifier: GPL-3.0-only
export const easeInOutCubic=(t:number)=>t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
export function interpolateBuffers(from:Float32Array,to:Float32Array,out:Float32Array,t:number) {
  if(from.length!==to.length||out.length!==from.length) throw new Error('Morph buffer length mismatch');
  for(let i=0;i<out.length;i++) out[i]=from[i]+(to[i]-from[i])*t;
}
