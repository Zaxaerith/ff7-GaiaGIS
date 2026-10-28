// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect,vi} from 'vitest';
import {BufferAttribute,BufferGeometry} from 'three';
import {RegionalConnectivityOverlay} from '../src/viewer/regionalConnectivityOverlay';
import {prepareDisplay,projectDisplay} from '../src/data/display';
import {projections} from '../src/projections';
import {projectionIds} from '../src/projections/registry';
import {routeSegments} from '../src/viewer/route';
import type {GaiaMesh} from '../src/data/mesh';
import type {ProjectionContext} from '../src/projections/Projection';
const context:ProjectionContext={radius:6371008.8,mercatorLimit:85.0511287798066,centerLon:0,centerLat:0};
function fixture(){
 const mesh={sourceTriangleCount:2,triangleCount:3,geographic:new Float32Array([179,0,0,-179,0,0,179,2,0,20,10,0,22,10,0,20,12,0,-180,80,0,-179,80,0,0,90,0]),indices:Uint32Array.from({length:9},(_,i)=>i)} as GaiaMesh;
 const display=prepareDisplay(mesh),frame=projectDisplay(display,projections.globe,context),surface=new BufferGeometry();
 surface.setAttribute('position',new BufferAttribute(frame.positions,3));surface.setAttribute('gaiaMask',new BufferAttribute(frame.mask,1));surface.setAttribute('color',new BufferAttribute(new Float32Array(frame.positions.length).fill(.4),3));surface.setAttribute('gaiaTint',new BufferAttribute(new Float32Array(frame.positions.length).fill(.7),3));
 return {surface,display,frame,overlay:new RegionalConnectivityOverlay(display.renderToSource,2,surface)};
}
describe('independent regional component drawing',()=>{
 it('includes Face ID0 and all its display fragments, never synthetic caps',()=>{
  const {overlay,display,surface}=fixture();overlay.setComponent(new Uint8Array([1,0]));
  const expected=Array.from(display.renderToSource).flatMap((source,i)=>source===0?[i*3,i*3+1,i*3+2]:[]);
  expect(expected.length).toBeGreaterThan(3);expect(Array.from(overlay.component.geometry.index!.array)).toEqual(expected);expect(overlay.component.visible).toBe(true);
  expect(overlay.component.geometry.getAttribute('position')).toBe(surface.getAttribute('position'));expect(overlay.component.geometry.getAttribute('gaiaMask')).toBe(surface.getAttribute('gaiaMask'));overlay.dispose();surface.dispose();
 });
 it('does not alter base thematic/tint buffers or selection ownership and clears independently',()=>{
  const {overlay,surface}=fixture(),colours=surface.getAttribute('color'),tint=surface.getAttribute('gaiaTint'),before=Array.from(colours.array),beforeTint=Array.from(tint.array);
  overlay.setComponent(new Uint8Array([0,1]));overlay.setBoundaries(routeSegments([[20,10,1500],[21,10,1500]]));overlay.clear();
  expect(overlay.component.visible).toBe(false);expect(overlay.component.geometry.index!.count).toBe(0);expect(overlay.boundary.line.visible).toBe(false);expect(overlay.mask).toBeNull();
  expect(surface.getAttribute('color')).toBe(colours);expect(Array.from(colours.array)).toEqual(before);expect(Array.from(tint.array)).toEqual(beforeTint);overlay.dispose();surface.dispose();
 });
 it('releases only its own geometry, detaching borrowed attributes before disposal',()=>{
  const {overlay,surface}=fixture();overlay.setComponent(new Uint8Array([1,0]));const old=overlay.component.geometry,position=surface.getAttribute('position'),released=vi.fn(()=>{expect(old.getAttribute('position')).toBeUndefined();expect(old.getAttribute('gaiaMask')).toBeUndefined();});old.addEventListener('dispose',released);
  overlay.setComponent(new Uint8Array([0,1]));expect(released).toHaveBeenCalledOnce();expect(surface.getAttribute('position')).toBe(position);overlay.dispose();overlay.dispose();overlay.update('globe',context);expect(overlay.component.geometry.getAttribute('position')).toBeUndefined();expect(overlay.component.geometry.index).toBeNull();expect(overlay.boundary.geo.length).toBe(0);expect(surface.getAttribute('position')).toBe(position);surface.dispose();
 });
 it('rejects a mask from another source generation/count',()=>{const {overlay,surface}=fixture();expect(()=>overlay.setComponent(new Uint8Array(3))).toThrow('source count');overlay.dispose();surface.dispose();});
 it('can attach to comparison attributes created after the overlay',()=>{const surface=new BufferGeometry(),overlay=new RegionalConnectivityOverlay(new Uint32Array([0]),1,surface);overlay.setComponent(new Uint8Array([1]));const position=new BufferAttribute(new Float32Array(9),3),mask=new BufferAttribute(new Float32Array(3).fill(1),1);surface.setAttribute('position',position);surface.setAttribute('gaiaMask',mask);overlay.syncSurface();expect(overlay.component.geometry.getAttribute('position')).toBe(position);overlay.dispose();surface.dispose();});
});
describe('regional boundary display in existing projections',()=>{
 it.each(projectionIds)('%s shares existing projected positions and produces finite boundary buffers',id=>{
  const {overlay,display,surface,frame}=fixture();overlay.setComponent(new Uint8Array([1,0]));const geo=routeSegments([[179.5,10,1500],[-179.5,10,1500]]);overlay.setBoundaries(geo);
  projectDisplay(display,projections[id],context,frame.positions,frame.mask);overlay.update(id,context,undefined,{x:0,y:0,z:3});
  expect(overlay.component.geometry.getAttribute('position')).toBe(surface.getAttribute('position'));expect(overlay.boundary.line.geometry.getAttribute('position').array.every(Number.isFinite)).toBe(true);
  expect(Array.from(overlay.boundary.geo)).toEqual(Array.from(geo));for(let i=0;i<geo.length;i+=6)expect(Math.abs(geo[i+3]-geo[i])).toBeLessThanOrEqual(1);overlay.dispose();surface.dispose();
 });
 it('updates boundary morphs and preserves final projection endpoint',()=>{
  const {overlay,surface}=fixture();overlay.setBoundaries(routeSegments([[20,10,1500],[21,10,1500]]));overlay.update('globe',context);overlay.begin('globe','equirectangular',context);
  for(const ease of [0,.5,1]){overlay.update('equirectangular',context,ease,{x:0,y:0,z:3});expect(overlay.boundary.line.geometry.getAttribute('position').array.every(Number.isFinite)).toBe(true);}
  const expected=projections.equirectangular.project(20,10,1500,context),position=overlay.boundary.line.geometry.getAttribute('position').array;expect(position[0]).toBeCloseTo(expected[0],6);expect(position[1]).toBeCloseTo(expected[1],6);overlay.dispose();surface.dispose();
 });
 it('masks globe far-side lines and restores them when camera moves around',()=>{
  const {overlay,surface}=fixture();overlay.setBoundaries(routeSegments([[0,0,1500],[1,0,1500]]));overlay.update('globe',context,undefined,{x:0,y:0,z:-3});expect(Array.from(overlay.boundary.line.geometry.getAttribute('gaiaMask').array).every(x=>x<0)).toBe(true);
  overlay.update('globe',context,undefined,{x:0,y:0,z:3});expect(Array.from(overlay.boundary.line.geometry.getAttribute('gaiaMask').array).every(x=>x>0)).toBe(true);overlay.dispose();surface.dispose();
 });
 it('keeps static planar buffers untouched until projection/centre or relief changes',()=>{
  const {overlay,surface}=fixture();overlay.setBoundaries(routeSegments([[20,10,1700],[21,10,1700]]));overlay.update('equirectangular',context);const position=overlay.boundary.line.geometry.getAttribute('position') as BufferAttribute,version=position.version;
  overlay.update('equirectangular',context,undefined,{x:100,y:200,z:8});expect(position.version).toBe(version);
  overlay.update('orthographic',{...context,centerLon:20});expect(position.version).toBeGreaterThan(version);
  overlay.setRelief(10);overlay.update('globe',context,undefined,{x:0,y:0,z:3});const xyz=overlay.boundary.line.geometry.getAttribute('position').array;
  expect(Math.hypot(xyz[0],xyz[1],xyz[2])).toBeCloseTo(1+(200*10+1500)/context.radius,6);overlay.dispose();surface.dispose();
 });
});
