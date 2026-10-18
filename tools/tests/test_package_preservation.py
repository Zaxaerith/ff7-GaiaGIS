"""Local package preflight never deletes retained distribution artifacts."""
# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'src'));sys.path.insert(0,str(ROOT/'tools/build'))
import local_package

class PackagePreservationTests(unittest.TestCase):
    def setUp(self):
        scratch=ROOT/'output/dev/current/runtime';scratch.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=scratch);self.root=Path(self.temp.name)
    def tearDown(self):self.temp.cleanup()
    def test_formal_and_private_nonempty_outputs_reject_before_build(self):
        for suffix in ('output/distribution','output/dev/current/research/package-candidate'):
            out=self.root/suffix;out.mkdir(parents=True);kept=out/'kept.zip';kept.write_bytes(b'accepted-evidence')
            with patch.object(local_package,'ROOT',self.root),patch.object(local_package,'checked_output',side_effect=lambda p:Path(p)),patch.object(local_package,'build') as build:
                with self.assertRaisesRegex(ValueError,'must be empty'):local_package.main(['--output-dir',str(out)])
                build.assert_not_called();self.assertEqual(kept.read_bytes(),b'accepted-evidence')
    def test_private_candidate_validation_is_shared_by_build_and_main(self):
        out=self.root/'output/dev/current/research/package-final'
        with patch.object(local_package,'ROOT',self.root),patch.object(local_package,'checked_output',side_effect=lambda p:Path(p)):
            self.assertEqual(local_package.package_output(out),out)
            self.assertEqual(local_package.package_output(self.root/'output/distribution'),self.root/'output/distribution')
            for rejected in (self.root/'output/local-workspace',self.root/'output/dev/current/package-final',self.root/'output/dev/current/research/other'):
                with self.assertRaisesRegex(ValueError,'Invalid package output'):local_package.package_output(rejected)
    def test_arbitrary_workspace_output_is_not_a_candidate_destination(self):
        out=self.root/'output/local-workspace'
        with patch.object(local_package,'ROOT',self.root),patch.object(local_package,'checked_output',side_effect=lambda p:Path(p)),patch.object(local_package,'build') as build:
            with self.assertRaisesRegex(ValueError,'Invalid package output'):local_package.main(['--output-dir',str(out)])
            build.assert_not_called();self.assertFalse(out.exists())

if __name__=='__main__':unittest.main()
