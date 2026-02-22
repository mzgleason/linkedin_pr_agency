from pathlib import Path
import os
import shutil
import sys
import unittest
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "automation"))

import agency_orchestrator as ao  # noqa: E402

from agency_orchestrator import (  # noqa: E402
    append_approval_log,
    ensure_word_limits,
    is_approval,
    load_approved_draft_files,
    needs_revision,
    parse_approval_targets,
    parse_draft_version,
    parse_json_block,
    slugify,
    weekly_readiness,
    word_count,
)


class AgencyOrchestratorTests(unittest.TestCase):
    def _make_tmp_root(self):
        path = Path("tests") / f"_tmp_{uuid.uuid4().hex}"
        path.mkdir(parents=True, exist_ok=True)
        self.addCleanup(lambda: shutil.rmtree(path, ignore_errors=True))
        return path

    def test_slugify_normalizes_text(self):
        self.assertEqual(slugify("Hello, LinkedIn World!"), "hello_linkedin_world")

    def test_parse_json_block_extracts_payload(self):
        raw = (
            "ignore\n"
            "{\"post1\":{\"title\":\"A\",\"body\":\"B\"},"
            "\"post2\":{\"title\":\"C\",\"body\":\"D\"},"
            "\"post3\":{\"title\":\"E\",\"body\":\"F\"}}\n"
            "ignore"
        )
        parsed = parse_json_block(raw)
        self.assertEqual(parsed["post1"]["title"], "A")

    def test_word_count_counts_words(self):
        self.assertEqual(word_count("One two three"), 3)

    def test_ensure_word_limits_raises_on_long_post(self):
        posts = {
            "post1": {"title": "Long", "body": "word " * 6},
            "post2": {"title": "Short", "body": "word " * 2},
            "post3": {"title": "Short", "body": "word " * 2},
        }
        with self.assertRaises(ValueError):
            ensure_word_limits(posts, max_long=5, max_short=3)

    def test_feedback_helpers(self):
        self.assertTrue(needs_revision("Please revise this opening."))
        self.assertTrue(is_approval("Looks good, final."))

    def test_load_approved_draft_files_parses_markdown_table(self):
        root = self._make_tmp_root()
        log_path = root / "approval_log.md"
        log_path.write_text(
            "| Date | Post | Status |\n"
            "|---|---|---|\n"
            "| 2026-02-20 | `drafts/2026-02-23_long_x.md` | Approved |\n",
            encoding="utf-8",
        )
        original = ao.APPROVAL_LOG_PATH
        ao.APPROVAL_LOG_PATH = log_path
        try:
            approved = load_approved_draft_files()
        finally:
            ao.APPROVAL_LOG_PATH = original
        self.assertIn("drafts/2026-02-23_long_x.md", approved)

    def test_weekly_readiness_detects_missing_approvals(self):
        root = self._make_tmp_root()
        drafts = root / "drafts"
        drafts.mkdir(parents=True, exist_ok=True)
        (drafts / "2026-02-23_long_post.md").write_text("# A\n\nBody", encoding="utf-8")
        (drafts / "2026-02-25_short_post.md").write_text("# B\n\nBody", encoding="utf-8")
        (drafts / "2026-02-27_short_post.md").write_text("# C\n\nBody", encoding="utf-8")
        (root / "approval_log.md").write_text(
            "| Date | Post | Status |\n"
            "|---|---|---|\n"
            "| 2026-02-20 | `drafts/2026-02-23_long_post.md` | Approved |\n",
            encoding="utf-8",
        )
        original_root = ao.ROOT
        original_drafts = ao.DRAFTS_DIR
        original_log = ao.APPROVAL_LOG_PATH
        ao.ROOT = root
        ao.DRAFTS_DIR = drafts
        ao.APPROVAL_LOG_PATH = root / "approval_log.md"
        try:
            readiness = weekly_readiness(
                (
                    ao.date.fromisoformat("2026-02-23"),
                    ao.date.fromisoformat("2026-02-25"),
                    ao.date.fromisoformat("2026-02-27"),
                )
            )
        finally:
            ao.ROOT = original_root
            ao.DRAFTS_DIR = original_drafts
            ao.APPROVAL_LOG_PATH = original_log
        self.assertFalse(readiness["ready"])
        self.assertEqual(len(readiness["missing_approvals"]), 2)

    def test_parse_approval_targets(self):
        pending = [
            "drafts/2026-02-25_short_workflow_improved.md",
            "drafts/2026-02-27_short_unexpected_question.md",
        ]
        approved = parse_approval_targets("APPROVE 2026-02-25", pending)
        self.assertEqual(approved, ["drafts/2026-02-25_short_workflow_improved.md"])
        approved_all = parse_approval_targets("approve all", pending)
        self.assertEqual(sorted(approved_all), sorted(pending))

    def test_parse_approval_targets_accepts_plain_approval(self):
        pending = [
            "drafts/2026-02-25_short_workflow_improved.md",
            "drafts/2026-02-27_short_unexpected_question.md",
        ]
        approved = parse_approval_targets("Looks good, final. Please proceed.", pending)
        self.assertEqual(sorted(approved), sorted(pending))

    def test_parse_approval_targets_does_not_override_revision(self):
        pending = [
            "drafts/2026-02-25_short_workflow_improved.md",
            "drafts/2026-02-27_short_unexpected_question.md",
        ]
        approved = parse_approval_targets("Looks good overall, but revise post 2 intro.", pending)
        self.assertEqual(approved, [])

    def test_append_approval_log_skips_existing_rows(self):
        root = self._make_tmp_root()
        log_path = root / "approval_log.md"
        log_path.write_text(
            "# Approval Log\n\n| Date | Post | Status | Notes |\n|---|---|---|---|\n"
            "| 2026-02-20 | `drafts/2026-02-23_long_x.md` | Approved | Existing |\n",
            encoding="utf-8",
        )
        original = ao.APPROVAL_LOG_PATH
        ao.APPROVAL_LOG_PATH = log_path
        try:
            append_approval_log(["drafts/2026-02-23_long_x.md"], "Duplicate")
            text = log_path.read_text(encoding="utf-8")
        finally:
            ao.APPROVAL_LOG_PATH = original
        self.assertEqual(text.count("drafts/2026-02-23_long_x.md"), 1)

    def test_parse_draft_version(self):
        self.assertEqual(parse_draft_version("Draft v3 - LinkedIn Series (Week of 2026-02-23)"), 3)
        self.assertEqual(parse_draft_version("no version"), 0)

    def test_maybe_recover_pipeline_state_from_draft_thread(self):
        state = ao.STATE_DEFAULTS.copy()
        state["status"] = "idle"
        config = {"require_feedback_rounds": 1}
        original_find = ao.find_latest_message_for_subject
        original_latest = ao.latest_message_id_in_thread
        original_files = ao.find_week_draft_files
        original_user = os.environ.get("GMAIL_USER")
        os.environ["GMAIL_USER"] = "agency@example.com"

        def fake_find(subject):
            if subject == "Draft v":
                return {
                    "message_id": "m1",
                    "thread_id": "t1",
                    "subject": "Draft v2 - LinkedIn Series (Week of 2026-02-23)",
                }
            return None

        try:
            ao.find_latest_message_for_subject = fake_find
            ao.latest_message_id_in_thread = lambda thread_id, expected_sender=None: "sent-by-agency"
            ao.find_week_draft_files = lambda week_start: ["drafts/2026-02-23_long_demo.md"]
            changed = ao.maybe_recover_pipeline_state(state, "2026-02-23", config)
        finally:
            ao.find_latest_message_for_subject = original_find
            ao.latest_message_id_in_thread = original_latest
            ao.find_week_draft_files = original_files
            if original_user is None:
                os.environ.pop("GMAIL_USER", None)
            else:
                os.environ["GMAIL_USER"] = original_user

        self.assertTrue(changed)
        self.assertEqual(state["status"], "final_sent")
        self.assertEqual(state["draft_thread_id"], "t1")
        self.assertEqual(state["last_feedback_message_id"], "sent-by-agency")
        self.assertEqual(state["revision_count"], 1)


if __name__ == "__main__":
    unittest.main()
