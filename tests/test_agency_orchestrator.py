from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "automation"))

from agency_orchestrator import (  # noqa: E402
    ensure_word_limits,
    is_approval,
    needs_revision,
    parse_json_block,
    slugify,
    word_count,
)


class AgencyOrchestratorTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
