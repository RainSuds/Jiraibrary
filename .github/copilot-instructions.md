# Copilot instructions (Jiraibrary)

## Migration policy (pre-deploy)

- If we are preparing an **official deployment** and the team is willing to **reset the database**, prefer consolidating Django migrations into a clean baseline:
  - Aim for **one `0001_initial.py` per Django app** (e.g., `users`, `catalog`).
  - It is OK to delete and regenerate migrations during this phase, as long as the end result is a clean `makemigrations --check` and the app migrates from an empty DB.
  - Do **not** try to merge multiple Django apps into a single migration file.

### How to consolidate (when DB reset is OK)

- Delete all migration files in each app’s `migrations/` folder **except** `__init__.py`.
- Reset the database (drop/recreate or delete the volume if using Docker).
- Run `python manage.py makemigrations` (should create a fresh `0001_initial.py` per app).
- Run `python manage.py migrate` from an empty DB.

Note: avoid editing an already-applied migration file; if you’re not resetting the DB, create a new migration instead.

## Environment configs

- Keep **dev** and **deployment/prod** configuration separate.
- Never commit real secrets; only commit `*.example` templates.
- For Next.js, assume `.env.local` is for local dev and `.env.production*` is for deployment.

## Auth (Cognito)

- Cognito is an optional identity provider; the backend still issues the app’s DRF token for API calls.
- Prefer an app client **without a client secret** unless the secret is only used server-side.
