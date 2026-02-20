from pathlib import Path
import shutil
import sys
import unittest
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "automation"))

import idea_board as ib  # noqa: E402


class IdeaBoardTests(unittest.TestCase):
    def setUp(self):
        self.tmp_root = Path("tests") / f"_tmp_{uuid.uuid4().hex}"
        self.tmp_root.mkdir(parents=True, exist_ok=True)
        self.addCleanup(lambda: shutil.rmtree(self.tmp_root, ignore_errors=True))
        self.orig_dir = ib.IDEAS_DIR
        self.orig_path = ib.BOARD_PATH
        ib.IDEAS_DIR = self.tmp_root
        ib.BOARD_PATH = self.tmp_root / "board.json"

    def tearDown(self):
        ib.IDEAS_DIR = self.orig_dir
        ib.BOARD_PATH = self.orig_path

    def test_add_idea_and_subidea(self):
        board = ib.load_board()
        idea = ib.add_idea(board, "Content repurposing engine", "Convert podcasts to posts")
        self.assertEqual(idea["id"], 1)
        sub = ib.add_subidea(board, 1, "Draft architecture")
        self.assertEqual(sub["id"], 1)
        self.assertEqual(len(board["ideas"][0]["subideas"]), 1)

    def test_move_statuses(self):
        board = ib.load_board()
        ib.add_idea(board, "Idea A")
        ib.add_subidea(board, 1, "Sub A")
        ib.set_idea_status(board, 1, "in_progress")
        ib.set_subidea_status(board, 1, 1, "done")
        self.assertEqual(board["ideas"][0]["status"], "in_progress")
        self.assertEqual(board["ideas"][0]["subideas"][0]["status"], "done")

    def test_render_markdown_contains_subideas(self):
        board = ib.load_board()
        ib.add_idea(board, "Idea A", "Desc")
        ib.add_subidea(board, 1, "Sub A", "todo")
        md = ib.render_markdown(board)
        self.assertIn("Idea A", md)
        self.assertIn("Sub A", md)


if __name__ == "__main__":
    unittest.main()
