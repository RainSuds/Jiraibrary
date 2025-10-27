import axios from 'axios';

const API_URL = '/api';

// Items
export const getItems = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.category) params.append('category', filters.category);
  if (filters.brand) params.append('brand', filters.brand);
  if (filters.tags) params.append('tags', filters.tags);
  if (filters.search) params.append('search', filters.search);
  
  return axios.get(`${API_URL}/items?${params.toString()}`);
};

export const getItem = (id) => axios.get(`${API_URL}/items/${id}`);
export const createItem = (data) => axios.post(`${API_URL}/items`, data);
export const updateItem = (id, data) => axios.put(`${API_URL}/items/${id}`, data);
export const deleteItem = (id) => axios.delete(`${API_URL}/items/${id}`);

// Categories
export const getCategories = () => axios.get(`${API_URL}/categories`);
export const getCategory = (id) => axios.get(`${API_URL}/categories/${id}`);
export const createCategory = (data) => axios.post(`${API_URL}/categories`, data);
export const updateCategory = (id, data) => axios.put(`${API_URL}/categories/${id}`, data);
export const deleteCategory = (id) => axios.delete(`${API_URL}/categories/${id}`);

// Brands
export const getBrands = () => axios.get(`${API_URL}/brands`);
export const getBrand = (id) => axios.get(`${API_URL}/brands/${id}`);
export const createBrand = (data) => axios.post(`${API_URL}/brands`, data);
export const updateBrand = (id, data) => axios.put(`${API_URL}/brands/${id}`, data);
export const deleteBrand = (id) => axios.delete(`${API_URL}/brands/${id}`);

// Tags
export const getTags = () => axios.get(`${API_URL}/tags`);
export const getTag = (id) => axios.get(`${API_URL}/tags/${id}`);
export const createTag = (data) => axios.post(`${API_URL}/tags`, data);
export const updateTag = (id, data) => axios.put(`${API_URL}/tags/${id}`, data);
export const deleteTag = (id) => axios.delete(`${API_URL}/tags/${id}`);

// Upload
export const uploadImage = (formData) => axios.post(`${API_URL}/upload`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
