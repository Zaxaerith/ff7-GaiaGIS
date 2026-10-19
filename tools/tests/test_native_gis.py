# SPDX-License-Identifier: GPL-3.0-only
"""Synthetic export safety and optional full read-only real Native GIS checks."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
from gaiagis.native_gis import export_native_gis, source_rows, verify_package
from gaiagis.native_analysis import analyze_world
from gaiagis.map_reader import Mesh, Vertex, Triangle, WorldMap, parse_map
from gaiagis.safety import WORKSPACE_ROOT


class NativeGISTests(unittest.TestCase):
    def world(self, path):
        v=[Vertex(0,0,0,65535),Vertex(10,0,0,1234),Vertex(0,0,10,7),Vertex(0,10,0,1)]
        n=[Vertex(0,4096,0,65534)]*4
        faces=[Triangle(0,(0,1,2),99,((0,1),(2,3),(4,5)),0xc321),Triangle(1,(0,3,2),0,((0,0),)*3,0),Triangle(2,(0,0,3),0,((0,0),)*3,0)]
        meshes=[Mesh(2,str(path),s,m,64,10,4,v if s==m==0 else [],n if s==m==0 else [],faces if s==m==0 else [],s) for s in range(12) for m in range(16)]
        return WorldMap(2,path,12,meshes,[],[])

    def test_canonical_identity_and_padding(self):
        world=self.world(Path('synthetic.map'));_,a=analyze_world(world)
        with patch('gaiagis.native_gis.digest',return_value='a'*64): rows=source_rows(world,a)
        self.assertEqual(len(rows['source_faces']),3);self.assertEqual(len(rows['xz_analysis_faces']),1)
        self.assertEqual(rows['source_vertices'][0]['vertex_padding'],65535)
        self.assertEqual(rows['source_vertices'][0]['normal_padding'],65534)
        self.assertEqual(rows['source_faces'][0]['vertex_1'],1)
        self.assertEqual(rows['source_faces'][0]['raw_ids'],0xc321)
        self.assertEqual(rows['source_meshes'][0]['compressed_data_offset'],68)

    @unittest.skipUnless(importlib.util.find_spec('osgeo'), 'Installed GDAL required')
    def test_staging_readback_no_clobber_and_failure(self):
        root=WORKSPACE_ROOT/'output/exports/native';root.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='.test-native-',dir=root) as temp:
            source=Path(temp)/'input.map';source.write_bytes(bytes(47104*12))
            target=Path(temp)/'result.gpkg';world=self.world(source)
            with patch('gaiagis.native_gis.parse_map',return_value=world):
                result=export_native_gis(source,2,target)
                self.assertEqual(result['counts']['source_faces'],3)
                self.assertEqual(result['counts']['xz_analysis_faces'],1)
                old=target.read_bytes()
                with self.assertRaises(ValueError): export_native_gis(source,2,target)
                self.assertEqual(target.read_bytes(),old)
                failed=Path(temp)/'failed.gpkg'
                with patch('gaiagis.native_gis.verify_package',side_effect=ValueError('injected readback failure')):
                    with self.assertRaises(ValueError): export_native_gis(source,2,failed)
                self.assertFalse(failed.exists());self.assertFalse(list(Path(temp).glob('.native-gis-*')))
                with patch('gaiagis.native_gis.digest',side_effect=['a'*64,'a'*64,'b'*64]):
                    with self.assertRaises(ValueError): export_native_gis(source,2,failed)
                self.assertFalse(failed.exists())
                def concurrent_writer(*args):
                    failed.write_bytes(b'concurrent user result')
                    return {}
                with patch('gaiagis.native_gis.verify_package', side_effect=concurrent_writer):
                    with self.assertRaises(ValueError): export_native_gis(source,2,failed)
                self.assertEqual(failed.read_bytes(),b'concurrent user result')


if __name__=='__main__': unittest.main()
