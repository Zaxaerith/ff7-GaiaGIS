"""Public synthetic-only checks for the independent rational Camera oracle."""
# SPDX-License-Identifier: GPL-3.0-only
from fractions import Fraction
import math
import unittest

from gaiagis.field_camera import project
from gaiagis.field_registration import rational_projection, reference_pixel


def camera(**edit):
    return dict(matrix=[4096, 0, 0, 0, 4096, 0, 0, 0, 4096],
                translation=[0, 0, 100], zoom=200, **edit)


class FieldRegistrationTests(unittest.TestCase):
    def test_exact_rational_projection_and_positive_down_y(self):
        q, screen = rational_projection(camera(), (3, -7, 0))
        self.assertEqual(q, (3, -7, 100))
        self.assertEqual(screen, (6, -14))
        c = camera()
        c.update(matrix=[4095, 1, -2, -4, 4093, 5, 6, -7, 4091],
                 translation=[-13, 21, 400])
        q, screen = rational_projection(c, (-120, 90, -11))
        self.assertEqual(q[0], Fraction(-544536, 4096))
        self.assertEqual(screen[0], Fraction(200)*q[0]/q[2])

    def test_depth_boundary_and_invalid_points(self):
        c = camera()
        c['translation'] = [0, 0, 0]
        for z in (-100, 0, 1e-12, 1e-6):
            self.assertIsNone(rational_projection(c, (1, -1, z))[1])
        self.assertIsNotNone(rational_projection(c, (1, -1, math.nextafter(1e-6, math.inf)))[1])
        for p in ((1, 2), (math.inf, 0, 1), (0, math.nan, 1), (True, 0, 1)):
            with self.assertRaises(ValueError):
                rational_projection(c, p)

    def test_independent_oracle_agrees_with_existing_renderer_on_synthetic_cameras(self):
        for n in range(6):
            c = camera()
            c.update(matrix=[4096-n, n, -2*n, n, 4096-2*n, 3*n, -n, 2*n, 4096-n],
                     translation=[-30*n, 20*n, 1000+100*n], zoom=100+32*n)
            for xyz in ((-300, 90, -10), (0, 0, 0), (32767, -32768, 30000),
                        (1e9, -1e9, 1e10), (-.5, 1.25, 2.5), (0, 0, -100000)):
                expected = rational_projection(c, xyz)[1]
                actual = project(c, xyz)
                if expected is None:
                    self.assertIsNone(actual)
                else:
                    for left, right in zip(expected, actual):
                        self.assertAlmostEqual(float(left), right, delta=max(1e-9, abs(right)*1e-12))

    def test_explicit_crop_scale_is_exact_and_never_changes_source(self):
        point = (Fraction(3, 2), -2)
        source, reference = (-160, -120, 320, 240), (10, 20, 640, 480)
        self.assertEqual(reference_pixel(point, source, reference), (333, 256))
        self.assertEqual(point, (Fraction(3, 2), -2))
        for source in ((0, 0, 0, 2), (0, 0, 2, -1), (0, 0, 1, math.inf)):
            with self.assertRaises(ValueError):
                reference_pixel(point, source, reference)


if __name__ == '__main__':
    unittest.main()
