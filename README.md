# LinkedIn PR Agency (Local)

This repo contains two eras of the workflow:

1) **Next.js + Postgres web app (current direction)** - mobile-first UI to approve topics, capture opinions, iterate on drafts, and approve final posts.
2) **Python automation (legacy)** - removed.

If your goal is a phone-first approval/feedback loop, focus on the Next.js app and Prisma/Postgres.

---

## Legacy markdown artifacts (optional)

- `truth_file.md`: Approved facts and proof points.
- `content_calendar.md`: Month plan with exact dates.
- `intake_answers.md`: Latest interview responses.
- `drafts/`: Post drafts by week.
- `checklist.md`: QA + approval gates.

Workflow:
1. Update `truth_file.md` with any new approved facts.
2. Run the Friday interview (responses saved to `intake_answers.md`).
3. Draft next week's three-part series in `drafts/`.
4. Review against `checklist.md`.
5. Publish only after explicit approval.
6. After reminders are sent, drafts are cleaned up and a weekly memory entry is kept.

GitLab:
- CI is app-only (lint + build). Scheduled orchestrator jobs have been removed.

---

## Web app (Next.js + Prisma + Postgres)

Run the app:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Pages:
- Topic inbox (approve/save/reject): `/inbox`
- Add a topic from your phone: `/topics/new`
- Opinion capture + draft generation: `/topics` -> `Capture opinion`
- Draft review + edits + final approval: `/topics/[topicId]/draft`

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
