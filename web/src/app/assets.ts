// SPDX-License-Identifier: GPL-3.0-only
import {appStore} from './state';
import type {AssetId} from './state';
import {WorkspaceLoader} from './workspace';
export const workspaceLoader=new WorkspaceLoader((id,asset)=>appStore.dispatch({type:'asset',id,asset}));
export function loadedAsset(id:AssetId,bytes=0,version=1){appStore.dispatch({type:'asset',id,asset:{status:'loaded',bytes,version}});}
