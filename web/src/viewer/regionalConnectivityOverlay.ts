// SPDX-License-Identifier: GPL-3.0-only
import {BufferAttribute,BufferGeometry,DoubleSide,Mesh,MeshBasicMaterial} from 'three';
import {addVisibilityMask} from './visibility';
import {CartographicLine} from './cartographicLines';
import type {ProjectionId,ProjectionContext} from '../projections/Projection';

/** One translucent source selection over the existing projected surface.
 * Position/visibility attributes are borrowed, never changed or disposed here.
 * This overlay has no access to base colours, routing or service-area state. */
export class RegionalConnectivityOverlay {
 readonly component:Mesh<BufferGeometry,MeshBasicMaterial>;
 readonly boundary=new CartographicLine('#f3b1d8');
 mask:Uint8Array|null=null;
 private disposed=false;
 private boundaryFrame='';
 constructor(private renderToSource:Uint32Array,private sourceCount:number,private surface:BufferGeometry){
  const material=new MeshBasicMaterial({color:'#8fe1ff',side:DoubleSide,transparent:true,opacity:.28,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  addVisibilityMask(material);
  this.component=new Mesh(new BufferGeometry(),material);this.component.frustumCulled=false;this.component.renderOrder=1;this.component.visible=false;
  this.syncSurface();
 }
 syncSurface(){
  if(this.disposed)return;
  for(const name of ['position','gaiaMask']){const attribute=this.surface.getAttribute(name);if(attribute&&this.component.geometry.getAttribute(name)!==attribute)this.component.geometry.setAttribute(name,attribute);}
 }
 setComponent(mask:Uint8Array|null){
  if(this.disposed)return;
  if(mask&&mask.length!==this.sourceCount)throw Error('Regional component source count mismatch');
  this.mask=mask;let count=0;
  if(mask)for(const source of this.renderToSource)if(source<this.sourceCount&&mask[source])count++;
  const index=new Uint32Array(count*3);let at=0;
  if(mask)for(let face=0;face<this.renderToSource.length;face++){const source=this.renderToSource[face];if(source<this.sourceCount&&mask[source]){index[at++]=face*3;index[at++]=face*3+1;index[at++]=face*3+2;}}
  // Dispose only this index allocation. Shared GPU attributes belong to surface.
  const old=this.component.geometry;old.deleteAttribute('position');old.deleteAttribute('gaiaMask');old.dispose();
  this.component.geometry=new BufferGeometry();this.syncSurface();this.component.geometry.setIndex(new BufferAttribute(index,1));this.component.visible=count>0;
 }
 setBoundaries(geo:Float32Array|null){if(!this.disposed){this.boundary.set(geo??new Float32Array());this.boundaryFrame='';}}
 setRelief(value:number){if(this.boundary.relief!==value){this.boundary.relief=value;this.setBoundaries(this.boundary.geo);}}
 begin(from:ProjectionId,to:ProjectionId,context:ProjectionContext){this.boundary.begin(from,to,context);this.boundaryFrame='';}
 update(id:ProjectionId,context:ProjectionContext,ease?:number,camera?:{x:number;y:number;z:number}){
  if(this.disposed)return;this.syncSurface();if(!this.boundary.line.visible)return;
  // Unlike animated routes, a selected regional boundary is normally static.
  // Globe visibility changes with camera direction; planar camera pan does not
  // change projected coordinates and therefore needs no repeated buffer upload.
  const view=id==='globe'&&camera?`${camera.x}/${camera.y}/${camera.z}`:'';
  const signature=`${id}/${context.centerLon}/${context.centerLat}/${this.boundary.relief}/${view}`;
  if(ease!==undefined||signature!==this.boundaryFrame){this.boundary.update(id,context,ease,camera);this.boundaryFrame=ease===undefined?signature:'';}
 }
 clear(){this.setComponent(null);this.setBoundaries(null);}
 dispose(){
  if(this.disposed)return;this.disposed=true;this.mask=null;
  this.component.removeFromParent();this.boundary.line.removeFromParent();
  this.component.geometry.deleteAttribute('position');this.component.geometry.deleteAttribute('gaiaMask');this.component.geometry.dispose();this.component.geometry.setIndex(null);this.component.visible=false;this.component.material.dispose();this.boundary.set(new Float32Array());this.boundary.dispose();
 }
}
