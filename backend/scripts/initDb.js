const db = require('../database');

console.log('Initializing database with sample data...');

// Insert categories
const categories = [
  { name: 'Tops', description: 'Blouses, shirts, and other upper garments' },
  { name: 'Bottoms', description: 'Skirts, pants, and shorts' },
  { name: 'Dresses', description: 'One-piece dresses' },
  { name: 'Outerwear', description: 'Jackets, coats, and cardigans' },
  { name: 'Accessories', description: 'Bags, jewelry, and other accessories' },
  { name: 'Shoes', description: 'Footwear' }
];

const categoryStmt = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
categories.forEach(cat => {
  try {
    categoryStmt.run(cat.name, cat.description);
    console.log(`Added category: ${cat.name}`);
  } catch (e) {
    console.log(`Category ${cat.name} already exists`);
  }
});

// Insert brands
const brands = [
  { name: 'LISTEN FLAVOR', description: 'Popular Jirai Kei brand', website: 'https://listenflavor.com' },
  { name: 'REFLEM', description: 'Dark edgy fashion brand', website: 'https://reflem.jp' },
  { name: 'ROJITA', description: 'Girly fashion brand', website: 'https://rojita.com' },
  { name: 'EATME', description: 'Edgy feminine brand', website: 'https://eatme.jp' },
  { name: 'MA*RS', description: 'Sweet and edgy brand', website: 'https://mars-shop.jp' }
];

const brandStmt = db.prepare('INSERT INTO brands (name, description, website) VALUES (?, ?, ?)');
brands.forEach(brand => {
  try {
    brandStmt.run(brand.name, brand.description, brand.website);
    console.log(`Added brand: ${brand.name}`);
  } catch (e) {
    console.log(`Brand ${brand.name} already exists`);
  }
});

// Insert tags
const tags = [
  'Black', 'Pink', 'White', 'Lace', 'Ribbons', 'Gothic', 'Sweet', 
  'Dark', 'Girly', 'Edgy', 'Kawaii', 'Chains', 'Hearts', 'Bows',
  'Pleated', 'Ruffles', 'Mesh', 'Velvet', 'Platform', 'Cross'
];

const tagStmt = db.prepare('INSERT INTO tags (name) VALUES (?)');
tags.forEach(tag => {
  try {
    tagStmt.run(tag);
    console.log(`Added tag: ${tag}`);
  } catch (e) {
    console.log(`Tag ${tag} already exists`);
  }
});

// Insert sample items
const items = [
  {
    name: 'Heart Lace Blouse',
    description: 'Cute blouse with heart-shaped lace details and ribbon ties',
    brand_id: 1,
    category_id: 1,
    price: 4500,
    image_url: '/images/sample-blouse.jpg',
    purchase_url: 'https://example.com/item1',
    tags: [4, 5, 9, 13] // Lace, Ribbons, Girly, Bows
  },
  {
    name: 'Pleated Mini Skirt',
    description: 'Classic pleated mini skirt in black',
    brand_id: 2,
    category_id: 2,
    price: 3800,
    image_url: '/images/sample-skirt.jpg',
    purchase_url: 'https://example.com/item2',
    tags: [1, 15] // Black, Pleated
  },
  {
    name: 'Gothic Cross Necklace',
    description: 'Silver chain necklace with cross pendant',
    brand_id: 2,
    category_id: 5,
    price: 2200,
    image_url: '/images/sample-necklace.jpg',
    purchase_url: 'https://example.com/item3',
    tags: [6, 8, 12, 20] // Gothic, Dark, Chains, Cross
  },
  {
    name: 'Platform Mary Janes',
    description: 'Black platform Mary Jane shoes with heart buckle',
    brand_id: 3,
    category_id: 6,
    price: 5800,
    image_url: '/images/sample-shoes.jpg',
    purchase_url: 'https://example.com/item4',
    tags: [1, 13, 19] // Black, Hearts, Platform
  },
  {
    name: 'Ribbon Cardigan',
    description: 'Soft pink cardigan with ribbon details',
    brand_id: 5,
    category_id: 4,
    price: 4200,
    image_url: '/images/sample-cardigan.jpg',
    purchase_url: 'https://example.com/item5',
    tags: [2, 5, 7, 14] // Pink, Ribbons, Sweet, Bows
  }
];

const itemStmt = db.prepare(`
  INSERT INTO items (name, description, brand_id, category_id, price, image_url, purchase_url)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const itemTagStmt = db.prepare('INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)');

items.forEach(item => {
  try {
    const result = itemStmt.run(
      item.name,
      item.description,
      item.brand_id,
      item.category_id,
      item.price,
      item.image_url,
      item.purchase_url
    );
    
    const itemId = result.lastInsertRowid;
    
    // Add tags
    item.tags.forEach(tagId => {
      itemTagStmt.run(itemId, tagId);
    });
    
    console.log(`Added item: ${item.name}`);
  } catch (e) {
    console.log(`Error adding item ${item.name}: ${e.message}`);
  }
});

console.log('Database initialization complete!');
