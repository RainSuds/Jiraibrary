# Jiraibrary 💗

A minimal viable product (MVP) for a Jirai Kei fashion database website, similar to LoLibrary. Browse, search, and manage Jirai Kei fashion items with ease.

## Features

✨ **Browseable Catalog**
- View items with images, prices, and descriptions
- Organized by categories, brands, and tags
- Responsive grid layout

🔍 **Search & Filtering**
- Real-time search by item name or description
- Filter by category (Tops, Bottoms, Dresses, etc.)
- Filter by brand (LISTEN FLAVOR, REFLEM, etc.)
- Multi-select tag filtering (Black, Pink, Lace, Gothic, etc.)

🔐 **Admin Dashboard**
- Add, edit, and delete items
- Manage categories, brands, and tags
- Upload product images
- Intuitive modal-based item editor

🚀 **Ready for Enhancement**
- Clean API architecture for AI integration
- SQLite database (easily migrate to PostgreSQL)
- Structured for AWS deployment
- React frontend with Tailwind CSS

## Tech Stack

### Frontend
- **React 18** - Modern UI library
- **Vite** - Fast build tool and dev server
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first styling
- **Axios** - HTTP client

### Backend
- **Node.js & Express** - REST API server
- **SQLite** (better-sqlite3) - Embedded database
- **Multer** - Image upload handling
- **CORS** - Cross-origin support

## Quick Start

### Prerequisites
- Node.js 18+ and npm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/RainSuds/Jiraibrary.git
   cd Jiraibrary
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install backend dependencies
   cd backend
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   cd ..
   ```

3. **Initialize the database**
   ```bash
   cd backend
   npm run init-db
   cd ..
   ```

4. **Start the application**
   ```bash
   # From the root directory, start both frontend and backend
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001/api

## Project Structure

```
Jiraibrary/
├── backend/
│   ├── database.js           # Database schema and initialization
│   ├── server.js             # Express API server
│   ├── scripts/
│   │   └── initDb.js         # Database seeding script
│   ├── package.json
│   └── .env                  # Environment configuration
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable React components
│   │   ├── pages/
│   │   │   ├── Catalog.jsx   # Main catalog page
│   │   │   ├── ItemDetail.jsx # Item detail page
│   │   │   └── Admin.jsx     # Admin dashboard
│   │   ├── services/
│   │   │   └── api.js        # API client functions
│   │   ├── App.jsx           # Main app component
│   │   ├── main.jsx          # App entry point
│   │   └── index.css         # Global styles
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── public/
│   └── images/               # Product images
├── package.json              # Root package.json
└── README.md
```

## API Endpoints

### Items
- `GET /api/items` - Get all items (supports filtering)
- `GET /api/items/:id` - Get item by ID
- `POST /api/items` - Create new item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Brands
- `GET /api/brands` - Get all brands
- `POST /api/brands` - Create brand
- `PUT /api/brands/:id` - Update brand
- `DELETE /api/brands/:id` - Delete brand

### Tags
- `GET /api/tags` - Get all tags
- `POST /api/tags` - Create tag
- `PUT /api/tags/:id` - Update tag
- `DELETE /api/tags/:id` - Delete tag

### Upload
- `POST /api/upload` - Upload image

## Database Schema

### Tables
- **items** - Fashion items with name, description, price, images
- **categories** - Item categories (Tops, Bottoms, Dresses, etc.)
- **brands** - Fashion brands (LISTEN FLAVOR, REFLEM, etc.)
- **tags** - Tags for categorization (Black, Pink, Lace, etc.)
- **item_tags** - Junction table for many-to-many item-tag relationships

## Development

### Run Backend Only
```bash
cd backend
npm run dev
```

### Run Frontend Only
```bash
cd frontend
npm run dev
```

### Build Frontend for Production
```bash
cd frontend
npm run build
```

### Re-initialize Database
```bash
cd backend
rm jiraibrary.db  # Remove existing database
npm run init-db   # Create fresh database with sample data
```

## Deployment to AWS

### Recommended Architecture

1. **Frontend**: Deploy to AWS S3 + CloudFront
   - Build: `cd frontend && npm run build`
   - Upload `dist/` folder to S3 bucket
   - Configure CloudFront for CDN

2. **Backend**: Deploy to AWS Elastic Beanstalk or EC2
   - Package backend code
   - Configure environment variables
   - Migrate from SQLite to RDS PostgreSQL for production

3. **Database**: AWS RDS (PostgreSQL)
   - Create RDS instance
   - Update backend to use PostgreSQL
   - Migrate data from SQLite

4. **Images**: Store in S3
   - Update upload endpoint to use S3
   - Configure bucket for public read access

### Environment Variables (Production)
```env
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
```

## AI Enhancement Opportunities

The codebase is structured to easily integrate AI features:

1. **AI-Powered Search**
   - Add semantic search using embeddings
   - Integrate with OpenAI or similar services

2. **Style Recommendations**
   - Build recommendation engine based on user preferences
   - "Similar items" feature

3. **Image Recognition**
   - Auto-tag items from uploaded images
   - Style classification

4. **Virtual Stylist**
   - Outfit combination suggestions
   - Personalized shopping assistant chatbot

5. **Trend Analysis**
   - Analyze popular items and tags
   - Predict trending styles

## Contributing

This is an MVP. Feel free to enhance it with:
- User authentication
- Shopping cart functionality
- Wishlist feature
- Social sharing
- Reviews and ratings
- Advanced filtering options
- Mobile app version

## License

MIT License - feel free to use this project as a foundation for your own fashion database!

---

Made with 💗 for the Jirai Kei community
