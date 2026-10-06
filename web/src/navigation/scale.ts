// SPDX-License-Identifier: GPL-3.0-only
import {Camera,Plane,Raycaster,Sphere,Vector2,Vector3} from 'three';
import {inverseDisplay} from '../analysis/distortion';
import {measureDistance} from '../analysis/sphere';
import {geographicViewCenter} from '../viewer/navigation';
import type {GeoPoint,ProjectionId,ProjectionContext} from '../projections/Projection';
export function screenGeographic(camera:Camera,id:ProjectionId,context:ProjectionContext,x:number,y:number,width:number,height:number,seed:GeoPoint=[0,0,0]):GeoPoint|null {
 if(!(width>0&&height>0)||![x,y].every(Number.isFinite))return null;camera.updateMatrixWorld();const ray=new Raycaster();ray.setFromCamera(new Vector2(2*x/width-1,1-2*y/height),camera);
 if(id==='globe'){const hit=ray.ray.intersectSphere(new Sphere(new Vector3(),1),new Vector3());if(!hit)return null;const geo=geographicViewCenter(hit.x,hit.y,hit.z);return geo.lon===null?null:[geo.lon,geo.lat,0];}
 const hit=ray.ray.intersectPlane(new Plane(new Vector3(0,0,1),0),new Vector3());return hit?inverseDisplay(id,hit.x,hit.y,context,seed):null;
}
export function localScreenScale(camera:Camera,id:ProjectionId,context:ProjectionContext,width:number,height:number,seed:GeoPoint=[0,0,0],pixels=96){
 if(width<pixels+20||height<100)return null;const a=screenGeographic(camera,id,context,width/2-pixels/2,height/2,width,height,seed),b=screenGeographic(camera,id,context,width/2+pixels/2,height/2,width,height,seed);if(!a||!b)return null;const distance=measureDistance([a,b]).total;if(!Number.isFinite(distance)||distance<.001||distance>10_000_000)return null;const magnitude=10**Math.floor(Math.log10(distance)),fraction=distance/magnitude,meters=(fraction>=5?5:fraction>=2?2:1)*magnitude;return {meters,pixels:meters/distance*pixels,metersPerPixel:distance/pixels,a,b};
}
