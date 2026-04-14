# LinkedIn PR Agency (Local)

This folder contains the local artifacts to run your LinkedIn PR workflow:

- `truth_file.md`: Approved facts and proof points.
- `content_calendar.md`: Month plan with exact dates.
- `intake_answers.md`: Latest interview responses.
- `drafts/`: Post drafts by week.
- `automation/weekly_memory.json`: One compact entry per week (topic/project/learning).
- `checklist.md`: QA + approval gates.
- `gitlab_setup.md`: Always-on GitLab CI setup guide.

Workflow:
1. Update `truth_file.md` with any new approved facts.
2. Run the Friday interview (responses saved to `intake_answers.md`).
3. Draft next week's three-part series in `drafts/`.
4. Review against `checklist.md`.
5. Publish only after explicit approval.
6. After reminders are sent, drafts are cleaned up and a weekly memory entry is kept.

Local validation:
- Run the full mocked flow: `python automation/stage_runner.py all --use-mocks`
- Run a single stage: `python automation/stage_runner.py interview --use-mocks`
- Generate topic pitches: `python automation/stage_runner.py topics --use-mocks`

GitLab:
1. Follow `gitlab_setup.md` to initialize this folder as its own repository.
2. Push to GitLab and add CI variables.
3. Use scheduled pipelines to run orchestration and auto-commit approved draft updates.

## Database (Postgres + Prisma)

Start Postgres (docker):

```bash
docker compose up -d
```

Create `.env` with `DATABASE_URL` (see `.env.example`).

Generate Prisma client + run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Health check: `GET /api/health/db`

## Evidence Pack (Second Pass Research)

When you capture an opinion for a topic, the app generates a structured "evidence pack" (supporting examples, stats, company signals, and counterpoints) from the topic's sources and displays it on the draft page.
