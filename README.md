# Jiraibrary

Jiraibrary is a visual catalog and searchable archive of **Jirai Kei** fashion, inspired by projects like [Lolibrary](https://lolibrary.org/).  
The MVP focuses on searchable data, clear item presentation, and an admin workflow that enables **AI-assisted data entry** in future updates.

For Docker-based local PostgreSQL instructions see [`docs/local-postgres.md`](docs/local-postgres.md).

---

## 🧭 App Flow Overview

### Core Views (MVP)

1. **Home**  
   - Displays all **brands** in responsive grid cards.  
   - A top **search bar** (with filter icon) floats at the top.  
   - Clicking a brand navigates to its brand details or filters items by that brand.

2. **Search**  
   - Triggered when a user types into the home search bar.  
   - Dedicated `/search` page includes:  
     - Sidebar: advanced filters (brand, tag, category, year).  
     - Main area: grid of item cards matching the query.  
   - Each card shows a thumbnail, name, brand, and tags.

3. **Item Details**  
   - Dedicated `/item/[id]` route with full details:  
     - Name, Brand, Description, Year, Tags, Category, Image(s).  
     - **References** list — each hyperlink applies a new search scoped to that reference (e.g., brand, collection, tag).

### Next Tier (Post-MVP)

- **Navbar:** Persistent navigation with Home, Search, and Login buttons.  
- **User Login:** Simple user auth for favorites and submissions.  
- **Admin Login:** Django admin for managing items, tags, and brands.  
- **Add Entries:** Authenticated page to propose or upload new clothing items (with image preview and tags).

---

## ✨ Key Features

- Browseable catalog by brand, category, tag, or year  
- Search & filter with instant feedback  
- Detail pages with related references  
- Django admin for backend management  
- REST API powering a modern React UI  
- Ready for AI tagging and similarity search  
- AWS-ready for media and database hosting  

---

## 🧱 Tech Stack

| Layer | Tech | Purpose |
|-------|------|----------|
| **Frontend** | Next.js 15 (React 19, TypeScript, TailwindCSS) | Modern SSR/SPA UI with strong SEO |
| **Backend** | Django 5 + Django REST Framework | Reliable API, admin, and data logic |
| **Database** | PostgreSQL (AWS RDS) | Relational data with rich filtering |
| **Storage** | Amazon S3 | Image hosting and user uploads |
| **Auth** | Django JWT + NextAuth.js | Seamless session flow between stacks |
| **AI Integration** | OpenAI, CLIP (Hugging Face), AWS Rekognition | Tagging, similarity search (future) |
| **Deployment** | AWS Elastic Beanstalk (Django) + Vercel or AWS Amplify (Next.js) | Production hosting |
| **Styling** | TailwindCSS + ShadCN | Clean, minimalist, Jirai aesthetic |

---

## 🗂️ Project Structure

```text
backend/
│   manage.py
│   requirements.txt
│
├── config/               # Django project settings and URLs
├── catalog/              # Main app: models, serializers, views, admin, fixtures
└── db.sqlite3

frontend/
│   package.json
│   next.config.js
│
└── src/
    ├── app/              # Next.js App Router
    ├── components/       # Reusable UI components
    ├── pages/            # Route definitions
    └── styles/           # Tailwind and custom CSS

README.md

### Day 2 – Models & API

### Day 2 – Models & API

**Define models in Django**
- `Brand`
- `Tag`
- `Item`

**Set up**
- Serializers & REST endpoints (Django REST Framework)
- Connect S3 for image upload (`boto3` + `django-storages`)
- Test CRUD via Django Admin

---

### Day 3 – Next.js UI

**Create pages**
- `/` → Item list with filters
- `/item/[id]` → Item detail
- `/brand/[name]`, `/tag/[name]` → filtered views

**Frontend tasks**
- Use Tailwind CSS for styling
- Fetch data via Axios (or `fetch`) from Django API

---

### Day 4 – Image Upload & AI Integration

**Image upload**
- Integrate AWS S3 image upload in admin (upload + serve from S3)

**AI helper (optional)**
- Add a simple AI tagging helper
  - Script or endpoint that calls OpenAI / CLIP
  - Example flow: send item description + image URL → receive suggested tags
- Present suggestions in admin for human confirmation before saving

---

### Day 5 – Search, Filter, and Polish

- Implement search bar + brand/tag/category filtering
- Add pagination or infinite scroll for long result sets
- Improve visual styling and UI consistency (spacing, fonts, image aspect ratios)

---

### Day 6 – Testing & Debugging

- Test item CRUD in Django Admin
- Test frontend filtering, browsing, and search end-to-end
- Ensure S3-hosted images render correctly in all views
- Prepare production `.env` files and document required environment variables

---

### Day 7 – AWS Deployment

**Backend (Django)**
- Deploy to AWS Elastic Beanstalk (or Lightsail)
- Configure environment variables / secrets
- Connect to AWS RDS (Postgres)
- Ensure static/media handling with S3

**Frontend (Next.js)**
- Deploy to AWS Amplify or Vercel
- Configure `NEXT_PUBLIC_API_BASE_URL` to point to backend API

**Infrastructure to configure**
- AWS RDS (PostgreSQL)
- S3 bucket for media
- Route 53 DNS for `jiraibrary.org`
- HTTPS via AWS Certificate Manager (ACM)

---

## AI Integration (Phase 1)

**Overview**
- Optional but recommended as an admin helper

**Workflow**
1. Admin uploads an image (or links an image URL).
2. Backend sends the image (and optional text) to an AI model (e.g., CLIP, GPT-4o-mini).
3. AI returns suggested tags, categories, or probable brand.
4. Admin reviews & confirms suggestions → saves to database.

**Implementation options**
- Local inference: Hugging Face `transformers` (CLIP/BLIP) for embeddings/captions
- Hosted APIs: OpenAI / Anthropic for captioning and structured extraction

---

## Cost Estimates

| Service                         | Est. Monthly Cost      |
|---------------------------------|------------------------|
| AWS EC2 (Elastic Beanstalk)     | $10–15                |
| AWS RDS (PostgreSQL)            | $10–15                |
| AWS S3                          | $1–5                  |
| Route 53 Domain                 | ~$12 / year           |
| AI API usage                    | Variable (~$5–10 light use) |

---

## Future Roadmap

- AI-assisted image classification & tagging  
- Image similarity / visual search (vector DB: FAISS / Pinecone)  
- Automated web crawling for fashion entries (with human confirmation)  
- Community contributions: user submissions & moderation queue  
- User accounts & favorites system  
- Donation / premium tier to sustain hosting costs

---

## Google Authentication

- Backend: set `GOOGLE_OAUTH_CLIENT_IDS` (comma-separated list) to the Google OAuth client IDs that may authenticate with the API.
- Frontend: set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to the same web client ID so the Google login button can initialize properly.
- Install backend dependency `google-auth` (already listed in `backend/requirements.txt`) and restart both services after updating environment variables.

---

## Notes

- Keep MVP focused on **CRUD + browsing + filtering**.  
- AI and auto-crawling are **Phase 2** enhancements.  
- Always document **why** a step or decision is made (learning-first approach).  
- Keep commits small and descriptive to aid learning and rollback.
