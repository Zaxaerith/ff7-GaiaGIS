// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect,vi} from 'vitest';
import {Box3,Color,MeshBasicMaterial,Vector3} from 'three';
import {srgbToLinear,modelLighting,configureOutput} from '../src/explorer/lighting';
import {ContactShadow,shadowParameters,contactPlaneNormal} from '../src/explorer/shadow';
import {readPreferences} from '../src/app/presentation';
import {decodePresentation,UISounds} from '../src/data/presentation';
import {catalog,locales,dictionaries} from '../src/i18n';
const wav=btoa('RIFF'+String.fromCharCode(36,0,0,0)+'WAVEfmt '+String.fromCharCode(16,0,0,0)+String.fromCharCode(1,0,1,0,64,31,0,0,128,62,0,0,2,0,16,0)+'data'+String.fromCharCode(0,0,0,0));
const pack=()=>({schema:'gaiagis-presentation',version:1,sources:{'audio.dat':'1'.repeat(64)},audio:[{id:'confirm',wav,source_record:1,loop:false}]});
describe('presentation preferences and optional original audio',()=>{
 it('defaults to FF7 style with low volume and no autoplay',()=>expect(readPreferences(null)).toEqual({theme:'ff7',lighting:'original',volume:.25,sounds:false}));
 it('validates saved preferences',()=>expect(readPreferences({theme:'broken',lighting:'broken',volume:NaN,sounds:'yes'})).toEqual(readPreferences(null)));
 it('retains scientific and flat settings',()=>expect(readPreferences({theme:'scientific',lighting:'flat',volume:2,sounds:true})).toEqual({theme:'scientific',lighting:'flat',volume:1,sounds:true}));
 it('decodes synthetic WAV cue registry',()=>expect(decodePresentation(pack()).audio[0].id).toBe('confirm'));
 it.each(['version','source','duplicate','loop','id','wav'])('rejects corrupt %s',kind=>{const p=pack();if(kind==='version')p.version=2;if(kind==='source')p.sources['audio.dat']='bad';if(kind==='duplicate')p.audio.push(p.audio[0]);if(kind==='loop')p.audio[0].loop=true;if(kind==='id')p.audio[0].id='music';if(kind==='wav')p.audio[0].wav=btoa('invalid');expect(()=>decodePresentation(p)).toThrow();});
 it('missing audio is silent and gesture gating is explicit',()=>{const sounds=new UISounds();sounds.enabled=true;sounds.play('confirm');expect(sounds.available).toBe(false);expect(sounds.unlocked).toBe(false);sounds.unlock();expect(sounds.unlocked).toBe(true);sounds.volume=0;sounds.play('confirm');sounds.dispose();expect(sounds.available).toBe(false);});
 it('gates real playback on gesture, mute and volume and retains good data after failed decode',async()=>{
  const start=vi.fn(),gain={gain:{value:0},connect:vi.fn(),disconnect:vi.fn()},close=vi.fn(),decode=vi.fn().mockResolvedValue({}),resume=vi.fn();
  class Context{state='suspended';destination={};decodeAudioData=decode;close=close;resume=resume;createGain=()=>gain;createBufferSource=()=>({buffer:null,connect:vi.fn(),disconnect:vi.fn(),start,onended:null});}
  vi.stubGlobal('AudioContext',Context);vi.spyOn(performance,'now').mockReturnValue(1000);
  try{const s=new UISounds();await s.load(decodePresentation(pack()));s.enabled=true;s.play('confirm');expect(start).not.toHaveBeenCalled();s.unlock();s.enabled=false;s.play('confirm');expect(start).not.toHaveBeenCalled();s.enabled=true;s.volume=0;s.play('confirm');expect(start).not.toHaveBeenCalled();s.volume=.2;s.play('confirm');expect(start).toHaveBeenCalledOnce();expect(gain.gain.value).toBe(.2);expect(resume).toHaveBeenCalled();decode.mockRejectedValueOnce(Error('bad WAV'));await expect(s.load(decodePresentation(pack()))).rejects.toThrow();expect(s.available).toBe(true);s.dispose();expect(s.available).toBe(false);expect(close).toHaveBeenCalledOnce();}finally{vi.unstubAllGlobals();vi.restoreAllMocks();}
 });
 it('does not adopt a pending sound decode after data reset',async()=>{let resolve!:(v:unknown)=>void;const close=vi.fn();class Context{decodeAudioData=()=>new Promise(r=>{resolve=r;});close=close;}vi.stubGlobal('AudioContext',Context);try{const s=new UISounds(),pending=s.load(decodePresentation(pack()));s.dispose();resolve({});await expect(pending).rejects.toThrow('Superseded');expect(s.available).toBe(false);expect(close).toHaveBeenCalledOnce();}finally{vi.unstubAllGlobals();}});
 it.each(locales)('all presentation strings exist in %s',locale=>{const keys=catalog.filter(r=>r[0].startsWith('present.')||r[0].startsWith('party.')).map(r=>r[0]);expect(keys.length).toBeGreaterThan(25);for(const key of keys)expect(dictionaries[locale][key]).toBeTruthy();});
});
describe('separate color and model illumination policies',()=>{
 it.each([0,.01,.04045,.1,.5,1])('matches independent Three Color oracle at %s',v=>expect(srgbToLinear(v)).toBeCloseTo(new Color(v,v,v).convertSRGBToLinear().r,7));
 it('fixes mid gray without clipping white or alpha',()=>{expect(srgbToLinear(128/255)).toBeCloseTo(.21586,4);expect(srgbToLinear(1)).toBe(1);});
 it('sets output configuration explicitly',()=>{const renderer={} as Parameters<typeof configureOutput>[0];configureOutput(renderer);expect(renderer.outputColorSpace).toBe('srgb');expect(renderer.toneMappingExposure).toBe(1);expect(renderer.toneMapping).toBe(0);});
 it('changes only selected model uniforms',()=>{const a=modelLighting(new MeshBasicMaterial()),b=modelLighting(new MeshBasicMaterial());a.set('flat');expect(a.uniforms.modelAmbient.value).toBe(1);expect(a.uniforms.modelDirectional.value).toBe(0);expect(b.uniforms.modelAmbient.value).toBe(.6);a.set('debug');expect(a.uniforms.modelAmbient.value).toBe(1.25);a.set('original');a.direction(new Vector3(1,2,3));expect(a.uniforms.modelLight.value.length()).toBeCloseTo(1);});
});
describe('procedural grounding approximation',()=>{
 it('fits a sloped source plane and points toward the surface up',()=>{const p=[new Vector3(0,0,0),new Vector3(1,1,0),new Vector3(0,0,1)],n=contactPlaneNormal(p,new Vector3(0,1,0));expect(n.y).toBeGreaterThan(0);expect(n.dot(p[1])).toBeCloseTo(0);expect(n.dot(p[2])).toBeCloseTo(0);});
 it('uses up for degenerate or invalid source triangles',()=>{const up=new Vector3(0,1,0);expect(contactPlaneNormal([up,up,up],up).toArray()).toEqual(up.toArray());expect(contactPlaneNormal([new Vector3(NaN,0,0),up,up],up).toArray()).toEqual(up.toArray());});
 it.each(['cloud','buggy','tiny-bronco','chocobo','submarine'])('ground shadow for %s',id=>{const p=shadowParameters(id,0);expect(p.opacity).toBeGreaterThan(0);expect(p.radius).toBeGreaterThan(0);});
 it('Highwind altitude fades and widens independently',()=>{const a=shadowParameters('highwind',0),b=shadowParameters('highwind',10000);expect(b.opacity).toBeLessThan(a.opacity);expect(b.radius).toBeGreaterThan(a.radius);});
 it('vehicle contact footprints are wider than party footprints',()=>{for(const id of ['buggy','tiny-bronco','submarine'])expect(shadowParameters(id,0).radius).toBeGreaterThan(shadowParameters('cloud',0).radius);});
 it('reuses one draw object and disposes it',()=>{const s=new ContactShadow();s.update('cloud',0,.1);expect(s.object.scale.x).toBe(12);s.update('highwind',20000,1);expect(s.object.visible).toBe(false);const dispose=vi.spyOn(s.geometry,'dispose');s.dispose();expect(dispose).toHaveBeenCalledOnce();});
});
