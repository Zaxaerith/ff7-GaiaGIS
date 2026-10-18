"""Independent exact-rational Camera oracle; no calibration or data mutation.

This reference calculation deliberately does not call field_camera.project.
Results verify mathematics, never original-game screenshot registration.
"""
# SPDX-License-Identifier: GPL-3.0-only
from fractions import Fraction
import math


def rational_projection(camera, point):
    """Return exact (q, screen) in raw camera pixels, with positive Y down.

    Raw Q12 matrix products remain rational until the caller requests floats.
    The existing renderer's q.z <= 1e-6 rejection is preserved exactly.
    """
    matrix, translation, zoom = camera['matrix'], camera['translation'], camera['zoom']
    if len(matrix) != 9 or len(translation) != 3 or len(point) != 3:
        raise ValueError('Camera/point shape')
    if not all(isinstance(n, (int, float)) and not isinstance(n, bool) and math.isfinite(n)
               for n in (*matrix, *translation, zoom, *point)) or zoom <= 0:
        raise ValueError('Camera/point numbers')
    p = tuple(Fraction(n) for n in point)
    q = tuple(sum((Fraction(matrix[row*3+k])*p[k] for k in range(3)),
                  Fraction(translation[row])*4096)/4096 for row in range(3))
    if q[2] <= Fraction(1, 1_000_000):
        return q, None
    return q, (Fraction(zoom)*q[0]/q[2], Fraction(zoom)*q[1]/q[2])


def reference_pixel(screen, source_rect, reference_rect):
    """Explicit rectangle mapping, without fitting Camera or source points."""
    if len(screen) != 2 or len(source_rect) != 4 or len(reference_rect) != 4:
        raise ValueError('Pixel mapping shape')
    if not all(math.isfinite(v) for v in (*screen, *source_rect, *reference_rect)):
        raise ValueError('Pixel mapping numbers')
    if min(source_rect[2:]) <= 0 or min(reference_rect[2:]) <= 0:
        raise ValueError('Pixel mapping dimensions')
    return tuple(Fraction(reference_rect[i])+(Fraction(screen[i])-Fraction(source_rect[i]))*
                 Fraction(reference_rect[i+2])/Fraction(source_rect[i+2]) for i in range(2))
