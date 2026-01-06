# Jiraibrary

Jiraibrary is a visual catalog and searchable archive of **Jirai Kei** fashion. It pairs a Django REST API with a Next.js frontend to document brands, collections, and garments, and serves high-resolution media through AWS.

> Live site: **[jiraibrary.com](https://jiraibrary.com)**  
> GitHub: [RainSuds/Jiraibrary](https://github.com/RainSuds/Jiraibrary)

For information on running PostgreSQL locally with Docker, see [`docs/local-postgres.md`](docs/local-postgres.md).

---

## Highlights

- Searchable catalog of brands and items with filterable metadata
- Deterministic S3 media storage surfaced through CloudFront CDN
- Django admin workflow and serializers tailored for data entry
- Monorepo with automated tests for upload paths and media URLs
- Production hosting on AWS (App Runner for the API, Amplify for the web app)

---

## Architecture

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Next.js 16 (React 19, TypeScript) | Hosted on AWS Amplify at `jiraibrary.com` |
| Backend | Django 5.2 + Django REST Framework | Runs on AWS App Runner with Gunicorn |
| Database | PostgreSQL (AWS RDS) | Primary data store for catalog content |
| Media | Amazon S3 + CloudFront | Deterministic key structure under `media/catalog/...` |
| Auth | Django admin, Google OAuth (planned frontend integration) | OAuth client IDs configurable via env vars |
| Infrastructure | Docker, AWS Route 53, ACM | Backend container image produced from monorepo |

---

## Repository Layout

```text
backend/
├── catalog/              # Core Django app (models, serializers, admin, tests)
├── config/               # Django project settings and URLs
├── Dockerfile            # App Runner container image
├── entrypoint.sh         # Runs migrations then launches Gunicorn
├── manage.py
└── requirements.txt

frontend/
├── next.config.ts
├── package.json
└── src/
    ├── app/              # App Router routes (`app/search`, `app/items/[slug]`, etc.)
    ├── components/       # Reusable UI elements (galleries, search bar)
    └── lib/              # API and media URL helpers
```

---

## Local Development

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL (local or Docker compose)
- AWS credentials if you need to push to S3 during development

### Backend

```bash
cd backend
python -m venv .venv
. .venv/Scripts/activate    # PowerShell: .\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env.local   # fill in secrets as needed
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Backend env templates:

- `backend/.env.local` (local dev config; not committed)
- `backend/.env.prod.example` (deployment template; inject via App Runner env/secrets)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend env templates:



Visit `http://localhost:3000` for the web app and `http://localhost:8000/admin/` for Django admin.

---

## Testing

- Backend unit tests: `cd backend && python manage.py test`
- Frontend tests: `cd frontend && npm run test`

---

## Amazon Cognito auth (optional)

Jiraibrary can use an Amazon Cognito User Pool for signup/login, while the Django backend still issues its own DRF token for API calls.

### Frontend env vars

- `NEXT_PUBLIC_AUTH_PROVIDER=cognito`
- `COGNITO_REGION=1`
- `COGNITO_USER_POOL_CLIENT_ID=...`
- `COGNITO_USER_POOL_CLIENT_SECRET=...` (optional; only if your app client has a secret)
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` (already used; required for token exchange)

### Backend env vars

- `COGNITO_REGION=us-east-1`
- `COGNITO_USER_POOL_ID=us-east-1_...`
- `COGNITO_APP_CLIENT_ID=...` (same value as the frontend client id)

---

## Deployment

- **Backend (App Runner)**
  - Container built from `backend/Dockerfile`
  - `entrypoint.sh` runs database migrations and starts Gunicorn on port 8000
  - Environment variables and secrets supplied through App Runner runtime configuration (RDS connection string, AWS keys, `ALLOWED_HOSTS`, etc.)

- **Frontend (Amplify)**
  - Amplify connects to `frontend` directory of the main branch
  - Build command: `npm install && npm run build`
  - Environment variables include `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_MEDIA_HOST`

- **Media delivery**
  - S3 bucket `jiraibrary-media` stores assets under `media/catalog/...`
  - CloudFront distribution serves `https://media.jiraibrary.com`

---

## Roadmap

- Public browsing experience with additional filters and responsive layout enhancements
- Google OAuth integration for submissions and favorites
- AI-assisted tagging (OpenAI / Hugging Face) for faster catalog curation
- Visual similarity search backed by embeddings and a vector database

---

## Credits

Inspired by community-driven fashion archives such as [Lolibrary](https://lolibrary.org/). Built and maintained by Tianlan Li.
