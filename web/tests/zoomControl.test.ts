// SPDX-License-Identifier: GPL-3.0-only
import {describe,expect,it} from 'vitest';
import {OrthographicCamera,PerspectiveCamera,Vector3} from 'three';
import {GaiaViewer} from '../src/viewer/GaiaViewer';

// Exercise the real zoom method without creating a WebGL renderer.
function fixture(target=new Vector3()){
 const camera=new PerspectiveCamera(),mapCamera=new OrthographicCamera(),controls={target,minDistance:1.08,maxDistance:14,enabled:true};
 camera.position.copy(target).add(new Vector3(2,1,4));camera.lookAt(target);
 const owner=Object.assign(Object.create(GaiaViewer.prototype),{perspective:camera,mapCamera,globeControls:controls,mapControls:{enabled:false},projectionId:'globe',captureExplorer:false,morph:null,suspendedAt:null,flight:null,queuedLocation:null}) as GaiaViewer;
 return {owner,camera,mapCamera,controls};
}
describe('overview zoom camera ownership and limits',()=>{
 it.each([new Vector3(),new Vector3(.2,-.3,.4)])('keeps the current target, direction and up during repeated globe zoom: %s',target=>{
  const {owner,camera,controls}=fixture(target),direction=camera.position.clone().sub(target).normalize(),up=camera.up.clone(),rotation=camera.quaternion.clone();
  let previous=camera.position.distanceTo(target);
  for(const factor of Array(30).fill(.83).concat(Array(40).fill(1.2))){owner.zoom(factor);const distance=camera.position.distanceTo(target);expect(distance).toBeGreaterThanOrEqual(1.08-1e-12);expect(distance).toBeLessThanOrEqual(14+1e-12);expect(factor<1?distance<=previous+1e-12:distance>=previous-1e-12).toBe(true);expect(camera.position.clone().sub(target).normalize().distanceTo(direction)).toBeLessThan(1e-12);expect(camera.up.equals(up)).toBe(true);expect(camera.quaternion.equals(rotation)).toBe(true);previous=distance;}
  expect(previous).toBeCloseTo(controls.maxDistance,12);for(let i=0;i<50;i++)owner.zoom(.83);expect(camera.position.distanceTo(target)).toBeCloseTo(controls.minDistance,12);
 });
 it.each(['explorer','suspended','morph'])('does not touch another camera owner during %s',mode=>{
  const {owner,camera}=fixture(),position=camera.position.clone();Object.assign(owner,mode==='explorer'?{captureExplorer:true}:mode==='suspended'?{suspendedAt:10}:{morph:{}});owner.zoom(.83);owner.zoom(1.2);expect(camera.position.equals(position)).toBe(true);
 });
 it.each([0,-1,NaN,Infinity])('ignores invalid zoom factor %s',factor=>{const {owner,camera}=fixture(),position=camera.position.clone();owner.zoom(factor);expect(camera.position.equals(position)).toBe(true);});
 it('preserves projected map zoom semantics and bounds',()=>{const {owner,mapCamera}=fixture();owner.projectionId='mercator';owner.zoom(.5);expect(mapCamera.zoom).toBe(2);for(let i=0;i<30;i++)owner.zoom(.83);expect(mapCamera.zoom).toBe(20);for(let i=0;i<50;i++)owner.zoom(1.2);expect(mapCamera.zoom).toBe(.5);});
});
