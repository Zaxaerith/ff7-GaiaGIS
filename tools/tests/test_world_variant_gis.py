# SPDX-License-Identifier: GPL-3.0-only
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from gaiagis.map_reader import WorldMap, Mesh, Vertex, Triangle
from gaiagis.safety import WORKSPACE_ROOT
from gaiagis.world_variants import SECTIONS, PLACEMENTS
from gaiagis.world_variant_gis import export_gis, rows_for_world, verify_package


def synthetic_world(source):
    vertices=[Vertex(0,0,0,65535),Vertex(10,0,0,1234),Vertex(0,0,10,7),Vertex(0,10,0,1)]
    normals=[Vertex(0,4096,0,65534)]*4
    triangles=[Triangle(0,(0,1,2),99,((0,1),(2,3),(4,5)),0xc321),Triangle(1,(0,3,1),0,((0,0),)*3,0)]
    meshes=[Mesh(0,str(source),s,m,64+m*16,10,4+12*2+16*4,vertices,normals,triangles,PLACEMENTS.get(s,s)) for s in SECTIONS for m in range(16)]
    return WorldMap(0,source,69,meshes,[],[])


class WorldVariantGISTests(unittest.TestCase):
    def test_tables_preserve_raw_indices_normals_and_padding(self):
        with patch('gaiagis.world_variant_gis.source_hash',return_value='a'*64):
            rows=rows_for_world(synthetic_world(Path('synthetic.map')))
        self.assertEqual(len(rows['source_faces']),384)
        self.assertEqual(len(rows['variant_geometry']),192)
        self.assertEqual(rows['source_vertices'][0]['padding'],65535)
        self.assertEqual(rows['source_normals'][0]['padding'],65534)
        self.assertEqual(rows['source_faces'][0]['raw_ids'],0xc321)
        self.assertEqual(rows['source_meshes'][0]['compressed_data_offset'],rows['source_meshes'][0]['compressed_header_offset']+4)
        self.assertTrue(all('base_placement' in row for row in rows['source_faces']))

    @unittest.skipUnless(importlib.util.find_spec('osgeo'), 'Installed GDAL required')
    def test_staged_readback_no_clobber_concurrent_and_source_change(self):
        root=WORKSPACE_ROOT/'output/exports/world-variants';root.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='.test-world-variants-',dir=root) as tmp:
            source=Path(tmp)/'input.map';source.write_bytes(b'synthetic read-only source')
            target=Path(tmp)/'result.gpkg';world=synthetic_world(source)
            with patch('gaiagis.world_variant_gis.load_source',return_value=(world,{})):
                result=export_gis(source,target);old=target.read_bytes()
                self.assertEqual(result['counts']['source_faces'],384)
                self.assertEqual(result['counts']['variant_geometry'],192)
                with self.assertRaises(ValueError):export_gis(source,target)
                self.assertEqual(target.read_bytes(),old)
                failed=Path(tmp)/'failed.gpkg'
                with patch('gaiagis.world_variant_gis.verify_package',side_effect=ValueError('injected readback')):
                    with self.assertRaises(ValueError):export_gis(source,failed)
                self.assertFalse(failed.exists())
                self.assertFalse(list(Path(tmp).glob('.world-variant-*')))
                def concurrent(*args):failed.write_bytes(b'concurrent user result');return {}
                with patch('gaiagis.world_variant_gis.verify_package',side_effect=concurrent):
                    with self.assertRaises(ValueError):export_gis(source,failed)
                self.assertEqual(failed.read_bytes(),b'concurrent user result')
                changed=Path(tmp)/'source-changed.gpkg'
                def modify_synthetic(path,rows):
                    checked=verify_package(path,rows);source.write_bytes(b'changed synthetic input');return checked
                with patch('gaiagis.world_variant_gis.verify_package',side_effect=modify_synthetic):
                    with self.assertRaisesRegex(ValueError,'MAP changed'):export_gis(source,changed)
                self.assertFalse(changed.exists())


if __name__=='__main__':unittest.main()
