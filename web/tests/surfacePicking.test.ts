// SPDX-License-Identifier: GPL-3.0-only
import {it,expect} from 'vitest';
import {orderSurfaceHits} from '../src/viewer/surfacePicking';
it('matches the later drawn coplanar bridge rather than underlying water',()=>{
  expect(orderSurfaceHits([{distance:8,faceIndex:12},{distance:8,faceIndex:40}]).map(h=>h.faceIndex)).toEqual([40,12]);
});
it('nearer globe surface wins even when a farther face is drawn later',()=>{
  expect(orderSurfaceHits([{distance:1,faceIndex:1},{distance:1.00001,faceIndex:90}])[0].faceIndex).toBe(1);
});
it('only uses numerical roundoff as a depth tie and does not mutate input',()=>{
  const hits=[{distance:8+Number.EPSILON*8,faceIndex:20},{distance:8,faceIndex:10}];
  expect(orderSurfaceHits(hits)[0].faceIndex).toBe(20);expect(hits[0].faceIndex).toBe(20);
});
it('orders each distance group independently and preserves invisible candidates for mask filtering',()=>{
  expect(orderSurfaceHits([{distance:9,faceIndex:50},{distance:8,faceIndex:10},{distance:8,faceIndex:11},{distance:9,faceIndex:null}]).map(h=>h.faceIndex)).toEqual([11,10,50,null]);
});
it('empty intersection stays empty',()=>expect(orderSurfaceHits([])).toEqual([]));
