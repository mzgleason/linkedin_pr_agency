import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
IDEAS_DIR = ROOT / "ideas"
BOARD_PATH = IDEAS_DIR / "board.json"

IDEA_STATUSES = ["backlog", "researching", "in_progress", "blocked", "done"]
SUBIDEA_STATUSES = ["todo", "in_progress", "blocked", "done"]


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def default_board():
    return {
        "version": 1,
        "created_at": utc_now(),
        "updated_at": utc_now(),
        "ideas": [],
    }


def ensure_dirs():
    IDEAS_DIR.mkdir(parents=True, exist_ok=True)


def load_board():
    ensure_dirs()
    if not BOARD_PATH.exists():
        board = default_board()
        save_board(board)
        return board
    return json.loads(BOARD_PATH.read_text(encoding="utf-8"))


def save_board(board):
    board["updated_at"] = utc_now()
    BOARD_PATH.write_text(json.dumps(board, indent=2), encoding="utf-8")


def next_id(items):
    if not items:
        return 1
    return max(item["id"] for item in items) + 1


def validate_status(status, allowed):
    if status not in allowed:
        allowed_text = ", ".join(allowed)
        raise ValueError(f"Invalid status '{status}'. Allowed: {allowed_text}")


def add_idea(board, title, description="", status="backlog", priority="medium"):
    validate_status(status, IDEA_STATUSES)
    idea = {
        "id": next_id(board["ideas"]),
        "title": title.strip(),
        "description": description.strip(),
        "status": status,
        "priority": priority.strip().lower(),
        "created_at": utc_now(),
        "updated_at": utc_now(),
        "subideas": [],
    }
    board["ideas"].append(idea)
    return idea


def find_idea(board, idea_id):
    for idea in board["ideas"]:
        if idea["id"] == idea_id:
            return idea
    raise ValueError(f"Idea id {idea_id} not found")


def add_subidea(board, idea_id, title, status="todo"):
    validate_status(status, SUBIDEA_STATUSES)
    idea = find_idea(board, idea_id)
    sub = {
        "id": next_id(idea["subideas"]),
        "title": title.strip(),
        "status": status,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    idea["subideas"].append(sub)
    idea["updated_at"] = utc_now()
    return sub


def set_idea_status(board, idea_id, status):
    validate_status(status, IDEA_STATUSES)
    idea = find_idea(board, idea_id)
    idea["status"] = status
    idea["updated_at"] = utc_now()


def set_subidea_status(board, idea_id, subidea_id, status):
    validate_status(status, SUBIDEA_STATUSES)
    idea = find_idea(board, idea_id)
    for sub in idea["subideas"]:
        if sub["id"] == subidea_id:
            sub["status"] = status
            sub["updated_at"] = utc_now()
            idea["updated_at"] = utc_now()
            return
    raise ValueError(f"Subidea id {subidea_id} not found in idea {idea_id}")


def render_markdown(board, status_filter=""):
    lines = ["# Idea Board", ""]
    ideas = board["ideas"]
    if status_filter:
        ideas = [i for i in ideas if i["status"] == status_filter]
    if not ideas:
        lines.append("_No ideas yet._")
        return "\n".join(lines) + "\n"

    for idea in sorted(ideas, key=lambda x: x["id"]):
        lines.append(f"## [{idea['id']}] {idea['title']}")
        lines.append(f"- Status: `{idea['status']}`")
        lines.append(f"- Priority: `{idea['priority']}`")
        if idea["description"]:
            lines.append(f"- Description: {idea['description']}")
        if idea["subideas"]:
            lines.append("- Subideas:")
            for sub in sorted(idea["subideas"], key=lambda x: x["id"]):
                lines.append(f"  - [{sub['id']}] {sub['title']} (`{sub['status']}`)")
        else:
            lines.append("- Subideas: _none_")
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def cmd_init(_args):
    board = load_board()
    save_board(board)
    print(f"initialized: {BOARD_PATH}")


def cmd_add_idea(args):
    board = load_board()
    idea = add_idea(board, args.title, args.description, args.status, args.priority)
    save_board(board)
    print(json.dumps(idea, indent=2))


def cmd_add_subidea(args):
    board = load_board()
    sub = add_subidea(board, args.idea_id, args.title, args.status)
    save_board(board)
    print(json.dumps(sub, indent=2))


def cmd_list(args):
    board = load_board()
    print(render_markdown(board, args.status))


def cmd_move_idea(args):
    board = load_board()
    set_idea_status(board, args.idea_id, args.status)
    save_board(board)
    print(f"idea {args.idea_id} -> {args.status}")


def cmd_move_subidea(args):
    board = load_board()
    set_subidea_status(board, args.idea_id, args.subidea_id, args.status)
    save_board(board)
    print(f"idea {args.idea_id} subidea {args.subidea_id} -> {args.status}")


def cmd_export(args):
    board = load_board()
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_markdown(board, args.status), encoding="utf-8")
    print(f"exported: {out}")


def build_parser():
    parser = argparse.ArgumentParser(description="Monday-style idea board with subideas.")
    sub = parser.add_subparsers(dest="command", required=True)

    init = sub.add_parser("init")
    init.set_defaults(func=cmd_init)

    add_idea_p = sub.add_parser("add-idea")
    add_idea_p.add_argument("--title", required=True)
    add_idea_p.add_argument("--description", default="")
    add_idea_p.add_argument("--status", default="backlog")
    add_idea_p.add_argument("--priority", default="medium")
    add_idea_p.set_defaults(func=cmd_add_idea)

    add_sub_p = sub.add_parser("add-subidea")
    add_sub_p.add_argument("--idea-id", type=int, required=True)
    add_sub_p.add_argument("--title", required=True)
    add_sub_p.add_argument("--status", default="todo")
    add_sub_p.set_defaults(func=cmd_add_subidea)

    list_p = sub.add_parser("list")
    list_p.add_argument("--status", default="")
    list_p.set_defaults(func=cmd_list)

    move_idea_p = sub.add_parser("move-idea")
    move_idea_p.add_argument("--idea-id", type=int, required=True)
    move_idea_p.add_argument("--status", required=True)
    move_idea_p.set_defaults(func=cmd_move_idea)

    move_sub_p = sub.add_parser("move-subidea")
    move_sub_p.add_argument("--idea-id", type=int, required=True)
    move_sub_p.add_argument("--subidea-id", type=int, required=True)
    move_sub_p.add_argument("--status", required=True)
    move_sub_p.set_defaults(func=cmd_move_subidea)

    export_p = sub.add_parser("export-md")
    export_p.add_argument("--out", default=str(ROOT / "ideas" / "board.md"))
    export_p.add_argument("--status", default="")
    export_p.set_defaults(func=cmd_export)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    try:
        args.func(args)
    except ValueError as err:
        raise SystemExit(str(err))


if __name__ == "__main__":
    main()
