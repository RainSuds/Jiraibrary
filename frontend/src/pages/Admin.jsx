import React, { useState, useEffect } from 'react';
import {
  getItems,
  getCategories,
  getBrands,
  getTags,
  createItem,
  updateItem,
  deleteItem,
  createCategory,
  createBrand,
  createTag,
  uploadImage
} from '../services/api';

function Admin() {
  const [activeTab, setActiveTab] = useState('items');
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [tags, setTags] = useState([]);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    brand_id: '',
    category_id: '',
    price: '',
    image_url: '',
    purchase_url: '',
    tag_ids: []
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [itemsRes, catsRes, brandsRes, tagsRes] = await Promise.all([
        getItems(),
        getCategories(),
        getBrands(),
        getTags()
      ]);
      setItems(itemsRes.data);
      setCategories(catsRes.data);
      setBrands(brandsRes.data);
      setTags(tagsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTagToggle = (tagId) => {
    setFormData(prev => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter(id => id !== tagId)
        : [...prev.tag_ids, tagId]
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('image', file);

    try {
      const response = await uploadImage(formDataUpload);
      setFormData(prev => ({ ...prev, image_url: response.data.imageUrl }));
      alert('Image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitItem = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        brand_id: formData.brand_id || null,
        category_id: formData.category_id || null,
        price: formData.price ? parseFloat(formData.price) : null
      };

      if (editingItem) {
        await updateItem(editingItem.id, data);
        alert('Item updated successfully!');
      } else {
        await createItem(data);
        alert('Item created successfully!');
      }

      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save item');
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      brand_id: item.brand_id || '',
      category_id: item.category_id || '',
      price: item.price || '',
      image_url: item.image_url || '',
      purchase_url: item.purchase_url || '',
      tag_ids: item.tags.map(t => t.id)
    });
    setShowItemForm(true);
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await deleteItem(id);
      alert('Item deleted successfully!');
      loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      brand_id: '',
      category_id: '',
      price: '',
      image_url: '',
      purchase_url: '',
      tag_ids: []
    });
    setEditingItem(null);
    setShowItemForm(false);
  };

  // Quick add functions for categories, brands, and tags
  const handleQuickAdd = async (type) => {
    const name = prompt(`Enter ${type} name:`);
    if (!name) return;

    try {
      if (type === 'category') {
        await createCategory({ name, description: '' });
      } else if (type === 'brand') {
        await createBrand({ name, description: '', website: '' });
      } else if (type === 'tag') {
        await createTag({ name });
      }
      alert(`${type} added successfully!`);
      loadData();
    } catch (error) {
      console.error(`Error adding ${type}:`, error);
      alert(`Failed to add ${type}`);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-jirai-black">
          🔐 Admin Dashboard
        </h1>
        <button
          onClick={() => setShowItemForm(true)}
          className="bg-jirai-pink text-white px-6 py-2 rounded-lg hover:bg-pink-600 transition font-semibold"
        >
          + Add New Item
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {['items', 'categories', 'brands', 'tags'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-jirai-pink text-jirai-pink'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'items' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(item => (
                  <div key={item.id} className="border rounded-lg p-4 hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg">{item.name}</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditItem(item)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {item.brand_name} • {item.category_name}
                    </p>
                    {item.price && (
                      <p className="text-jirai-pink font-bold">
                        ¥{item.price.toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div>
              <button
                onClick={() => handleQuickAdd('category')}
                className="mb-4 bg-jirai-pink text-white px-4 py-2 rounded hover:bg-pink-600"
              >
                + Add Category
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(cat => (
                  <div key={cat.id} className="border rounded-lg p-4">
                    <h3 className="font-semibold">{cat.name}</h3>
                    {cat.description && (
                      <p className="text-sm text-gray-600 mt-1">{cat.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'brands' && (
            <div>
              <button
                onClick={() => handleQuickAdd('brand')}
                className="mb-4 bg-jirai-pink text-white px-4 py-2 rounded hover:bg-pink-600"
              >
                + Add Brand
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {brands.map(brand => (
                  <div key={brand.id} className="border rounded-lg p-4">
                    <h3 className="font-semibold">{brand.name}</h3>
                    {brand.description && (
                      <p className="text-sm text-gray-600 mt-1">{brand.description}</p>
                    )}
                    {brand.website && (
                      <a
                        href={brand.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-jirai-pink hover:underline mt-1 block"
                      >
                        Visit Website
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'tags' && (
            <div>
              <button
                onClick={() => handleQuickAdd('tag')}
                className="mb-4 bg-jirai-pink text-white px-4 py-2 rounded hover:bg-pink-600"
              >
                + Add Tag
              </button>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <span
                    key={tag.id}
                    className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Item Form Modal */}
      {showItemForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">
                  {editingItem ? 'Edit Item' : 'Add New Item'}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmitItem} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-jirai-pink"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-jirai-pink"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      name="category_id"
                      value={formData.category_id}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-jirai-pink"
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Brand
                    </label>
                    <select
                      name="brand_id"
                      value={formData.brand_id}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-jirai-pink"
                    >
                      <option value="">Select Brand</option>
                      {brands.map(brand => (
                        <option key={brand.id} value={brand.id}>{brand.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (¥)
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-jirai-pink"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Image Upload
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-jirai-pink"
                  />
                  {uploading && <p className="text-sm text-gray-500 mt-1">Uploading...</p>}
                  {formData.image_url && (
                    <p className="text-sm text-green-600 mt-1">Image: {formData.image_url}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purchase URL
                  </label>
                  <input
                    type="url"
                    name="purchase_url"
                    value={formData.purchase_url}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-jirai-pink"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleTagToggle(tag.id)}
                        className={`px-3 py-1 rounded-full text-sm transition ${
                          formData.tag_ids.includes(tag.id)
                            ? 'bg-jirai-pink text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-jirai-pink text-white py-2 rounded-lg hover:bg-pink-600 transition font-semibold"
                  >
                    {editingItem ? 'Update Item' : 'Create Item'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
