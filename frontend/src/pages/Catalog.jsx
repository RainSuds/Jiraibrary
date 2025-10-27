import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getItems, getCategories, getBrands, getTags } from '../services/api';

function Catalog() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadItems();
  }, [selectedCategory, selectedBrand, selectedTags, searchQuery]);

  const loadInitialData = async () => {
    try {
      const [categoriesRes, brandsRes, tagsRes] = await Promise.all([
        getCategories(),
        getBrands(),
        getTags()
      ]);
      
      setCategories(categoriesRes.data);
      setBrands(brandsRes.data);
      setTags(tagsRes.data);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const filters = {
        category: selectedCategory,
        brand: selectedBrand,
        tags: selectedTags.join(','),
        search: searchQuery
      };
      
      const response = await getItems(filters);
      setItems(response.data);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-jirai-black mb-2">
          ✨ Jirai Kei Fashion Catalog ✨
        </h1>
        <p className="text-gray-600">
          Browse our collection of Jirai Kei fashion items
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-jirai-pink"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-jirai-pink"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Brand
            </label>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-jirai-pink"
            >
              <option value="">All Brands</option>
              {brands.map(brand => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`px-3 py-1 rounded-full text-sm transition ${
                  selectedTags.includes(tag.id)
                    ? 'bg-jirai-pink text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>

        {(selectedCategory || selectedBrand || selectedTags.length > 0 || searchQuery) && (
          <div className="mt-4">
            <button
              onClick={() => {
                setSelectedCategory('');
                setSelectedBrand('');
                setSelectedTags([]);
                setSearchQuery('');
              }}
              className="text-sm text-jirai-pink hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-jirai-pink"></div>
          <p className="mt-4 text-gray-600">Loading items...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-600 text-lg">No items found</p>
          <p className="text-gray-500 text-sm mt-2">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map(item => (
            <Link
              key={item.id}
              to={`/item/${item.id}`}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition transform hover:-translate-y-1"
            >
              <div className="aspect-square bg-gray-200 flex items-center justify-center">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl">👗</span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg text-jirai-black mb-1 truncate">
                  {item.name}
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  {item.brand_name || 'Unknown Brand'}
                </p>
                {item.price && (
                  <p className="text-jirai-pink font-bold">
                    ¥{item.price.toLocaleString()}
                  </p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.tags && item.tags.slice(0, 3).map(tag => (
                    <span
                      key={tag.id}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"
                    >
                      {tag.name}
                    </span>
                  ))}
                  {item.tags && item.tags.length > 3 && (
                    <span className="text-xs text-gray-500">
                      +{item.tags.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default Catalog;
