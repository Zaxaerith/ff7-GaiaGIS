// SPDX-License-Identifier: GPL-3.0-only
import {projectionIds,projectionRegistry} from '../projections/registry';
import {projections} from '../projections';
import type {ProjectionId} from '../projections/Projection';
import {locales,localeNames,locale,setLocale,t,onLocaleChange} from '../i18n';
export function mountProjectionGallery(){
  const selector=document.getElementById('projection') as HTMLSelectElement;
  const info=document.createElement('details');info.id='projection-info';info.className='projection-info';const summary=document.createElement('summary');summary.textContent=t('projection.info');const content=document.createElement('p');content.className='control-note';info.append(summary,content);document.querySelector('.controls')!.append(info);
  const render=()=>{const value=selector.value as ProjectionId||'globe';selector.replaceChildren();for(const family of ['perspective','cylindrical','pseudocylindrical','compromise','azimuthal']){const group=document.createElement('optgroup');group.label=t(`family.${family}`);for(const id of projectionIds.filter(id=>projectionRegistry[id].family===family)){const option=document.createElement('option');option.value=id;option.textContent=t(projectionRegistry[id].translationKey);option.title=projections[id].name;group.append(option);}selector.append(group);}selector.value=value;const definition=projectionRegistry[value];content.textContent=`${projections[value].name} · ${t('family.'+definition.family)} · ${t('property.'+definition.property)}. ${t('projection.custom')} ${t('projection.tradeoffs')}`;};
  selector.addEventListener('change',render);render();
  const label=document.createElement('label');label.textContent=t('nav.language');label.htmlFor='language';const language=document.createElement('select');language.id='language';language.setAttribute('aria-label',t('nav.language'));for(let i=0;i<locales.length;i++){const option=document.createElement('option');option.value=locales[i];option.textContent=localeNames[i];language.append(option);}language.value=locale();language.onchange=()=>setLocale(language.value as typeof locales[number]);document.getElementById('about-dialog')!.prepend(label,language);const unsubscribe=onLocaleChange(()=>{if(selector.isConnected){render();language.value=locale();}});return {dispose:unsubscribe};
}
