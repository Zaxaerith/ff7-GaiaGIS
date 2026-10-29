// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {RoutingDisplay} from '../src/analysis/routingDisplay';
describe('one foreground routing overlay',()=>{
 it('last explicit operation prevents a late Journey or professional result from painting',()=>{const d=new RoutingDisplay(),j=d.claim('journey');expect(d.current(j,'journey')).toBe(true);const r=d.claim('routing');expect(d.current(j,'journey')).toBe(false);expect(d.current(r,'routing')).toBe(true);const next=d.claim('journey');expect(d.current(r,'routing')).toBe(false);expect(d.current(next,'journey')).toBe(true);});
 it('clearing an inactive caller preserves the active route',()=>{const d=new RoutingDisplay(),j=d.claim('journey');expect(d.release('routing')).toBe(false);expect(d.current(j,'journey')).toBe(true);expect(d.release('journey')).toBe(true);expect(d.current(j,'journey')).toBe(false);});
 it('source replacement invalidates both callers without transferring ownership',()=>{const d=new RoutingDisplay(),j=d.claim('journey');d.invalidate();expect(d.owner).toBeNull();expect(d.current(j,'journey')).toBe(false);});
});
