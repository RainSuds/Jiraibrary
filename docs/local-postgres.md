# Local PostgreSQL Setup

Use the project `docker-compose.yml` to run PostgreSQL 16 for development. The container exposes port `5432` on localhost and is provisioned with the same credentials referenced in `backend/.env.example`.

1. **Start the database**

   ```bash
   docker compose up -d db
   ```

   The data files live in the named volume `jiraibrary-postgres-data`.

2. **Configure Django**

   Ensure `backend/.env` includes the connection string:

   ```env
   DATABASE_URL=postgres://jiraibrary:jiraibrary@localhost:5432/jiraibrary
   ```

3. **Apply migrations and seed data**

   ```bash
   cd backend
   python manage.py migrate
   python manage.py seed_catalog
   ```

4. **Stop or reset the database**

   ```bash
   docker compose stop db      # stop but keep data
   docker compose down -v      # stop and remove data volume
   ```
