import {encodeShare,decodeShare} from '../src/app/shareState';
import {UserStateStorage} from '../src/app/userState';
import {parseLocalView} from '../src/app/userState';
import {defaultVisibility,defaultOpacities} from '../src/app/layers';
// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {initialState,features} from '../src/app/state';
import {layerAvailable} from '../src/app/layers';
import {navigationActions} from '../src/app/navigationActions';
import {RouteOverlay} from '../src/viewer/route';
import type {GaiaMesh} from '../src/data/mesh';
import type {NavigationEntry} from '../src/app/navigation';
const entry:NavigationEntry={id:'atlas:midgar',kind:'atlas',name:'Midgar',aliases:[],mapId:'WM0',canTour:true,anchor:[0,0,0],navigate:()=>{}};
const target={kind:'atlas' as const,id:'midgar',mapId:'WM0' as const};
describe('navigation capability and presentation integration',()=>{
 it('public information supports bookmarks/share/tours without spatial Nearby',()=>{const actions=navigationActions(initialState(),target,{...entry,anchor:undefined});expect(actions).toEqual({bookmark:true,nearby:false,addTour:true,share:true,playRoute:false});});
 it('Explorer suppresses every overview context action',()=>{const state=initialState();state.explorer.phase='active';expect(Object.values(navigationActions(state,target,entry,true)).every(v=>v===false)).toBe(true);});
 it('native maps cannot acquire Nearby, tours or WM0 route playback',()=>{const state=initialState();state.map.id='WM2';const actions=navigationActions(state,{kind:'transition',id:'native-transition',mapId:'WM2'},entry,true);expect(actions.bookmark).toBe(true);expect(actions.nearby).toBe(false);expect(actions.addTour).toBe(false);expect(actions.share).toBe(false);expect(actions.playRoute).toBe(false);});
 it('opacity requires the current authoritative assets and is attached to features',()=>{const state=initialState();expect(layerAvailable('traversal',state)).toBe(false);state.data.assets.geometry={status:'loaded',bytes:1};expect(layerAvailable('traversal',state)).toBe(true);expect(layerAvailable('atlas',state)).toBe(false);state.data.assets.locations={status:'loaded',bytes:1};expect(layerAvailable('atlas',state)).toBe(true);state.map.id='WM3';expect(layerAvailable('atlas',state)).toBe(false);expect(features.find(f=>f.id==='routing')?.opacityLayers).toEqual(['reachability','routes']);});
 it('route progress shares projected buffers and changes draw range without reallocating',()=>{const mesh={indices:new Uint32Array([0,1,2,3,4,5]),geographic:new Float32Array([0,0,0,1,0,0,0,1,0,2,0,0,3,0,0,2,1,0])} as unknown as GaiaMesh;const route=new RouteOverlay();route.set(mesh,[0,1]);const geometry=route.progress.geometry,position=route.line.geometry.getAttribute('position');expect(geometry.getAttribute('position')).toBe(position);route.update('equirectangular',{radius:1,mercatorLimit:80,centerLon:0,centerLat:0});for(let i=0;i<1000;i++)route.setProgress(i/1000);expect(route.progress.geometry).toBe(geometry);expect(geometry.getAttribute('position')).toBe(position);expect(geometry.drawRange.count%2).toBe(0);expect(route.line.geometry.drawRange.count).toBe(Infinity);route.setProgress(0);expect(route.progress.visible).toBe(false);route.line.geometry.dispose();geometry.dispose();route.line.material.dispose();route.progress.material.dispose();});
});

describe('corrupt view recovery boundaries',()=>{
 const saved=()=>({mapId:'WM0',projection:'mercator',native:'3d',camera:{position:[0,0,8],target:[0,0,0],up:[0,1,0],zoom:1,center:[0,0]},layers:defaultVisibility(),opacity:defaultOpacities(),selected:null});
 it('rejects degenerate camera vectors and invalid projection centers',()=>{expect(()=>parseLocalView(saved())).not.toThrow();for(const edit of [(v:ReturnType<typeof saved>)=>v.camera.up=[0,0,0],(v:ReturnType<typeof saved>)=>v.camera.position=[0,0,0],(v:ReturnType<typeof saved>)=>v.camera.center=[0,91]]){const v=saved();edit(v);expect(()=>parseLocalView(v)).toThrow();}});
 it('rejects a saved selection from another map',()=>{expect(()=>parseLocalView({...saved(),selected:{kind:'transition',id:'native-id',mapId:'WM2'}})).toThrow();});
});

it('retains a valid oversized personal state in memory instead of persisting unreadable JSON',()=>{let writes=0;const owner=new UserStateStorage({getItem:()=>null,setItem:()=>{writes++;},removeItem:()=>{}});owner.update(s=>{s.tours=Array.from({length:30},(_,i)=>({id:'tour-'+i,name:'t'.repeat(80),created:1,stops:Array.from({length:100},(_,j)=>({id:'stop-'+j,target:{kind:'atlas',id:'a'.repeat(100),mapId:'WM0'},title:'x'.repeat(120),duration:10}))}));});expect(owner.bytes).toBeGreaterThan(400_000);expect(owner.state.tours).toHaveLength(30);expect(owner.status).toBe('memory');expect(writes).toBe(0);});

it('rejects file/data/javascript origins so an absolute filesystem path cannot become a shared URL',()=>{const state={schema:'gaiagis-share-state' as const,version:1 as const,language:'en' as const,mapId:'WM0' as const,projection:'globe' as const,native:'3d' as const,layers:[],spoilers:'hide-major' as const,target:null};for(const url of ['file:///C:/Users/example/index.html','data:text/html,viewer','javascript:alert(1)']){expect(()=>encodeShare(url,state)).toThrow();expect(decodeShare(url)).toBeNull();}});
