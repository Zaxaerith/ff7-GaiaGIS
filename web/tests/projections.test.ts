// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {geoMollweideRaw} from 'd3-geo-projection';
import reference from './fixtures/proj-reference.json';
import {projections} from '../src/projections';
import type {ProjectionContext,ProjectionId} from '../src/projections/Projection';
import {fitProjectionToViewport} from '../src/projections/Projection';
import {mollweideTheta} from '../src/projections/mollweide';
import {easeInOutCubic,interpolateBuffers} from '../src/viewer/morph';
const c:ProjectionContext={radius:6371008.8,mercatorLimit:85.0511287798066,centerLon:0,centerLat:0};
describe('spherical projection formulas',()=>{
  it('normalizes Globe radius while preserving assumed height',()=>{expect(projections.globe.project(0,0,0,c)).toEqual([0,0,1]);const p=projections.globe.project(55,-35,100,c);expect(Math.hypot(...p)).toBeCloseTo(1+100/c.radius,12);});
  it('equirectangular covers a 2:1 full sphere',()=>{const b=projections.equirectangular.bounds(c);expect((b.maxX-b.minX)/(b.maxY-b.minY)).toBe(2);expect(projections.equirectangular.project(180,90,10,c)).toEqual([Math.PI,Math.PI/2,0]);});
  it('Mercator clamps poles to finite bounds and hides excess latitude',()=>{for(const lat of [-90,90]){const p=projections.mercator.project(180,lat,0,c);expect(p.every(Number.isFinite)).toBe(true);expect(Math.abs(p[1])).toBeCloseTo(Math.PI,12);expect(projections.mercator.visibility(0,lat,c)).toBe(-1);}expect(projections.mercator.visibility(0,80,c)).toBe(1);});
  it('Mollweide known points and equation residual',()=>{expect(projections.mollweide.project(0,0,0,c)).toEqual([0,0,0]);expect(projections.mollweide.project(0,90,0,c)[1]).toBeCloseTo(Math.SQRT2,12);for(const lat of [-80,-45,10,60,85]){const phi=lat*Math.PI/180,theta=mollweideTheta(phi);expect(2*theta+Math.sin(2*theta)).toBeCloseTo(Math.PI*Math.sin(phi),12);}});
  it('stays finite arbitrarily near both poles',()=>{for(const lat of [89.999999999,-89.999999999,89.9999,-89.9999])expect(projections.mollweide.project(180,lat,0,c).every(Number.isFinite)).toBe(true);});
  it('agrees with independently installed d3 away from its iterative pole tolerance',()=>{for(const [lon,lat]of [[-170,-80],[-45,50],[0,0],[130,75],[180,85]]){const a=projections.mollweide.project(lon,lat,0,c),b=geoMollweideRaw(lon*Math.PI/180,lat*Math.PI/180);expect(a[0]).toBeCloseTo(b[0],8);expect(a[1]).toBeCloseTo(b[1],8);}const exact=projections.mollweide.project(180,90,0,c),iterative=geoMollweideRaw(Math.PI,Math.PI/2);expect(Math.abs(exact[0])).toBeLessThan(1e-14);expect(Math.abs(iterative[0])).toBeLessThan(2e-5);});
  it('Orthographic visibility and moving view center are geographic math',()=>{expect(projections.orthographic.visibility(0,0,c)).toBe(1);expect(projections.orthographic.visibility(180,0,c)).toBe(-1);expect(projections.orthographic.visibility(90,0,c)).toBe(0);const rotated={...c,centerLon:90,centerLat:30};expect(projections.orthographic.project(90,30,0,rotated).slice(0,2)).toEqual([0,0]);expect(projections.orthographic.visibility(90,30,rotated)).toBeCloseTo(1,12);});
  it('matches Stage 1 PROJ coordinates with radius-only normalization',()=>{for(const point of reference.points){for(const [name,expected]of Object.entries(point.projections)){const actual=projections[name as ProjectionId].project(point.lon,point.lat,0,c);expect(actual[0]).toBeCloseTo(expected[0]/reference.radius_m,7);expect(actual[1]).toBeCloseTo(expected[1]/reference.radius_m,7);}}});
  it('viewport fit preserves aspect with padding, without projection-specific scales',()=>{const b=projections.equirectangular.bounds(c);for(const aspect of [.5,1,2,3]){const fit=fitProjectionToViewport(b,aspect);expect(fit.halfWidth/fit.halfHeight).toBeCloseTo(aspect,12);expect(fit.halfWidth).toBeGreaterThan(Math.PI);expect(fit.halfHeight).toBeGreaterThan(Math.PI/2);}expect(()=>fitProjectionToViewport(b,0)).toThrow();});
});
describe('morph interpolation',()=>{
  it('has exact endpoints and a symmetric ease curve',()=>{expect(easeInOutCubic(0)).toBe(0);expect(easeInOutCubic(1)).toBe(1);expect(easeInOutCubic(.5)).toBe(.5);const from=new Float32Array([1,-2,3]),to=new Float32Array([-2,4,0]),out=new Float32Array(3);interpolateBuffers(from,to,out,0);expect(out).toEqual(from);interpolateBuffers(from,to,out,1);expect(out).toEqual(to);for(let step=0;step<=20;step++){interpolateBuffers(from,to,out,easeInOutCubic(step/20));expect(out.every(Number.isFinite)).toBe(true);}});
  it('rejects incompatible buffers',()=>{expect(()=>interpolateBuffers(new Float32Array(3),new Float32Array(2),new Float32Array(3),.5)).toThrow();});
});
