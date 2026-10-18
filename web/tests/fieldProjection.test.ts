// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect,vi} from 'vitest';
import {projectionDiagnostic,screenAssociations,walkmeshSourceHash} from '../src/data/fieldProjection';
import type {FieldCamera} from '../src/data/fieldCamera';
import {decodeWalkmesh,openWalkmeshPack,parseFieldPack} from '../src/data/fieldContext';
import {openFieldVisual} from '../src/data/fieldCamera';
import {mountFieldProjection} from '../src/ui/fieldProjection';
import {ResourceScope} from '../src/app/resources';
const camera:FieldCamera={id:0,offset:0,matrix:[4096,0,0,0,4096,0,0,0,4096],translation:[0,0,0],zoom:20,repeatedRzz:4096,extra:[0,0,0,0]};
function mesh(){const raw=new ArrayBuffer(64),v=new DataView(raw);v.setUint32(0,2,true);for(let t=0;t<2;t++)for(const [k,p]of [[0,[0,0,10,10]],[1,[10,0,10,10]],[2,[0,10,10,10]]] as const)p.forEach((n,i)=>v.setInt16(4+t*24+k*8+i*2,n,true));for(let i=52;i<64;i+=2)v.setUint16(i,65535,true);return {raw,mesh:decodeWalkmesh(raw)};}
describe('source Camera projection diagnostics',()=>{
 it('retains source Q12 translation and both screen/Canvas Y directions',()=>{const d=projectionDiagnostic(camera,[2,-3,10],[-5,-5,5,5],{width:100,height:80,scale:2,centerX:1,centerY:2});expect(d.q).toEqual([2,-3,10]);expect(d.screen).toEqual([4,-6]);expect(d.canvas).toEqual([56,32]);expect(d.outsideBackground).toBe(true);expect(d.outsideCanvas).toBe(false);expect(d.occlusion).toBe('unknown');});
 it('distinguishes missing, invalid numeric and original depth cutoff',()=>{expect(projectionDiagnostic(null,[0,0,1]).reason).toBe('missing_camera');for(const z of [-1,0,1e-6])expect(projectionDiagnostic(camera,[0,0,z]).reason).toBe('invalid_depth');expect(projectionDiagnostic(camera,[NaN,0,1]).reason).toBe('invalid_numeric');expect(projectionDiagnostic(camera,[0,0,1.000001e-6]).reason).toBe('valid');expect(projectionDiagnostic(camera,[1e308,0,1e-5]).reason).toBe('invalid_numeric');});
 it('switches original Camera without modifying XYZ or Zoom',()=>{const p=[-4096,2048,100],before=JSON.stringify(p),other={...camera,id:1,translation:[4096,0,100],zoom:100};expect(projectionDiagnostic(camera,p).screen).toEqual([-819.2,409.6]);expect(projectionDiagnostic(other,p).screen).toEqual([0,1024]);expect(JSON.stringify(p)).toBe(before);expect(camera.zoom).toBe(20);});
 it('classifies Canvas clipping independently of background bounds',()=>{const d=projectionDiagnostic(camera,[20,0,10],[-100,-100,100,100],{width:10,height:10,scale:1,centerX:0,centerY:0});expect(d.outsideBackground).toBe(false);expect(d.outsideCanvas).toBe(true);expect(projectionDiagnostic(camera,[0,0,10]).outsideBackground).toBeNull();});
 it('retains every overlapping triangle and raw tile candidate without assigning XYZ',()=>{const m=mesh().mesh,a=screenAssociations(camera,m,[2,2],{status:'static_partial',tiles:[{x:0,y:0,id:0,layer:0,size:16,texture:0,palette:0,sourceOffset:52,offset:0},{x:0,y:0,id:1,layer:1,size:16,group:2,mask:8,supportCode:1,texture:0,palette:0,sourceOffset:104,offset:0}]});expect(a.triangles).toEqual([0,1]);expect(a.tiles.map(t=>t.id)).toEqual([0,1]);expect(a.uniqueXYZ).toBe(false);expect(a.occlusion).toBe('unknown');expect(screenAssociations(camera,m,[30,30]).triangles).toEqual([]);});
 it('handles reversed winding, boundary hits and invalid projected triangles',()=>{const m=mesh().mesh;for(let i=0;i<4;i++){const n=m.vertices[i];m.vertices[i]=m.vertices[8+i];m.vertices[8+i]=n;}expect(screenAssociations(camera,m,[0,0]).triangles).toEqual([0,1]);m.vertices[2]=-10;const a=screenAssociations(camera,m,[1,1]);expect(a.invalidTriangles).toBe(1);expect(a.triangles).toEqual([1]);});
 it('reconstructs the source fingerprint including raw padding and access slots',async()=>{const {raw,mesh:m}=mesh(),sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),n=>n.toString(16).padStart(2,'0')).join('');expect(await walkmeshSourceHash(m)).toBe(sha);m.vertices[3]=7;expect(await walkmeshSourceHash(m)).not.toBe(sha);});
});


