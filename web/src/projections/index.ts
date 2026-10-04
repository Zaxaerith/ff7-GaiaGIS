// SPDX-License-Identifier: GPL-3.0-only
import {globe} from './globe';
import {equirectangular} from './equirectangular';
import {mercator} from './mercator';
import {mollweide} from './mollweide';
import {orthographic} from './orthographic';
import {equalEarth,winkelTripel,robinson,naturalEarth,sinusoidal,gallPeters,laea,aeqd} from './gallery';
export const projections={globe,equirectangular,mercator,mollweide,orthographic,'equal-earth':equalEarth,'winkel-tripel':winkelTripel,robinson,'natural-earth':naturalEarth,sinusoidal,'gall-peters':gallPeters,laea,aeqd};
