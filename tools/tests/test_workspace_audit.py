import tempfile
import unittest
from pathlib import Path

from tools.workspace_audit import audit_workspace


class WorkspaceAuditTests(unittest.TestCase):
    def test_inventory_is_read_only_and_reports_versioned_script_duplicates(self):
        with tempfile.TemporaryDirectory(
            dir=Path(__file__).resolve().parents[2]
        ) as temporary:
            root = Path(temporary)
            first = root / "output/dev/current/v43/review.py"
            second = root / "output/dev/current/v44/review.py"
            third = root / "output/dev/current/v44/related.py"
            first.parent.mkdir(parents=True)
            second.parent.mkdir(parents=True)
            first.write_text(
                "def check():\n    prepare()\n    validate()\n    finish()\n    return True\n",
                encoding="utf-8",
            )
            second.write_text(first.read_text(encoding="utf-8"), encoding="utf-8")
            third.write_text(
                "def check():\n    prepare()\n    validate()\n    finish()\n    return False\n",
                encoding="utf-8",
            )
            (root / "output/dev/current/v44/large.bin").write_bytes(b"12345")

            report = audit_workspace(
                root,
                scopes=("output/dev",),
                large_file_mib=0.000001,
            )

            self.assertTrue(report["no_mutations_performed"])
            self.assertEqual(report["scope_totals"]["files"], 4)
            self.assertEqual(
                report["versioned_script_review"]["historical_version_dirs"],
                ["output/dev/current/v43", "output/dev/current/v44"],
            )
            self.assertEqual(
                len(report["versioned_script_review"]["exact_duplicate_scripts"]),
                1,
            )
            self.assertEqual(
                len(report["versioned_script_review"]["similar_script_pairs"]),
                1,
            )
            self.assertEqual(len(report["large_files_review_required"]), 4)
            self.assertTrue(first.is_file())
            self.assertTrue(second.is_file())

    def test_missing_roots_are_reported_without_creation(self):
        with tempfile.TemporaryDirectory(
            dir=Path(__file__).resolve().parents[2]
        ) as temporary:
            root = Path(temporary)
            report = audit_workspace(root, scopes=("output/dev",))

            self.assertFalse(report["scopes"][0]["exists"])
            self.assertEqual(report["scope_totals"]["files"], 0)
            self.assertFalse((root / "output").exists())

    def test_scope_cannot_escape_selected_root(self):
        with tempfile.TemporaryDirectory(
            dir=Path(__file__).resolve().parents[2]
        ) as temporary:
            with self.assertRaisesRegex(ValueError, "escapes repository root"):
                audit_workspace(Path(temporary), scopes=("../outside",))


if __name__ == "__main__":
    unittest.main()
