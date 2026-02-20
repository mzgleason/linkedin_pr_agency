import unittest

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "automation"))

from preflight_credentials import parse_expiry  # noqa: E402


class PreflightCredentialsTests(unittest.TestCase):
    def test_parse_expiry_handles_zulu(self):
        dt = parse_expiry("2026-02-20T12:00:00Z")
        self.assertIsNotNone(dt)
        self.assertEqual(dt.year, 2026)

    def test_parse_expiry_returns_none_for_invalid(self):
        self.assertIsNone(parse_expiry("not-a-date"))


if __name__ == "__main__":
    unittest.main()
