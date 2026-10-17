"""Independent CPU pixel oracle for the PC indexed integer blend profile.

This is a reference calculation, not a Field VM. No Canvas, pack offsets or
browser arithmetic are involved. Fractional modes and PC16 blending are
deliberately unimplemented. Algorithm sources are cited in workspace-format.md.
"""
# SPDX-License-Identifier: GPL-3.0-only


def blend_rgb(back, front, mode):
    if mode not in (1, 2):
        raise ValueError('Unverified PC blend mode')
    if len(back) != 3 or len(front) != 3 or any(type(c) is not int or not 0 <= c <= 255 for c in (*back, *front)):
        raise ValueError('RGB byte channels required')
    result = []
    for b, f in zip(back, front):
        value = b + f if mode == 1 else b - f
        result.append(0 if value < 0 else 255 if value > 255 else value)
    return tuple(result)


def reference_rgba(tiles, palette, flags, pages, bounds, *, group=None, bit=None,
                   layers=(0, 1), base=True, raw_layers=False, opaque_only=False,
                   legacy=False):
    """Compose raw source rectangles, independently of the Visual pixel pool.

    The caller supplies raw records and the full original texture pages. Sorting
    is the corroborated Z/Sub order for 0/1, an explicit hypothesis for 2/3.
    Zero-alpha destination RGB starts black; a visible blended pixel is opaque.
    """
    import struct
    x0, y0, x1, y1 = bounds
    width, height = x1-x0, y1-y0
    if width < 0 or height < 0 or width*height > 4_000_000:
        raise ValueError('Reference canvas budget')
    rgba = bytearray(width*height*4)
    for t in sorted(tiles, key=lambda t: (-t['z'], -t['sub'], t['layer'], t['id'])):
        layer, size = t['layer'], t['size']
        conditional = layer > 0 and bool(t['group'] or t['mask'])
        if layer not in layers or layer > 1 and not raw_layers or abs(t['x']) > 4096 or abs(t['y']) > 4096:
            continue
        if layer and bool(t['group']) != bool(t['mask']):
            continue
        if conditional:
            if group != t['group'] or bit is None or not 0 <= bit < 8 or not t['mask'] & (1 << bit):
                continue
        elif not base:
            continue
        page = pages[t['texture']]; depth = page['depth']
        blend = layer > 0 and bool(t['blend'])
        if blend and (legacy or opaque_only or t['blend'] != 1 or depth == 2 or t['blendType'] not in (1, 2)):
            continue
        for row in range(size):
            for col in range(size):
                dest_x, dest_y = t['x']-x0+col, t['y']-y0+row
                if not 0 <= dest_x < width or not 0 <= dest_y < height:
                    raise ValueError('Reference destination span')
                pos = (t['sy']+row)*256+t['sx']+col
                if depth == 2:
                    word = struct.unpack_from('<H', page['pixels'], pos*2)[0]
                    if word == 0:
                        continue
                    word = 0 if word == 0x821 else word
                    channels = ((word >> shift) & 31 for shift in (11, 6, 0))
                else:
                    index = page['pixels'][pos] if depth == 1 else (page['pixels'][pos//2] >> ((pos % 2)*4)) & 15
                    if index == 0 and t['palette'] < len(flags) and flags[t['palette']]:
                        continue
                    colors = palette[12+t['palette']*512:12+(t['palette']+1)*512]
                    word = struct.unpack_from('<H', colors, index*2)[0] or struct.unpack_from('<H', colors)[0]
                    channels = ((word >> shift) & 31 for shift in (0, 5, 10))
                front = tuple((c << 3) | (c >> 2) for c in channels)
                at = (dest_y*width+dest_x)*4
                if blend:
                    front = blend_rgb(tuple(rgba[at:at+3]), front, t['blendType'])
                rgba[at:at+4] = bytes((*front, 255))
    return bytes(rgba)
