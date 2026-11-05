"""Fail-closed tests for the GitHub -> Cloudflare manual production release path.

These are source-policy checks: they cannot verify the external Cloudflare
Workers Builds Deploy command or GitHub production-environment protection.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/promote-production.yml"


class ManualPromotionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = WORKFLOW.read_text(encoding="utf-8")

    def test_no_push_or_successful_ci_can_automatically_promote(self):
        triggers = self.text.split("\non:\n", 1)[1].split("\npermissions:", 1)[0]
        events = re.findall(r"^  ([a-z_]+):", triggers, re.MULTILINE)
        self.assertEqual(events, ["workflow_dispatch"])
        self.assertNotIn("workflow_run", self.text)
        self.assertNotRegex(self.text, r"(?m)^  push:")
        self.assertIn("environment: production", self.text)

    def test_manual_inputs_require_approval_and_no_stale_default(self):
        triggers = self.text.split("\non:\n", 1)[1].split("\npermissions:", 1)[0]
        source = triggers.split("      source_sha:", 1)[1].split("      worker_version_id:", 1)[0]
        self.assertIn("required: true", source)
        self.assertNotIn("default:", source)
        confirmation = triggers.split("      confirm_production:", 1)[1]
        self.assertIn("required: true", confirmation)
        self.assertIn("default: false", confirmation)
        self.assertIn("CONFIRM_PRODUCTION: ${{ inputs.confirm_production }}", self.text)
        self.assertNotIn("CONFIRM_PRODUCTION: 'true'", self.text)

    def test_only_current_main_source_sha_is_eligible(self):
        self.assertIn("if: github.ref == 'refs/heads/main' && github.event_name == 'workflow_dispatch'", self.text)
        self.assertEqual(self.text.count("SOURCE_SHA: ${{ inputs.source_sha }}"), 2)
        self.assertIn('if [[ "$SOURCE_SHA" != "$(git rev-parse HEAD)" ]]; then', self.text)
        # A dispatch may outlive a newer protected-main commit. Verify the
        # *remote* head in both eligibility and immediately before deployment.
        self.assertEqual(self.text.count("git ls-remote --exit-code origin refs/heads/main"), 2)
        self.assertEqual(self.text.count('if [[ "$SOURCE_SHA" != "$remote_main_sha" ]]; then'), 2)
        self.assertIn("node scripts/promotion_gate.mjs", self.text)
        self.assertIn('wrangler@4 versions deploy "${WORKER_VERSION_ID}@100%"', self.text)

    def test_readonly_predeployment_status_is_recorded_for_rollback(self):
        before = self.text.index("wrangler@4 deployments status")
        after = self.text.index("wrangler@4 versions deploy")
        self.assertLess(before, after)
        self.assertIn("previous active", self.text.lower())


if __name__ == "__main__":
    unittest.main()
