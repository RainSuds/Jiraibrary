require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, '../public/images')));

// Configure multer for image uploads
const crypto = require('crypto');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/images'));
  },
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomUUID();
    cb(null, uniqueId + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// ============= CATEGORIES ROUTES =============

// Get all categories
app.get('/api/categories', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get category by ID
app.get('/api/categories/:id', (req, res) => {
  try {
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create category
app.post('/api/categories', (req, res) => {
  try {
    const { name, description } = req.body;
    const stmt = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
    const result = stmt.run(name, description);
    res.status(201).json({ id: result.lastInsertRowid, name, description });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update category
app.put('/api/categories/:id', (req, res) => {
  try {
    const { name, description } = req.body;
    const stmt = db.prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?');
    const result = stmt.run(name, description, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ id: req.params.id, name, description });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete category
app.delete('/api/categories/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM categories WHERE id = ?');
    const result = stmt.run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============= BRANDS ROUTES =============

// Get all brands
app.get('/api/brands', (req, res) => {
  try {
    const brands = db.prepare('SELECT * FROM brands ORDER BY name').all();
    res.json(brands);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get brand by ID
app.get('/api/brands/:id', (req, res) => {
  try {
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    res.json(brand);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create brand
app.post('/api/brands', (req, res) => {
  try {
    const { name, description, website } = req.body;
    const stmt = db.prepare('INSERT INTO brands (name, description, website) VALUES (?, ?, ?)');
    const result = stmt.run(name, description, website);
    res.status(201).json({ id: result.lastInsertRowid, name, description, website });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update brand
app.put('/api/brands/:id', (req, res) => {
  try {
    const { name, description, website } = req.body;
    const stmt = db.prepare('UPDATE brands SET name = ?, description = ?, website = ? WHERE id = ?');
    const result = stmt.run(name, description, website, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    res.json({ id: req.params.id, name, description, website });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete brand
app.delete('/api/brands/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM brands WHERE id = ?');
    const result = stmt.run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    res.json({ message: 'Brand deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============= TAGS ROUTES =============

// Get all tags
app.get('/api/tags', (req, res) => {
  try {
    const tags = db.prepare('SELECT * FROM tags ORDER BY name').all();
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tag by ID
app.get('/api/tags/:id', (req, res) => {
  try {
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    res.json(tag);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create tag
app.post('/api/tags', (req, res) => {
  try {
    const { name } = req.body;
    const stmt = db.prepare('INSERT INTO tags (name) VALUES (?)');
    const result = stmt.run(name);
    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update tag
app.put('/api/tags/:id', (req, res) => {
  try {
    const { name } = req.body;
    const stmt = db.prepare('UPDATE tags SET name = ? WHERE id = ?');
    const result = stmt.run(name, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    res.json({ id: req.params.id, name });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete tag
app.delete('/api/tags/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM tags WHERE id = ?');
    const result = stmt.run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============= ITEMS ROUTES =============

// Get all items with optional filtering
app.get('/api/items', (req, res) => {
  try {
    const { category, brand, tags, search } = req.query;
    
    let query = `
      SELECT DISTINCT items.*, 
        categories.name as category_name,
        brands.name as brand_name
      FROM items
      LEFT JOIN categories ON items.category_id = categories.id
      LEFT JOIN brands ON items.brand_id = brands.id
      LEFT JOIN item_tags ON items.id = item_tags.item_id
      LEFT JOIN tags ON item_tags.tag_id = tags.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (category) {
      query += ' AND items.category_id = ?';
      params.push(category);
    }
    
    if (brand) {
      query += ' AND items.brand_id = ?';
      params.push(brand);
    }
    
    if (tags) {
      const tagIds = tags.split(',');
      // Validate that all tagIds are numeric
      const validTagIds = tagIds.filter(id => !isNaN(parseInt(id)));
      if (validTagIds.length > 0) {
        query += ` AND items.id IN (
          SELECT item_id FROM item_tags WHERE tag_id IN (${validTagIds.map(() => '?').join(',')})
        )`;
        params.push(...validTagIds);
      }
    }
    
    if (search) {
      query += ' AND (items.name LIKE ? OR items.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ' ORDER BY items.created_at DESC';
    
    const items = db.prepare(query).all(...params);
    
    // Get tags for each item
    const itemsWithTags = items.map(item => {
      const itemTags = db.prepare(`
        SELECT tags.* FROM tags
        JOIN item_tags ON tags.id = item_tags.tag_id
        WHERE item_tags.item_id = ?
      `).all(item.id);
      
      return { ...item, tags: itemTags };
    });
    
    res.json(itemsWithTags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get item by ID
app.get('/api/items/:id', (req, res) => {
  try {
    const item = db.prepare(`
      SELECT items.*, 
        categories.name as category_name,
        brands.name as brand_name
      FROM items
      LEFT JOIN categories ON items.category_id = categories.id
      LEFT JOIN brands ON items.brand_id = brands.id
      WHERE items.id = ?
    `).get(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // Get tags for the item
    const tags = db.prepare(`
      SELECT tags.* FROM tags
      JOIN item_tags ON tags.id = item_tags.tag_id
      WHERE item_tags.item_id = ?
    `).all(req.params.id);
    
    res.json({ ...item, tags });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create item
app.post('/api/items', (req, res) => {
  try {
    const { name, description, brand_id, category_id, price, image_url, purchase_url, tag_ids } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO items (name, description, brand_id, category_id, price, image_url, purchase_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(name, description, brand_id, category_id, price, image_url, purchase_url);
    const itemId = result.lastInsertRowid;
    
    // Add tags if provided
    if (tag_ids && Array.isArray(tag_ids)) {
      const tagStmt = db.prepare('INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)');
      tag_ids.forEach(tagId => {
        tagStmt.run(itemId, tagId);
      });
    }
    
    res.status(201).json({ id: itemId, name, description, brand_id, category_id, price, image_url, purchase_url });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update item
app.put('/api/items/:id', (req, res) => {
  try {
    const { name, description, brand_id, category_id, price, image_url, purchase_url, tag_ids } = req.body;
    
    const stmt = db.prepare(`
      UPDATE items 
      SET name = ?, description = ?, brand_id = ?, category_id = ?, price = ?, 
          image_url = ?, purchase_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const result = stmt.run(name, description, brand_id, category_id, price, image_url, purchase_url, req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // Update tags
    if (tag_ids && Array.isArray(tag_ids)) {
      // Remove existing tags
      db.prepare('DELETE FROM item_tags WHERE item_id = ?').run(req.params.id);
      
      // Add new tags
      const tagStmt = db.prepare('INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)');
      tag_ids.forEach(tagId => {
        tagStmt.run(req.params.id, tagId);
      });
    }
    
    res.json({ id: req.params.id, name, description, brand_id, category_id, price, image_url, purchase_url });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete item
app.delete('/api/items/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM items WHERE id = ?');
    const result = stmt.run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Upload image
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const imageUrl = `/images/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});
