"""Regression coverage for ORIGINAL medical source-photo packages (stdlib only)."""
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
import importlib.util
import json
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("source_pack_under_test", ROOT / "tools" / "check_original_figure_pack.py")
source_pack = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source_pack)


class OriginalSourcePhotoTests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder = Path(self.tmp.name)
        self.photo = b"\xff\xd8\xff" + b"\x44" * 512  # Nonclinical fixture only; NEVER published as an image.
        self.lecture = {
            "id": "reviewed-fixture",
            "imageQuestions": [{
                "id": "source-image-one", "page": "Lecture PDF p. 4",
                "imageSha256": sha256(self.photo).hexdigest(),
            }],
        }

    def package(self, jpeg=None, filename="source-image-one.jpg", page=4, manifest_hash=None):
        archive = self.folder / "source-private.zip"
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as handle:
            if filename:
                handle.writestr("original-figures/" + filename, self.photo if jpeg is None else jpeg)
            handle.writestr("original-figures/manifest.json", json.dumps({
                "lectureId": self.lecture["id"],
                "items": [{
                    "id": "source-image-one", "sourcePage": page,
                    "sha256": manifest_hash or self.lecture["imageQuestions"][0]["imageSha256"],
                }],
            }))
        return archive

    def test_matching_private_pack_is_valid(self):
        self.assertEqual(source_pack.audit_zip(self.lecture, self.package()), (1, len(self.photo)))

    def test_refuses_modified_or_renamed_source_content(self):
        with self.assertRaisesRegex(ValueError, "differs from the reviewed"):
            source_pack.audit_zip(self.lecture, self.package(jpeg=b"\xff\xd8\xff" + b"\x55" * 512))
        with self.assertRaisesRegex(ValueError, "unexpected file/path"):
            source_pack.audit_zip(self.lecture, self.package(filename="../source-image-one.jpg"))

    def test_refuses_missing_image_and_incorrect_manifest(self):
        with self.assertRaisesRegex(ValueError, "ZIP missing"):
            source_pack.audit_zip(self.lecture, self.package(filename=None))
        with self.assertRaisesRegex(ValueError, "printed PDF page mismatches"):
            source_pack.audit_zip(self.lecture, self.package(page=5))
        with self.assertRaisesRegex(ValueError, "manifest fingerprint mismatches"):
            source_pack.audit_zip(self.lecture, self.package(manifest_hash="f" * 64))

    def test_refuses_invalid_lecture_hash_before_image_read(self):
        modified = json.loads(json.dumps(self.lecture))
        modified["imageQuestions"][0]["imageSha256"] = "fake-hash"
        with self.assertRaisesRegex(ValueError, "invalid source-image SHA-256"):
            source_pack.audit_zip(modified, self.package())


if __name__ == "__main__":
    unittest.main()
