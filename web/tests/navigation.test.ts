// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {geographicViewCenter,latitudeLabel,longitudeLabel} from '../src/viewer/navigation';
import {BoundedFieldHistory} from '../src/app/navigation';
describe('Session-only Field evidence history',()=>{
  it('bounds snapshots to 32 and returns the immediately preceding selection',()=>{
    const history=new BoundedFieldHistory<{field:string;triangle:number}>();
    for(let triangle=0;triangle<40;triangle++)history.push({field:`field${triangle}`,triangle});
    expect(history.entries).toHaveLength(32);expect(history.entries[0].triangle).toBe(8);expect(history.current?.triangle).toBe(39);
    expect(history.back()).toEqual({field:'field38',triangle:38});expect(history.entries).toHaveLength(31);
    expect(Object.isFrozen(history.entries)).toBe(true);
  });
  it('replaces only the current selection and resets or clears the whole session',()=>{
    const history=new BoundedFieldHistory<string>(2);history.replace('initial');history.push('target');history.replace('arrival');
    expect(history.entries).toEqual(['initial','arrival']);expect(history.back()).toBe('initial');expect(history.back()).toBeUndefined();expect(history.back()).toBeUndefined();
    history.reset('direct-search');history.push('gateway');history.clear();expect(history.entries).toEqual([]);expect(history.current).toBeUndefined();
    history.reset('next-source');history.reset();expect(history.entries).toEqual([]);
  });
  it('rejects unbounded or invalid capacity',()=>{
    for(const max of [0,-1,33,1.5,Infinity,NaN])expect(()=>new BoundedFieldHistory(max)).toThrow(RangeError);
  });
});
describe('Gaia direction cues',()=>{
  it('uses Globe axes to identify all longitude quadrants and hemispheres',()=>{
    expect(geographicViewCenter(0,0,3)).toEqual({lon:0,lat:0});
    expect(geographicViewCenter(3,0,0).lon).toBe(90);expect(geographicViewCenter(-3,0,0).lon).toBe(-90);
    expect(geographicViewCenter(0,0,-3).lon).toBe(-180);
    expect(geographicViewCenter(0,3,3).lat).toBeCloseTo(45);expect(geographicViewCenter(0,-3,3).lat).toBeCloseTo(-45);
  });
  it('leaves longitude undefined at poles and rejects zero-length directions',()=>{
    expect(geographicViewCenter(0,5,0)).toEqual({lon:null,lat:90});expect(geographicViewCenter(0,-5,0)).toEqual({lon:null,lat:-90});expect(()=>geographicViewCenter(0,0,0)).toThrow();
  });
  it('labels reconstructed north/south/east/west and the equator unambiguously',()=>{
    expect(latitudeLabel(0)).toBe('Equator 0°');expect(latitudeLabel(30)).toBe('30°N');expect(latitudeLabel(-30)).toBe('30°S');
    expect(longitudeLabel(60)).toBe('60°E');expect(longitudeLabel(-60)).toBe('60°W');expect(longitudeLabel(0)).toBe('0° meridian');
    expect(longitudeLabel(-0.03,1)).toBe('0° meridian');expect(latitudeLabel(-0.03,1)).toBe('Equator 0°');
  });
});
