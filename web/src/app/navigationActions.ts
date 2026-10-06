// SPDX-License-Identifier: GPL-3.0-only
import type {NavigationEntry} from './navigation';
import type {IdentityTarget} from './userState';
import type {AppState} from './state';
import {isPublicTarget} from './shareState';
/** One capability registry shared by Inspector and discovery controls. */
export function navigationActions(state:Readonly<AppState>,target:IdentityTarget|null,entry:NavigationEntry|undefined,routeAvailable=false){const overview=state.explorer.phase==='idle',wm0=state.map.id==='WM0';return {bookmark:overview&&!!target,nearby:overview&&wm0&&!!entry?.anchor,addTour:overview&&wm0&&target?.mapId==='WM0'&&!!entry?.canTour,share:overview&&!!target&&isPublicTarget(target.kind,target.id),playRoute:overview&&wm0&&routeAvailable};}
