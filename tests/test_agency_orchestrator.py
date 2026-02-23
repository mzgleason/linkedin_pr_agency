from pathlib import Path
import os
import shutil
import sys
import unittest
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "automation"))

import agency_orchestrator as ao  # noqa: E402

from agency_orchestrator import (  # noqa: E402
    append_week_memory,
    build_weekend_nudge_body,
    classify_reply_action,
    ensure_word_limits,
    format_memory_context,
    is_approval,
    maybe_archive_and_prune_completed_weeks,
    maybe_send_today_post,
    needs_revision,
    parse_approval_targets,
    parse_draft_version,
    parse_revision_targets,
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

    def test_classify_reply_action_non_approval(self):
        config = {"feedback_trigger": "non_approval_revises"}
        self.assertEqual(classify_reply_action("Please tighten this.", config), "revise")
        self.assertEqual(classify_reply_action("Looks good, final.", config), "approve")

    def test_classify_reply_action_keyword_only(self):
        config = {"feedback_trigger": "keyword_revise_only"}
        self.assertEqual(classify_reply_action("Please revise the opener.", config), "revise")
        self.assertEqual(classify_reply_action("Thanks for sending.", config), "none")

    def test_weekly_readiness_detects_missing_drafts(self):
        root = self._make_tmp_root()
        drafts = root / "drafts"
        drafts.mkdir(parents=True, exist_ok=True)
        (drafts / "2026-02-23_long_post.md").write_text("# A\n\nBody", encoding="utf-8")
        (drafts / "2026-02-25_short_post.md").write_text("# B\n\nBody", encoding="utf-8")
        original_root = ao.ROOT
        original_drafts = ao.DRAFTS_DIR
        ao.ROOT = root
        ao.DRAFTS_DIR = drafts
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
        self.assertFalse(readiness["ready"])

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

    def test_maybe_send_today_post_respects_default_time(self):
        root = self._make_tmp_root()
        drafts = root / "drafts"
        drafts.mkdir(parents=True, exist_ok=True)
        draft_path = drafts / "2026-02-23_long_post.md"
        draft_path.write_text("# Title\n\nBody", encoding="utf-8")
        original_root = ao.ROOT
        original_drafts = ao.DRAFTS_DIR
        original_send = ao.send_email
        sent = {"count": 0}
        ao.ROOT = root
        ao.DRAFTS_DIR = drafts
        ao.send_email = lambda *args, **kwargs: sent.update({"count": sent["count"] + 1})
        try:
            state = {"sent_post_dates": [], "status": "complete"}
            config = {"default_post_time": "09:00"}
            early = ao.datetime.fromisoformat("2026-02-23T08:00:00")
            self.assertFalse(maybe_send_today_post(early, state, config))
            later = ao.datetime.fromisoformat("2026-02-23T09:01:00")
            self.assertTrue(maybe_send_today_post(later, state, config))
            self.assertEqual(sent["count"], 1)
        finally:
            ao.ROOT = original_root
            ao.DRAFTS_DIR = original_drafts
            ao.send_email = original_send

    def test_parse_revision_targets_understands_second_post(self):
        pending = [
            "drafts/2026-02-25_short_workflow_improved.md",
            "drafts/2026-02-27_short_unexpected_question.md",
        ]
        week = (
            ao.date.fromisoformat("2026-02-23"),
            ao.date.fromisoformat("2026-02-25"),
            ao.date.fromisoformat("2026-02-27"),
        )
        targets = parse_revision_targets("edit the second post, I want to see one concrete example", pending, week)
        self.assertEqual(targets, ["drafts/2026-02-25_short_workflow_improved.md"])

    def test_build_weekend_nudge_body_always_lists_three_posts(self):
        root = self._make_tmp_root()
        drafts = root / "drafts"
        drafts.mkdir(parents=True, exist_ok=True)
        (drafts / "2026-02-23_long_post.md").write_text("# A\n\nBody A", encoding="utf-8")
        (drafts / "2026-02-25_short_post.md").write_text("# B\n\nBody B", encoding="utf-8")
        original_root = ao.ROOT
        original_drafts = ao.DRAFTS_DIR
        ao.ROOT = root
        ao.DRAFTS_DIR = drafts
        try:
            week = (
                ao.date.fromisoformat("2026-02-23"),
                ao.date.fromisoformat("2026-02-25"),
                ao.date.fromisoformat("2026-02-27"),
            )
            body = build_weekend_nudge_body("2026-02-23", week)
        finally:
            ao.ROOT = original_root
            ao.DRAFTS_DIR = original_drafts
        self.assertIn("Post 1 (Mon - Long) (2026-02-23) - Drafted", body)
        self.assertIn("Post 2 (Wed - Short) (2026-02-25) - Drafted", body)
        self.assertIn("Post 3 (Fri - Short) (2026-02-27) - Not drafted", body)

    def test_maybe_send_weekend_nudge_reuses_same_week_thread(self):
        original_send = ao.send_email
        sent = {}
        try:
            def fake_send(subject, body, thread_id=None):
                sent["thread_id"] = thread_id
                return "msg-new", thread_id or "thread-existing"

            ao.send_email = fake_send
            state = ao.STATE_DEFAULTS.copy()
            state.update(
                {
                    "weekend_nudge_week_start": "2026-02-23",
                    "weekend_nudge_thread_id": "thread-existing",
                    "last_weekend_nudge_date": "",
                }
            )
            readiness = {"ready": False}
            now = ao.datetime.fromisoformat("2026-02-22T12:00:00")
            changed = ao.maybe_send_weekend_nudge(now, state, "2026-02-23", readiness)
        finally:
            ao.send_email = original_send
        self.assertTrue(changed)
        self.assertEqual(sent["thread_id"], "thread-existing")
        self.assertEqual(state["weekend_nudge_thread_id"], "thread-existing")

    def test_maybe_send_weekend_nudge_starts_new_thread_for_new_week(self):
        original_send = ao.send_email
        sent = {}
        try:
            def fake_send(subject, body, thread_id=None):
                sent["thread_id"] = thread_id
                return "msg-new", "thread-new-week"

            ao.send_email = fake_send
            state = ao.STATE_DEFAULTS.copy()
            state.update(
                {
                    "weekend_nudge_week_start": "2026-02-16",
                    "weekend_nudge_thread_id": "thread-old-week",
                    "last_weekend_nudge_date": "",
                }
            )
            readiness = {"ready": False}
            now = ao.datetime.fromisoformat("2026-02-22T12:00:00")
            changed = ao.maybe_send_weekend_nudge(now, state, "2026-02-23", readiness)
        finally:
            ao.send_email = original_send
        self.assertTrue(changed)
        self.assertIsNone(sent["thread_id"])
        self.assertEqual(state["weekend_nudge_thread_id"], "thread-new-week")
        self.assertEqual(state["weekend_nudge_week_start"], "2026-02-23")

    def test_maybe_send_weekend_nudge_allows_repeat_same_day(self):
        original_send = ao.send_email
        calls = []
        try:
            def fake_send(subject, body, thread_id=None):
                calls.append(thread_id)
                return f"msg-{len(calls)}", "thread-existing"

            ao.send_email = fake_send
            state = ao.STATE_DEFAULTS.copy()
            state.update(
                {
                    "weekend_nudge_week_start": "2026-02-23",
                    "weekend_nudge_thread_id": "thread-existing",
                    "last_weekend_nudge_date": "2026-02-22",
                }
            )
            readiness = {"ready": False}
            now = ao.datetime.fromisoformat("2026-02-22T12:00:00")
            first = ao.maybe_send_weekend_nudge(now, state, "2026-02-23", readiness)
            second = ao.maybe_send_weekend_nudge(now, state, "2026-02-23", readiness)
        finally:
            ao.send_email = original_send
        self.assertTrue(first)
        self.assertTrue(second)
        self.assertEqual(calls, ["thread-existing", "thread-existing"])

    def test_append_week_memory_and_format_context(self):
        root = self._make_tmp_root()
        drafts = root / "drafts"
        drafts.mkdir(parents=True, exist_ok=True)
        (drafts / "2026-02-23_storyboard.md").write_text(
            "# Storyboard - Week of 2026-02-23\n\nTheme: Practical automation lessons\n",
            encoding="utf-8",
        )
        (drafts / "2026-02-23_long_post.md").write_text(
            "# Building trust in automation\n\nWe built a safer review loop. We learned to keep approvals explicit.",
            encoding="utf-8",
        )
        (drafts / "2026-02-25_short_post.md").write_text(
            "# Shipping cadence\n\nWe shipped a daily cadence change and discovered email timing matters.",
            encoding="utf-8",
        )
        (drafts / "2026-02-27_short_post.md").write_text(
            "# What changed this week\n\nKey lesson learned: keep one thread per week.",
            encoding="utf-8",
        )

        original_root = ao.ROOT
        original_drafts = ao.DRAFTS_DIR
        original_memory = ao.WEEKLY_MEMORY_PATH
        ao.ROOT = root
        ao.DRAFTS_DIR = drafts
        ao.WEEKLY_MEMORY_PATH = root / "automation" / "weekly_memory.json"
        ao.WEEKLY_MEMORY_PATH.parent.mkdir(parents=True, exist_ok=True)
        try:
            append_week_memory("2026-02-23")
            context = format_memory_context()
        finally:
            ao.ROOT = original_root
            ao.DRAFTS_DIR = original_drafts
            ao.WEEKLY_MEMORY_PATH = original_memory

        self.assertIn("Week 2026-02-23", context)
        self.assertIn("topic", context)
        self.assertIn("project", context)
        self.assertIn("learning", context)

    def test_archive_and_prune_completed_week(self):
        root = self._make_tmp_root()
        drafts = root / "drafts"
        drafts.mkdir(parents=True, exist_ok=True)
        p1 = drafts / "2026-02-23_long_post.md"
        p2 = drafts / "2026-02-25_short_post.md"
        p3 = drafts / "2026-02-27_short_post.md"
        sb = drafts / "2026-02-23_storyboard.md"
        for path in (p1, p2, p3, sb):
            path.write_text("# T\n\nBody", encoding="utf-8")

        original_root = ao.ROOT
        original_drafts = ao.DRAFTS_DIR
        original_memory = ao.WEEKLY_MEMORY_PATH
        ao.ROOT = root
        ao.DRAFTS_DIR = drafts
        ao.WEEKLY_MEMORY_PATH = root / "automation" / "weekly_memory.json"
        ao.WEEKLY_MEMORY_PATH.parent.mkdir(parents=True, exist_ok=True)
        state = ao.STATE_DEFAULTS.copy()
        state["sent_post_dates"] = ["2026-02-23", "2026-02-25", "2026-02-27"]
        try:
            changed = maybe_archive_and_prune_completed_weeks(state)
        finally:
            ao.ROOT = original_root
            ao.DRAFTS_DIR = original_drafts
            ao.WEEKLY_MEMORY_PATH = original_memory

        self.assertTrue(changed)
        self.assertIn("2026-02-23", state["archived_weeks"])
        self.assertFalse(p1.exists())
        self.assertFalse(p2.exists())
        self.assertFalse(p3.exists())
        self.assertFalse(sb.exists())


if __name__ == "__main__":
    unittest.main()
