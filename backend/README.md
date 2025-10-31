# Jiraibrary Backend

This Django + Django REST Framework project powers the Jirai Kei fashion archive API. It implements the schema outlined in `schema_design.md` and exposes read-only endpoints for the public catalogue while relying on the Django admin for content management.

## Key Features

- UUID-based models for brands, items, taxonomy, and media derived from the schema design
- Read-only REST API with filtering, search, and OpenAPI documentation (`/api/docs/`)
- Django admin configured for catalog curation and translation/price management
- Optional AWS S3 integration via `django-storages`
- Custom user model with roles and profile metadata

## Getting Started

1. Create and activate a virtual environment, then install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and update secrets plus connection details.
3. Generate migrations and apply them:

   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

4. Create a superuser and load any seed data you need:

   ```bash
   python manage.py createsuperuser
   ```

5. Run the development server:

   ```bash
   python manage.py runserver
   ```

## API Overview

- `GET /api/brands/` – brand catalogue
- `GET /api/items/` – item feed with filters (`brand`, `category_slug`, `tag_slug`, `q`, etc.)
- `GET /api/items/{slug}/` – expanded item detail payload including translations, pricing, media
- `GET /api/schema/` / `GET /api/docs/` – OpenAPI schema and Swagger UI

Filtering and ordering rules live in `catalog/filters.py` and `catalog/views.py`.

## Notes

- Attachments such as images default to `storage_path` strings; configure S3 credentials to serve from AWS.
- Because the API is read-only today, submissions and moderation flow through the Django admin UI. Extend the serializers/viewsets when you are ready to expose write endpoints.
- The project expects PostgreSQL in production. SQLite is used automatically when `DATABASE_URL` is not set for local experimentation.
