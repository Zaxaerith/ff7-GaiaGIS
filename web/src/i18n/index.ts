import {saveCatalog} from './saveCatalog';
import {userMappingCatalog} from './userMappingCatalog';
import {shellCatalog} from './shellCatalog';
import {spatialCatalog} from './spatialCatalog';
import {navigationCatalog} from './navigationCatalog';
import {atlasCatalog} from './atlasCatalog';
import {presentationCatalog} from './presentationCatalog';
import {integratedCatalog} from './integratedCatalog';
// SPDX-License-Identifier: GPL-3.0-only
import {catalog as coreCatalog} from './catalog';
import {uiCatalog} from './uiCatalog';
import {helpCatalog} from './helpCatalog';
import {inspectorCatalog} from './inspectorCatalog';
import {messagesCatalog} from './messagesCatalog';
import {textureCatalog} from './textureCatalog';
import {multimapCatalog} from './multimapCatalog';
import {explorerCatalog} from './explorerCatalog';
import {cartographyCatalog} from './cartographyCatalog';
export const catalog=[...coreCatalog,...uiCatalog,...helpCatalog,...inspectorCatalog,...messagesCatalog,...cartographyCatalog,...textureCatalog,...multimapCatalog,...explorerCatalog,...integratedCatalog,...presentationCatalog,...atlasCatalog,...navigationCatalog,...shellCatalog,...spatialCatalog,...userMappingCatalog,...saveCatalog] as const;
export const locales=['en','zh-CN','zh-TW','ja','ko'] as const;export type Locale=typeof locales[number];
export const localeNames=['English','简体中文','繁體中文','日本語','한국어'];
export const dictionaries=Object.fromEntries(locales.map((l,i)=>[l,Object.fromEntries(catalog.map(row=>[row[0],row[i+1]]))])) as Record<Locale,Record<string,string>>;
export type TranslationKey=typeof catalog[number][0];
export function matchLocale(language:string):Locale|null{const s=language.toLowerCase();if(s.startsWith('zh'))return /tw|hk|hant/.test(s)?'zh-TW':'zh-CN';return locales.find(l=>l===s.split('-')[0])??null;}
export function detectLocale(url:string,saved:string|null,languages:readonly string[]):Locale{const explicit=new URL(url).searchParams.get('lang');return explicit&&matchLocale(explicit)||saved&&matchLocale(saved)||languages.map(matchLocale).find(Boolean)||'en';}
let current:Locale='en';const listeners=new Set<()=>void>();export const locale=()=>current;
type Binding={key:string;args:Record<string,string|number>;value?:string};const rendered=new Map<string,Binding>(),nodes=new WeakMap<Node,Binding>(),attrs=new WeakMap<Element,Map<string,Binding>>();
export function formatNumber(value:number,maximumFractionDigits=2){return new Intl.NumberFormat(current,{maximumFractionDigits}).format(value);}
export function t(key:string,args:Record<string,string|number>={}){if(dictionaries[current][key]===undefined&&dictionaries.en[key]!==undefined&&import.meta.env.DEV)console.warn(`Missing ${current} translation: ${key}`);let value=dictionaries[current][key]??dictionaries.en[key];if(value===undefined){if(import.meta.env.DEV)console.warn(`Missing translation key: ${key}`);return key;}value=value.replace(/\{(\w+)\}/g,(_,name)=>typeof args[name]==='number'?formatNumber(args[name]):String(args[name]??`{${name}}`));if(rendered.size>20000){for(const key of Array.from(rendered.keys()).slice(0,10000))rendered.delete(key);}rendered.set(value,{key,args,value});return value;}
function bind(root:Node){if(root instanceof Element&&root.hasAttribute('data-user-text')||root.nodeType===Node.TEXT_NODE&&root.parentElement?.closest('[data-user-text]'))return;if(root.nodeType===Node.TEXT_NODE){const text=root.textContent??'',previous=nodes.get(root),b=rendered.get(text.trim())??(previous?.value===text.trim()?previous:undefined);if(b){const leading=text.match(/^\s*/)?.[0]??'',trailing=text.match(/\s*$/)?.[0]??'',value=t(b.key,b.args),next=leading+value+trailing;nodes.set(root,{...b,value});if(text!==next)root.textContent=next;}else nodes.delete(root);return;}if(root instanceof Element){let map=attrs.get(root);for(const name of ['aria-label','title','placeholder','label']){const value=root.getAttribute(name),previous=map?.get(name);const b=value&&(rendered.get(value)??(previous?.value===value?previous:undefined));if(b){map??=new Map();map.set(name,b);}else map?.delete(name);}if(map){attrs.set(root,map);for(const [name,b]of map){const value=t(b.key,b.args);map.set(name,{...b,value});if(root.getAttribute(name)!==value)root.setAttribute(name,value);}}}for(const child of root.childNodes)bind(child);}
export function setLocale(next:Locale,persist=true){current=next;if(persist){try{localStorage.setItem('gaiagis.locale',next);}catch{}const url=new URL(location.href);if(url.searchParams.has('lang')){url.searchParams.set('lang',next);history.replaceState(null,'',url);}}if(typeof document!=='undefined'){document.documentElement.lang=current;bind(document.body);}for(const listener of listeners)listener();}
export function onLocaleChange(listener:()=>void){listeners.add(listener);return ()=>listeners.delete(listener);}
export function initializeLocale(){let saved=null;try{saved=localStorage.getItem('gaiagis.locale');}catch{}current=detectLocale(location.href,saved,navigator.languages);document.documentElement.lang=current;}
export function observeTranslations(){bind(document.body);const observer=new MutationObserver(records=>{for(const r of records){if(r.type==='characterData')bind(r.target);else if(r.type==='attributes')bind(r.target);else for(const node of r.addedNodes)bind(node);}});observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','label']});return ()=>observer.disconnect();}
