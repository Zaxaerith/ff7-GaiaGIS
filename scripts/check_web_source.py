# SPDX-License-Identifier: GPL-3.0-only
"""Stage 2 end-of-task fingerprint; separate from Stage 0/1 snapshots."""
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"src"))
from gaiagis.dataset import discover,fingerprint
from gaiagis.safety import SOURCE_ROOT
from gaiagis.cli import write_json
from gaiagis.web_export import sha256
before=json.loads((ROOT/"output/web/source_before.json").read_text(encoding="utf-8"))
after=fingerprint(discover(SOURCE_ROOT))
old={r["filename"]:r for r in before["files"]}
comparison=[dict(filename=r["filename"],before_size=old[r["filename"]]["size"],after_size=r["size"],
                 before_sha256=old[r["filename"]]["sha256"],after_sha256=r["sha256"],
                 unchanged=(old[r["filename"]]["size"],old[r["filename"]]["sha256"])==(r["size"],r["sha256"])) for r in after["files"]]
meta=json.loads((ROOT/"web/public/data/gaia-meta.json").read_text(encoding="utf-8"))
stage1_preserved=meta["stage1"]["build_metadata_sha256"]==sha256(ROOT/"output/reconstruction/build_metadata.json") and meta["stage1"]["geographic_gpkg_sha256"]==sha256(ROOT/"output/gis/gaia_geographic.gpkg")
unchanged=len(old)==len(comparison) and all(r["unchanged"] for r in comparison)
write_json(ROOT/"output/web/source_final.json",dict(before=before,after=after,comparison=comparison,
    ff7_source_modified="NO" if unchanged else "SOURCE CHANGE DETECTED",stage1_geographic_and_build_metadata_preserved=stage1_preserved,
    proprietary_ff7_files_in_web_distribution=False,public_derived_data_upload=False,pages_deployment=False))
print(f"FF7 source modified: {'NO' if unchanged else 'SOURCE CHANGE DETECTED'}; {len(comparison)} fingerprints compared; Stage 1 preserved: {stage1_preserved}")
raise SystemExit(0 if unchanged and stage1_preserved else 1)
