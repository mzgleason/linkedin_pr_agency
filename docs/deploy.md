# Deployment baseline (MVP)

This repo is optimized for local dev. Before running as a public SaaS, ensure the following baseline is in place.

## Environments

- Staging: mirrors prod config with separate DB + Stripe keys.
- Production: locked-down env vars, logging, and backups.

Required env vars:

- `DATABASE_URL`
- `SESSION_SECRET`
- `APP_URL`

Optional (feature-gated):

- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`

## Migrations

Production deploy should run:

- `npm run prisma:deploy`

Avoid running `prisma migrate dev` in production environments.

## Backups

At minimum:

- daily Postgres backups
- tested restore procedure

For local Docker, a manual backup can be created with:

```bash
docker exec -t linkedin_pr_agency-postgres-1 pg_dump -U postgres linkedin_pr_agency > backup.sql
```

## Security notes

- Auth uses a signed, httpOnly cookie (`SESSION_SECRET`) with `SameSite=Lax`.
- State-changing actions are POST-only; keep `APP_URL` consistent across environments.
- Basic security headers are configured in `next.config.ts`.

