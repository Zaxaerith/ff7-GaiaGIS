# SPDX-License-Identifier: GPL-3.0-only
import hashlib
import json
import math
from pathlib import Path
import sqlite3
import struct
import sys
import unittest
from contextlib import closing
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"src"))
from gaiagis.web_export import MAGIC,VERSION,HEADER_SIZE,VERTEX,ATTRIBUTE,cartesian

@unittest.skipUnless((ROOT/"web/public/data/gaia-mesh.bin").exists(),"Local generated assets required")
class WebExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=(ROOT/"web/public/data/gaia-mesh.bin").read_bytes()
        cls.meta=json.loads((ROOT/"web/public/data/gaia-meta.json").read_text(encoding="utf-8"))
        cls.header=struct.unpack_from("<8sHH13I",cls.data)
        cls.stage=json.loads((ROOT/"output/reconstruction/build_metadata.json").read_text(encoding="utf-8"))
    def test_header_counts_sha_and_attribute_nulls(self):
        h=self.header
        self.assertEqual(h[:3],(MAGIC,VERSION,HEADER_SIZE))
        nv,nt,vo,io,ao=h[4:9]
        self.assertEqual((vo,io,ao),(64,64+nv*12,64+nv*12+nt*12))
        self.assertEqual(h[10],len(self.data))
        self.assertEqual(nt,self.stage["source_triangles"]+sum(c["triangles"] for c in self.stage["caps"]))
        self.assertEqual(hashlib.sha256(self.data).hexdigest(),self.meta["sha256"])
        for t in range(nt):
            record=ATTRIBUTE.unpack_from(self.data,ao+t*16)
            if record[5]:self.assertEqual(record[:5],(255,255,65535,65535,65535));self.assertEqual(record[6:10],(255,65535,255,255))
    def test_all_ff7_lineage_attributes_and_float32_coordinates_match_gpkg(self):
        _,_,_,_,nv,nt,vo,io,ao,*_=self.header
        with closing(sqlite3.connect((ROOT/"output/gis/gaia_geographic.gpkg").as_uri()+"?mode=ro&immutable=1",uri=True)) as db:
            rows=db.execute("SELECT terrain_id,region_id,section_id,mesh_id,triangle_id,map_id,texture_id,script_id,is_chocobo,geographic_corners_json FROM gaia_ff7_surface WHERE part_id=0 ORDER BY section_id,mesh_id,triangle_id")
            count=0
            for t,row in enumerate(rows):
                attrs=ATTRIBUTE.unpack_from(self.data,ao+t*16)
                self.assertEqual(attrs[:5]+attrs[6:10],row[:9])
                indices=struct.unpack_from("<III",self.data,io+t*12)
                for index,original in zip(indices,json.loads(row[9])):
                    self.assertLess(index,nv)
                    rounded=VERTEX.unpack_from(self.data,vo+index*12)
                    self.assertLess(math.dist(cartesian(original,self.meta["physical_reference_radius_m"]),cartesian(rounded,self.meta["physical_reference_radius_m"])),2)
                count+=1
            self.assertEqual(count,self.stage["source_triangles"])
    def test_glb_sampled_crosscheck_with_independent_stage1_float32_cartesian(self):
        glb=(ROOT/"output/3d/gaia_sphere.glb").read_bytes()
        length=struct.unpack_from("<I",glb,12)[0];document=json.loads(glb[20:20+length]);binary=memoryview(glb)[28+length:]
        meshes={(m["primitives"][0]["extras"]["section_id"],m["primitives"][0]["extras"]["mesh_id"]):m for m in document["meshes"] if m["primitives"][0]["extras"]["geometry_origin"]=="ff7"}
        vo,io=self.header[6:8]
        with closing(sqlite3.connect((ROOT/"output/gis/gaia_geographic.gpkg").as_uri()+"?mode=ro&immutable=1",uri=True)) as db:
            rows=db.execute("SELECT section_id,mesh_id,source_vertex_indices FROM gaia_ff7_surface WHERE part_id=0 ORDER BY section_id,mesh_id,triangle_id")
            samples=0
            for t,(section,mesh,source_indices) in enumerate(rows):
                if t%127:continue
                access=document["accessors"][meshes[(section,mesh)]["primitives"][0]["attributes"]["POSITION"]]
                view=document["bufferViews"][access["bufferView"]]
                web_indices=struct.unpack_from("<III",self.data,io+t*12)
                for original,index in zip(json.loads(source_indices),web_indices):
                    actual=struct.unpack_from("<fff",binary,view["byteOffset"]+original*12)
                    x,y,z=cartesian(VERTEX.unpack_from(self.data,vo+index*12),self.meta["physical_reference_radius_m"])
                    self.assertLess(math.dist(actual,(x,z,-y)),2)
                    samples+=1
            self.assertGreater(samples,3000)

if __name__=="__main__":unittest.main(verbosity=2)
