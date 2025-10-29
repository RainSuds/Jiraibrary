# Jiraibrary

Jiraibrary is a catalog of Jirai Kei fashion pieces inspired by projects such as LoLibrary. The MVP focuses on curated data entry, browsable collections, and a clean admin workflow that is deployment-ready for AWS.

---

## Features

- Browseable catalog with category, brand, tag, and status metadata
- Detail pages with descriptions, imagery, and optional year attribution
- Powerful filtering (category, brand, tags) and name search
- Django admin setup for managing brands, tags, and items
- Image storage abstraction via Amazon S3 using `django-storages`
- PostgreSQL-ready configuration for AWS RDS deployment
- Room for future AI-assisted tagging and similarity search workflows

## Tech Stack

- **Backend:** Django 5
- **Database:** PostgreSQL (AWS RDS in production) or SQLite for local prototyping
- **Storage:** Amazon S3 (via `django-storages` + `boto3`)
- **Web Server:** Gunicorn (production)
- **Deployment target:** AWS Elastic Beanstalk (or alternative AWS compute)
- **Python Runtime:** 3.11+

## Project Structure

```text
jiraibrary_server/  # Django app with models, admin, and views
jiraibrary/         # Project settings, URLs, WSGI/ASGI entry points
media/              # Local media root (gitignored)
requirements.txt    # Locked dependency list
README.md           # Project documentation (this file)
```

### Data Model (MVP)

- **Brand** – name, optional country & description
- **Tag** – unique tag name
- **Item** – name, brand FK, category choice (dress/top/bottom/shoes/accessory), optional year, description, tags, image, status (`draft`/`approved`)

## Getting Started

### Prerequisites

- Python 3.11+
- PostgreSQL 14+ (optional for local; required for production parity)
- AWS account with S3 and RDS access (for deployment)
- Virtual environment tool (`venv`, `pyenv`, or similar)

### Installation

```powershell
# Windows PowerShell example
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Environment Variables

Create a `.env` file (gitignored) or set shell variables before running the app.

| Variable | Description |
| --- | --- |
| `SECRET_KEY` | Django secret key (override the development default) |
| `DEBUG` | `True` for local development, `False` for production |
| `DATABASE_URL` | Postgres connection string (`postgres://user:pass@host:5432/db`) |
| `AWS_ACCESS_KEY_ID` | IAM access key for S3 |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key for S3 |
| `AWS_STORAGE_BUCKET_NAME` | S3 bucket hosting media |
| `AWS_S3_REGION_NAME` | Bucket region (defaults to `us-east-1`) |

> Tip: Use [django-environ](https://django-environ.readthedocs.io/) or `python-dotenv` if you prefer automatic `.env` loading.

### Database Setup

If `DATABASE_URL` is present, `dj_database_url` will parse it. Otherwise the project falls back to SQLite at `db.sqlite3`.

For local Postgres:

```powershell
createdb jiraibrary_dev
set DATABASE_URL=postgres://postgres:password@localhost:5432/jiraibrary_dev
```

Run migrations and create an admin account:

```powershell
python manage.py migrate
python manage.py createsuperuser
```

### Seed Data

Load the reference taxonomy and sample catalog entry:

```powershell
python manage.py loaddata jiraibrary_server/fixtures/seed_reference.json jiraibrary_server/fixtures/seed_catalog.json
```

You can sanity-check the relationships with the helper command:

```powershell
python manage.py check_seed_integrity
```

The command ensures the Liz Lisa Heart Apron seed item links to translations, prices, variants, colors, fabrics, and tags before you start building UI or APIs on top of it.

### Running the Server

```powershell
python manage.py runserver
```

Visit `http://127.0.0.1:8000/` for the catalog and `/admin/` for the Django admin.

### Media & S3

- Uploads default to the `media/` directory in development.
- In production, configure the AWS variables so `django-storages` pushes uploads to S3.
- Ensure proper IAM policies for the bucket (read for public assets, write for the app).

## Testing

```powershell
python manage.py test
```

Fixture smoke tests, soft-delete coverage, serializer snapshots, and form validation live in `jiraibrary_server/test_jiraibrary_server.py`. Add new assertions there as the schema grows.

## Deployment (AWS Elastic Beanstalk)

1. Provision AWS resources: RDS (PostgreSQL), S3 bucket, IAM user/role, Route 53 domain.
2. Configure environment variables in Elastic Beanstalk (or AWS Systems Manager Parameter Store).
3. Build the application zip with the Django project and `requirements.txt`.
4. Deploy via the EB CLI or AWS console and run migrations (`python manage.py migrate`).
5. Point the domain (`jiraibrary.org`) via Route 53 and attach an ACM certificate for HTTPS.

Alternative options include AWS Lightsail, ECS/Fargate, or container-based deployment if the stack evolves.

## Roadmap

- AI-assisted tagging (CLIP/BLIP) for admin workflows
- Vector-based similarity search (FAISS or managed vector DB)
- Public submission queue with moderation controls
- Automated fashion data ingestion pipelines
- User accounts, favorites, and export tooling

## Contributing

1. Fork and clone the repo.
2. Create a virtual environment and install dependencies.
3. Work on a topic branch (`git checkout -b feature/...`).
4. Run tests and lint checks before opening a PR.

## License

License details not yet specified. Add your preferred license (MIT, Apache 2.0, etc.) before public release.
