# SPDX-License-Identifier: GPL-3.0-only
"""Explicit map identities; native coordinates never imply global geography."""
from enum import Enum


class MapId(str, Enum):
    WM0 = 'WM0'
    WM2 = 'WM2'
    WM3 = 'WM3'


def native_space(map_id):
    return MapId(map_id).value + 'Native'


def engine_position(map_id, x, z):
    """Classic-PC archive placement only, NOT Steam runtime/global CRS proof.

    C_007533AF assigns underwater archive block (col,row) to engine block
    (col+3,row+2), in units of 32768. WM3 uses its own 2x2 native domain.
    """
    identity = MapId(map_id)
    return (x + 98304, z + 65536) if identity == MapId.WM2 else (x, z)


def native_position(map_id, x, z):
    identity = MapId(map_id)
    return (x - 98304, z - 65536) if identity == MapId.WM2 else (x, z)
