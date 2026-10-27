// SPDX-License-Identifier: GPL-3.0-only
/** Small shared DOM primitives; feature owners continue to own content and state. */
export function evidenceSection(parent:HTMLElement,label:string):HTMLDetailsElement{
 const detail=document.createElement('details'),summary=document.createElement('summary');
 detail.className='vii-fold vii-evidence';detail.open=false;summary.textContent=label;detail.append(summary);parent.append(detail);return detail;
}
export function storySection(parent:HTMLElement,label:string):HTMLElement{
 const section=document.createElement('section'),heading=document.createElement('h4');
 section.className='vii-section';heading.textContent=label;section.append(heading);parent.append(section);return section;
}
export function contentHeading(parent:HTMLElement,title:string,meta=''):HTMLElement{
 const header=document.createElement('header'),heading=document.createElement('h3');header.className='vii-content-heading';heading.textContent=title;header.append(heading);
 if(meta){const kicker=document.createElement('p');kicker.className='vii-kicker';kicker.textContent=meta;header.append(kicker);}parent.append(header);return header;
}
