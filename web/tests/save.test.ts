// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {parsePCSave,saveChecksum,saveText,PC_SAVE_SIZE,PC_SLOT_SIZE,bindSaveWorld} from '../src/data/save';
import {SaveSession} from '../src/app/saveSession';
import {validateShareState} from '../src/app/shareState';
import {projections} from '../src/projections';
import {sourceGeographic} from '../src/explorer/coordinates';
import {dictionaries,locales} from '../src/i18n';

function fixture(module=3,map=0,model=0){const a=new Uint8Array(PC_SAVE_SIZE),v=new DataView(a.buffer);a.set([0x71,0x73,0x27,0x06]);const o=9,u16=(p:number,n:number)=>v.setUint16(o+p,n,true),u32=(p:number,n:number)=>v.setUint32(o+p,n,true);a[o+0x55]=21;a[o+0x4f9]=a[o+0x4fa]=255;u16(0x80,700);u16(0x8c,800);u16(0x84,55);u16(0x8e,70);u32(0xb7c,12345);u32(0xb80,3661);u16(0xb94,module);u16(0xb96,200);u16(0xba4,100);a[o+0xea4]=1;for(let i=0;i<6;i++)u32(0xf5c+i*8,(31<<19));const r=({0:0,3:3,6:3,5:2,13:4} as Record<number,number>)[model]??0;u32(0xf5c+r*8,123456|(model<<19)|(128<<24));u32(0xf60+r*8,123456|(321<<18));a[o+0xfa1]=model;a[o+0xfa2]=map;a[o+0x28]=0x21;a[o+0x29]=255;u16(0,saveChecksum(a.subarray(o,o+PC_SLOT_SIZE)));return a;}
function change(a:Uint8Array<ArrayBuffer>,fn:(v:DataView,b:Uint8Array)=>void){fn(new DataView(a.buffer,9,PC_SLOT_SIZE),a.subarray(9,9+PC_SLOT_SIZE));new DataView(a.buffer).setUint16(9,saveChecksum(a.subarray(9,9+PC_SLOT_SIZE)),true);return a;}
describe('read-only PC multi-slot save',()=>{
 it('reads authoritative fields rather than previews',()=>{const b=fixture(),before=b.slice(),s=parsePCSave(b.buffer).slots[0];expect(s.status).toBe('valid');expect(s.gil).toBe(12345);expect(s.seconds).toBe(3661);expect(s.party[0]).toMatchObject({character:'cloud',level:21,hp:700,maxHp:800,mp:55,maxMp:70});expect(s.locationPreview).toBe('A');expect(b).toEqual(before);});
 it('15 slots; one file is not one slot',()=>{const b=fixture();b.copyWithin(9+4340,9,9+4340);const s=parsePCSave(b.buffer).slots;expect(s).toHaveLength(15);expect(s.filter(s=>s.status==='valid')).toHaveLength(2);expect(s[14].status).toBe('empty');});
 it('all-zero empty file slots',()=>{const b=new Uint8Array(PC_SAVE_SIZE);b.set([0x71,0x73,0x27,0x06]);expect(parsePCSave(b.buffer).slots.every(s=>s.status==='empty')).toBe(true);});
 it('zero-filled empty checksum form',()=>{const b=new Uint8Array(PC_SAVE_SIZE);b.set([0x71,0x73,0x27,0x06]);new DataView(b.buffer).setUint16(9,0x4d1d,true);expect(saveChecksum(b.subarray(9,9+4340))).toBe(0x4d1d);expect(parsePCSave(b.buffer).slots[0].status).toBe('empty');});
 for(const size of [0,1,4340,65108,65110,131072,1_000_000])it('reject length '+size,()=>expect(()=>parsePCSave(new ArrayBuffer(size))).toThrow('size'));
 it('rejects non-PC signature / console format',()=>{const b=fixture();b[0]=0;expect(()=>parsePCSave(b.buffer)).toThrow('format');});
 it('checksum mismatch disables data/position',()=>{const b=fixture();b[200]^=1;const s=parsePCSave(b.buffer).slots[0];expect(s.status).toBe('checksum');expect(s.binding).toBeNull();});
 it('upper checksum word rejects unknown version semantics',()=>{const b=fixture();b[11]=1;expect(parsePCSave(b.buffer).slots[0].status).toBe('invalid');});
 for(const module of [0,2,255,65535])it('unsupported module '+module,()=>expect(parsePCSave(fixture(module).buffer).slots[0].status).toBe('invalid'));
 it('out-of-bounds party identifiers never read another record',()=>{const b=change(fixture(),(_,a)=>a[0x4f8]=254);expect(parsePCSave(b.buffer).slots[0].status).toBe('invalid');});
 it('invalid stats do not become valid save state',()=>{const b=change(fixture(),v=>v.setUint16(0x80,65535,true));expect(parsePCSave(b.buffer).slots[0].status).toBe('invalid');});
 it('Western text only; unknown glyphs explicit',()=>{expect(saveText(new Uint8Array([0x21,255]))).toBe('A');expect(saveText(new Uint8Array([0xfa,255]))).toBeNull();expect(saveText(new Uint8Array([0x21]))).toBeNull();});
});
describe('evidence-constrained coordinate binding',()=>{
 for(const model of [0,3,5,6])it('matches current object record '+model,()=>{const b=parsePCSave(fixture(3,0,model).buffer).slots[0].binding!;expect(b.raw.model).toBe(model);expect(b.game_east).toBe(123456);expect(b.game_north).toBe(229376-123456);expect(b.geographic).toEqual(sourceGeographic(123456,123456,0));});
 for(const map of [1,2,3,255])it('native/unknown map has raw records only '+map,()=>{const s=parsePCSave(fixture(3,map,map===2?13:0).buffer).slots[0];expect(s.status).toBe('valid');expect(s.world).toHaveLength(6);expect(s.binding).toBeNull();});
 it('field save never uses stale world position',()=>expect(parsePCSave(fixture(1).buffer).slots[0].binding).toBeNull());
 it('current model mismatched record refuses marker',()=>{const b=change(fixture(),(_,a)=>a[0xfa1]=6);expect(parsePCSave(b.buffer).slots[0].binding).toBeNull();});
 it('unknown model refuses marker',()=>{const b=change(fixture(),(_,a)=>a[0xfa1]=30);expect(parsePCSave(b.buffer).slots[0].binding).toBeNull();});
 for(const [x,z] of [[294912,0],[0,229376],[524287,262143]])it('out of WM0 extent '+x+'/'+z,()=>{const s=parsePCSave(fixture().buffer).slots[0];s.world[0].x=x;s.world[0].z=z;expect(bindSaveWorld(s)).toBeNull();});
 it('zero origin is valid, not replaced by a guessed location',()=>{const s=parsePCSave(fixture().buffer).slots[0];s.world[0].x=s.world[0].z=0;expect(bindSaveWorld(s)?.game_east).toBe(0);});
 for(const id of Object.keys(projections))it('one geometry through projection '+id,()=>{const s=parsePCSave(fixture().buffer).slots[0],before=JSON.stringify(s),b=s.binding!,context={radius:1,mercatorLimit:85.0511287798066,centerLon:0,centerLat:0};const p=projections[id as keyof typeof projections].project(...b.geographic,context);expect(p.every(Number.isFinite)).toBe(true);expect(JSON.stringify(s)).toBe(before);});
});
describe('session privacy and lifecycle',()=>{
 it('load/select/reimport/clear; no persistent storage',async()=>{const session=new SaveSession();await session.import({size:PC_SAVE_SIZE,arrayBuffer:async()=>fixture().buffer});expect(session.slot?.index).toBe(1);session.select(14);expect(session.slot?.status).toBe('empty');await session.import({size:PC_SAVE_SIZE,arrayBuffer:async()=>fixture(1).buffer});expect(session.slot?.module).toBe(1);session.clear();expect(session.slots).toEqual([]);expect(session.slot).toBeNull();});
 it('failed replacement is atomic',async()=>{const s=new SaveSession();await s.import({size:PC_SAVE_SIZE,arrayBuffer:async()=>fixture().buffer});const old=s.slot;await expect(s.import({size:5,arrayBuffer:async()=>new ArrayBuffer(5)})).rejects.toThrow();expect(s.slot).toBe(old);});
 it('late file read cannot undo clear',async()=>{const s=new SaveSession();let resolve!:(b:ArrayBuffer)=>void;const pending=s.import({size:PC_SAVE_SIZE,arrayBuffer:()=>new Promise(r=>resolve=r)});s.clear();resolve(fixture().buffer);await pending;expect(s.slot).toBeNull();});
 it('last import wins async race',async()=>{const s=new SaveSession();let resolve!:(b:ArrayBuffer)=>void;const old=s.import({size:PC_SAVE_SIZE,arrayBuffer:()=>new Promise(r=>resolve=r)});await s.import({size:PC_SAVE_SIZE,arrayBuffer:async()=>fixture(1).buffer});resolve(fixture().buffer);await old;expect(s.slot?.module).toBe(1);});
 for(const key of ['save','playerCoordinates','party','progress','privatePath'])it('Share rejects '+key,()=>{expect(()=>validateShareState({schema:'gaiagis-share-state',version:1,language:'en',mapId:'WM0',projection:'globe',native:'3d',layers:[],spoilers:'hide-major',target:null,[key]:[123,456]})).toThrow();});
 it('five locales contain every save label',()=>{const keys=Object.keys(dictionaries.en).filter(k=>k.startsWith('save27.'));expect(keys.length).toBeGreaterThan(30);for(const l of locales)for(const k of keys)expect(dictionaries[l][k]).toBeTruthy();});
});
