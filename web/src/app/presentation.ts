// SPDX-License-Identifier: GPL-3.0-only
import {t,onLocaleChange} from '../i18n';
import {workspaceLoader,loadedAsset} from './assets';
import {appStore} from './state';
import {decodePresentation,UISounds,type Cue} from '../data/presentation';
export type LightingPreset='original'|'flat'|'debug';
export interface PresentationPreferences {theme:'ff7'|'scientific';lighting:LightingPreset;sounds:boolean;volume:number;}
export function readPreferences(value:unknown):PresentationPreferences{const p=value as Partial<PresentationPreferences>|null;return {theme:p?.theme==='scientific'?'scientific':'ff7',lighting:['original','flat','debug'].includes(p?.lighting??'')?p!.lighting!:'original',sounds:p?.sounds===true,volume:typeof p?.volume==='number'&&Number.isFinite(p.volume)?Math.max(0,Math.min(1,p.volume)):.25};}
let saved:unknown;try{saved=JSON.parse(localStorage.getItem('gaiagis.presentation')??'null');}catch{}
export const presentation=readPreferences(saved),uiSounds=new UISounds();
export function setPresentation(update:Partial<PresentationPreferences>){Object.assign(presentation,readPreferences({...presentation,...update}));document.documentElement.dataset.theme=presentation.theme;uiSounds.enabled=presentation.sounds;uiSounds.volume=presentation.volume;try{localStorage.setItem('gaiagis.presentation',JSON.stringify(presentation));}catch{}document.dispatchEvent(new Event('gaiagis-presentation'));}
export interface SoundInteraction {kind:'click'|'change';tag:string;id:string;trusted:boolean;disabled:boolean;prevented?:boolean;changed?:boolean;closing?:boolean;inputType?:string;cue?:string;}
/** Input acknowledgement, never an inference of asynchronous operation success. */
export function interactionCue(a:SoundInteraction):Cue|null{
 if(!a.trusted||a.disabled||a.prevented||a.cue==='none')return null;
 if(a.kind==='change'&&a.changed===false)return null;
 if(a.cue&&['cursor','confirm','cancel'].includes(a.cue))return a.cue as Cue;
 if(a.kind==='change')return a.tag==='SELECT'?'cursor':a.tag==='INPUT'&&['checkbox','radio'].includes(a.inputType??'')?'confirm':null;
 if(a.tag==='SUMMARY')return a.closing?'cancel':'confirm';
 return a.tag==='BUTTON'?/(?:^|-)(close|exit|cancel|back)(?:-|$)/.test(a.id)?'cancel':'confirm':null;
}
/** Owners may report an actual rejection; no error cue is guessed from an ID. */
export function notifyUISound(cue:'confirm'|'cancel'|'invalid'){document.dispatchEvent(new CustomEvent('gaiagis:ui-sound',{detail:cue}));}
let stopSounds:(()=>void)|null=null;
export function initializePresentation(){
 stopSounds?.();setPresentation({});const listeners:[string,EventListener,boolean][]=[],values=new WeakMap<Element,string>();let pending:ReturnType<typeof setTimeout>|null=null;
 const listen=(name:string,fn:EventListener,capture=false)=>{document.addEventListener(name,fn,capture);listeners.push([name,fn,capture]);};
 const clear=()=>{if(pending!==null)clearTimeout(pending);pending=null;};
 const control=(e:Event)=>e.target instanceof Element?e.target.closest('button,summary,select,input'):null;
 const value=(el:Element)=>el instanceof HTMLInputElement&&['checkbox','radio'].includes(el.type)?String(el.checked):(el as HTMLInputElement|HTMLSelectElement).value;
 const disabled=(el:Element)=>el.matches(':disabled')||!!el.closest('[aria-disabled="true"],[inert]');
 const remember=(e:Event)=>{const el=control(e);if(el&&['INPUT','SELECT'].includes(el.tagName))values.set(el,value(el));};
 const gesture=(e:Event)=>{if(e.isTrusted){uiSounds.unlock();remember(e);}};
 listen('pointerdown',gesture,true);listen('keydown',gesture,true);listen('focusin',remember,true);
 const acknowledge=(e:Event)=>{const el=control(e);if(!el)return;const kind=e.type as 'click'|'change',next=value(el),old=values.get(el);if(kind==='change')values.set(el,next);
  const a:SoundInteraction={kind,tag:el.tagName,id:el.id,trusted:e.isTrusted,disabled:disabled(el),changed:old===undefined||old!==next,closing:el.tagName==='SUMMARY'&&(el.parentElement as HTMLDetailsElement)?.open,inputType:(el as HTMLInputElement).type,cue:el.getAttribute('data-ui-sound')??undefined};
  // Wait for default form validation and handlers; one native activation only.
  if(!interactionCue(a))return;clear();pending=setTimeout(()=>{pending=null;const cue=interactionCue({...a,prevented:e.defaultPrevented});if(cue)uiSounds.play(cue);},0);
 };
 listen('click',acknowledge,true);listen('change',acknowledge,true);
 listen('invalid',e=>{if(e.isTrusted&&e.target instanceof Element&&!disabled(e.target)){clear();uiSounds.play('invalid');}},true);
 listen('gaiagis:ui-sound',e=>{const cue=(e as CustomEvent).detail;if(['confirm','cancel','invalid'].includes(cue)){clear();uiSounds.play(cue);}});
 const stop=()=>{clear();for(const [name,fn,capture]of listeners)document.removeEventListener(name,fn,capture);if(stopSounds===stop)stopSounds=null;};stopSounds=stop;return stop;
}
export function mountPresentation(parent:HTMLElement){const root=document.createElement('details');root.className='presentation-settings';root.id='presentation-settings';const title=document.createElement('summary');root.append(title);parent.prepend(root);
 const select=(id:string,options:string[])=>{const label=document.createElement('label'),el=document.createElement('select');el.id=id;label.htmlFor=id;for(const value of options){const o=document.createElement('option');o.value=value;el.append(o);}root.append(label,el);return {label,el};};
 const theme=select('presentation-theme',['ff7','scientific']),light=select('presentation-lighting',['original','flat','debug']);const sounds=document.createElement('input'),soundLabel=document.createElement('label'),volume=document.createElement('input'),volumeLabel=document.createElement('label'),status=document.createElement('p');sounds.id='presentation-sounds';sounds.type='checkbox';volume.id='presentation-volume';volume.type='range';volume.min='0';volume.max='100';volume.step='1';soundLabel.htmlFor=sounds.id;volumeLabel.htmlFor=volume.id;root.append(soundLabel,sounds,volumeLabel,volume,status);
 theme.el.onchange=()=>setPresentation({theme:theme.el.value as PresentationPreferences['theme']});light.el.onchange=()=>setPresentation({lighting:light.el.value as LightingPreset});sounds.onchange=()=>setPresentation({sounds:sounds.checked});volume.oninput=()=>setPresentation({volume:Number(volume.value)/100});
 const refresh=()=>{title.textContent=t('present.title');theme.label.textContent=t('present.theme');light.label.textContent=t('present.lighting');for(const o of [...theme.el.options,...light.el.options])o.textContent=t('present.'+o.value);theme.el.value=presentation.theme;light.el.value=presentation.lighting;sounds.checked=presentation.sounds;sounds.disabled=!uiSounds.available;volume.value=String(presentation.volume*100);soundLabel.textContent=t('present.sounds');volumeLabel.textContent=t('present.volume')+' · '+Math.round(presentation.volume*100)+'%';status.textContent=t(uiSounds.available?'present.audioReady':'present.noAudio');};
 let generation=appStore.state.data.generation;const unsubscribe=appStore.subscribe(state=>{if(state.data.generation!==generation){generation=state.data.generation;uiSounds.dispose();refresh();}});
 const unregister=workspaceLoader.register('presentation',async files=>{const pack=decodePresentation(JSON.parse(await files[0].text()));await uiSounds.load(pack);loadedAsset('presentation',files[0].size);document.dispatchEvent(new Event('gaiagis-presentation'));refresh();});const stop=onLocaleChange(refresh);document.addEventListener('gaiagis-presentation',refresh);refresh();return ()=>{stop();unsubscribe();unregister();uiSounds.dispose();document.removeEventListener('gaiagis-presentation',refresh);root.remove();};
}
