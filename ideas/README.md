# Idea Board

Monday-style local board for ideas and subideas.

## Quick Start

From repo root:

```powershell
python automation/idea_board.py init
python automation/idea_board.py add-idea --title "AI webinar series" --description "Weekly founder-led session"
python automation/idea_board.py add-subidea --idea-id 1 --title "Pick topic list"
python automation/idea_board.py move-idea --idea-id 1 --status in_progress
python automation/idea_board.py list
```

## Commands

- `init`
- `add-idea --title <text> [--description <text>] [--status backlog|researching|in_progress|blocked|done] [--priority low|medium|high]`
- `add-subidea --idea-id <n> --title <text> [--status todo|in_progress|blocked|done]`
- `move-idea --idea-id <n> --status <status>`
- `move-subidea --idea-id <n> --subidea-id <n> --status <status>`
- `list [--status <status>]`
- `export-md [--out ideas/board.md] [--status <status>]`

Data file:
- `ideas/board.json`
