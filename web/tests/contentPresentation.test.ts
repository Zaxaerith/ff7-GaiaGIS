// SPDX-License-Identifier: GPL-3.0-only
import {afterEach,describe,it,expect,vi} from 'vitest';
import {contentHeading,evidenceSection,storySection} from '../src/ui/contentPresentation';
class ElementStub {
 children:ElementStub[]=[];className='';textContent='';open=false;
 constructor(readonly tagName:string){}
 append(...children:ElementStub[]){this.children.push(...children);}
}
const host=()=>{vi.stubGlobal('document',{createElement:(name:string)=>new ElementStub(name)});return new ElementStub('article') as unknown as HTMLElement;};
const nodes=(node:HTMLElement)=>(node as unknown as ElementStub).children;
afterEach(()=>vi.unstubAllGlobals());
describe('shared guide and Inspector presentation',()=>{
 it('keeps technical evidence folded by default with an accessible summary',()=>{const parent=host(),detail=evidenceSection(parent,'Original source');expect(detail.open).toBe(false);expect(detail.className).toBe('vii-fold vii-evidence');expect(nodes(detail)[0]).toMatchObject({tagName:'summary',textContent:'Original source'});expect(nodes(parent)).toEqual([detail]);});
 it('shows acquisition/reward story content immediately instead of nesting it in a disclosure',()=>{const parent=host(),section=storySection(parent,'How to obtain');expect((section as unknown as ElementStub).tagName).toBe('section');expect(section.className).toBe('vii-section');expect(nodes(section)[0]).toMatchObject({tagName:'h4',textContent:'How to obtain'});});
 it('puts the readable name before category and source identity',()=>{const parent=host(),header=contentHeading(parent,'Snow','Scene 169 · Enemy 210');expect(header.className).toBe('vii-content-heading');expect(nodes(header)).toEqual([expect.objectContaining({tagName:'h3',textContent:'Snow'}),expect.objectContaining({tagName:'p',className:'vii-kicker',textContent:'Scene 169 · Enemy 210'})]);});
 it('retains source text as text and does not require metadata or an HTML renderer',()=>{const parent=host(),title='<script>source name</script>',header=contentHeading(parent,title);expect(nodes(header)).toHaveLength(1);expect(nodes(header)[0].textContent).toBe(title);const detail=evidenceSection(parent,'Hash / Section / Actor / offset');expect(detail.open).toBe(false);expect(nodes(header)[0].textContent).toBe(title);});
});