// The UI only needs owned element creation here; a narrow DOM double avoids a
// new browser framework dependency while checking the actual refresh callback.
describe('projection Inspector missing-source transitions',()=>{
 it.each(['anchor','camera'])('replaces old XYZ when the %s becomes unavailable',kind=>{
  class Element {
   id='';textContent='';value='';checked=false;style:Record<string,string>={};dataset:Record<string,string>={};children:Element[]=[];parent:Element|null=null;onchange:(()=>void)|null=null;
   append(child:Element){child.parent=this;this.children.push(child);}
   replaceChildren(){this.children=[];}
   remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
  }
  const elements:Element[]=[],parent=new Element(),owner=new ResourceScope(),onInspect=vi.fn(),onSource=vi.fn();
  vi.stubGlobal('document',{createElement:()=>{const element=new Element();elements.push(element);return element;}});
  try{
   const options={owner,t:(key:string)=>key,fieldId:170,camera:camera as FieldCamera|null,mesh:mesh().mesh,meshSHA256:'a'.repeat(64),getTriangle:()=>0,getAnchor:()=>null,getView:()=>null,onInspect,onSource};
   const panel=mountFieldProjection(parent as unknown as HTMLElement,options);
   expect(onInspect.mock.lastCall?.[0]).toContain('XYZ [');
   if(kind==='anchor'){const input=elements.find(element=>element.id==='field-projection-anchor')!;input.checked=true;input.onchange!();}
   else{options.camera=null;panel.refresh();}
   expect(onInspect.mock.lastCall?.[0]).toBe('projection.missing');
   expect(onInspect.mock.lastCall?.[0]).not.toContain('XYZ [');
   const published=onSource.mock.calls.length;panel.refresh();expect(onSource.mock.calls.length).toBe(published);
   owner.dispose();expect(parent.children).toEqual([]);
  }finally{owner.dispose();vi.unstubAllGlobals();}
 });
});

it.skipIf(!process.env.GAIA_FIELD_REGISTRATION_ORACLE)('compares actual source vertices and Cameras with independent Python rational results',async()=>{
 const {readFile}=await import('node:fs/promises'),folder=process.env.GAIA_BROWSER_WORKSPACE??'../output/local-workspace',oracle=JSON.parse(await readFile(process.env.GAIA_FIELD_REGISTRATION_ORACLE!,'utf8'));
 const fields=parseFieldPack(JSON.parse(await readFile(folder+'/gaia-field-context.json','utf8'))),meshBytes=await readFile(folder+'/gaia-field-walkmesh.bin'),visualBytes=await readFile(folder+'/gaia-field-visual.bin');
 const meshes=await openWalkmeshPack(new File([Uint8Array.from(meshBytes)],'gaia-field-walkmesh.bin'),fields),visual=await openFieldVisual(new File([Uint8Array.from(visualBytes)],'gaia-field-visual.bin'),fields);expect(fields.sources['flevel.lgp']).toBe(oracle.sourceSHA256);let checked=0;
 for(const row of oracle.fields){const mesh=await meshes.decode(row.fieldId),camera=visual.scenes.get(row.fieldId)!.cameras[row.camera];expect(await walkmeshSourceHash(mesh)).toBe(row.section5SHA256);
  for(const point of row.points){const at=point.vertex*4,d=projectionDiagnostic(camera,Array.from(mesh.vertices.subarray(at,at+3)));expect(d.q).toEqual(point.q);expect(d.screen).toEqual(point.screen);checked++;}
 }
 expect(checked).toBe(oracle.vertices);expect(oracle.cameras).toBe(6);
},30000);
