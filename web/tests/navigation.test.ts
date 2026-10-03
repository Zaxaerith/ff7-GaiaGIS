// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {geographicViewCenter,latitudeLabel,longitudeLabel} from '../src/viewer/navigation';
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
    expect(latitudeLabel(0)).toBe('赤道 0°');expect(latitudeLabel(30)).toBe('30°N');expect(latitudeLabel(-30)).toBe('30°S');
    expect(longitudeLabel(60)).toBe('60°E');expect(longitudeLabel(-60)).toBe('60°W');expect(longitudeLabel(0)).toBe('0° 经线');
    expect(longitudeLabel(-0.03,1)).toBe('0° 经线');expect(latitudeLabel(-0.03,1)).toBe('赤道 0°');
  });
});
