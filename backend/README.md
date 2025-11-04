# Jiraibrary Backend

This Django + Django REST Framework project powers the Jirai Kei fashion archive API. It implements the schema outlined in `schema_design.md` and exposes read-only endpoints for the public catalogue while relying on the Django admin for content management.

## Key Features

- UUID-based models for brands, items, taxonomy, and media derived from the schema design
- Read-only REST API with filtering, search, and OpenAPI documentation (`/api/docs/`)
- Django admin configured for catalog curation and translation/price management
- Optional AWS S3 integration via `django-storages`
- Custom user model with roles and profile metadata

## Local Development (Docker + PostgreSQL)

1. Copy `.env.example` to `.env` (or `.env.local`) and adjust values as needed. The settings module will automatically load `.env` followed by `.env.local`, or respect a `DJANGO_ENV_FILE` path if you prefer a different filename.
2. Start PostgreSQL locally with Docker:

   ```powershell
   docker compose up -d db
   ```

   The compose file exposes Postgres on `localhost:5432` with credentials matching the default `DATABASE_URL` in `.env.example`.

3. Create and activate a virtual environment, then install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Apply database migrations and (optionally) load sample data:

   ```bash
   python manage.py migrate
   python manage.py seed_catalog  # optional
   ```

5. Create a superuser for accessing the Django admin:

   ```bash
   python manage.py createsuperuser
   ```

6. Run the development server:

   ```bash
   python manage.py runserver
   ```

Remember to shut down the local database when you're finished:

```powershell
docker compose down
```

## Production Setup (AWS RDS + S3)

1. **Provision infrastructure**
   - Create a managed PostgreSQL instance in AWS RDS.
   - Create an S3 bucket for static and media assets (optionally separate buckets/paths).
   - Store database credentials, Django `SECRET_KEY`, and AWS keys in your secrets manager of choice.

2. **Configure environment variables** (examples below assume a managed RDS instance and the deployed Next.js frontend hosted at `https://app.yourdomain.com`):

   ```bash
   DEBUG=False
   SECRET_KEY=<load-from-secrets-manager>
   DATABASE_URL=postgres://<user>:<password>@<rds-endpoint>:5432/<dbname>
   DATABASE_REQUIRE_SSL=True
   ALLOWED_HOSTS=api.yourdomain.com
   CORS_ALLOW_ALL_ORIGINS=False
   CORS_ALLOWED_ORIGINS=https://app.yourdomain.com
   CSRF_TRUSTED_ORIGINS=https://app.yourdomain.com

   AWS_STORAGE_BUCKET_NAME=<s3-bucket-name>
   AWS_S3_REGION_NAME=<aws-region>
   AWS_S3_STATIC_LOCATION=static
   AWS_S3_MEDIA_LOCATION=media
   AWS_S3_SIGNATURE_VERSION=s3v4
   AWS_QUERYSTRING_AUTH=False
   AWS_S3_FILE_OVERWRITE=False
   ```

   If you expose static files via a CloudFront distribution or custom domain, set `AWS_S3_CUSTOM_DOMAIN` to that host and adjust `STATIC_URL`/`MEDIA_URL` accordingly.

3. **Deploy code and install dependencies** on the target host (container image, EC2, etc.).

4. **Run database migrations and collect static files**:

   ```bash
   python manage.py migrate
   python manage.py collectstatic --noinput
   ```

5. **Create an initial admin/superuser** (if you do not restore one from backup):

   ```bash
   python manage.py createsuperuser
   ```

6. **Verify health** by running your application server (e.g., `gunicorn config.wsgi:application`) behind a reverse proxy with TLS termination. Ensure the load balancer forwards `X-Forwarded-Proto` so Django can generate secure absolute URLs.

7. **Store secrets securely**. Never commit `.env` files with production credentials; instead, inject them via environment variables or secret managers at deploy time.

## API Overview

- `GET /api/brands/` – brand catalogue
- `GET /api/items/` – item feed with filters (`brand`, `category_slug`, `tag_slug`, `q`, etc.)
- `GET /api/items/{slug}/` – expanded item detail payload including translations, pricing, media
- `GET /api/schema/` / `GET /api/docs/` – OpenAPI schema and Swagger UI

Filtering and ordering rules live in `catalog/filters.py` and `catalog/views.py`.

## Notes

- Attachments such as images default to `storage_path` strings; configure S3 credentials (and optional CloudFront domain) to serve from AWS in production.
- Because the API is read-only today, submissions and moderation flow through the Django admin UI. Extend the serializers/viewsets when you are ready to expose write endpoints.
- The project now targets PostgreSQL for both local and production environments. A convenience Docker Compose file is provided for local development, while production deployments should point `DATABASE_URL` to the managed RDS instance.
