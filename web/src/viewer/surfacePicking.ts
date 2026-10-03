// SPDX-License-Identifier: GPL-3.0-only
export interface SurfaceHit {distance:number;faceIndex?:number|null;}
/** Nearest faces first; exactly coplanar faces follow the mesh's draw order.
 * Flat projections can overlay source bridge/water surfaces at equal depth.
 * With the default LessEqual depth test, the later primitive is visible.
 * Tolerance is only floating-point ray noise, not a gameplay height threshold.
 */
export function orderSurfaceHits<T extends SurfaceHit>(hits:readonly T[]):T[]{
  const nearest=[...hits].sort((a,b)=>a.distance-b.distance),ordered:T[]=[];
  for(let start=0;start<nearest.length;){
    let end=start+1;const tolerance=Number.EPSILON*64*Math.max(1,Math.abs(nearest[start].distance));
    while(end<nearest.length&&nearest[end].distance-nearest[start].distance<=tolerance)end++;
    ordered.push(...nearest.slice(start,end).sort((a,b)=>(b.faceIndex??-1)-(a.faceIndex??-1)));start=end;
  }
  return ordered;
}
