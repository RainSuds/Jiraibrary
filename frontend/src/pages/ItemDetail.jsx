import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getItem } from '../services/api';

function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItem();
  }, [id]);

  const loadItem = async () => {
    setLoading(true);
    try {
      const response = await getItem(id);
      setItem(response.data);
    } catch (error) {
      console.error('Error loading item:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-jirai-pink"></div>
        <p className="mt-4 text-gray-600">Loading item...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow-md">
        <p className="text-gray-600 text-lg">Item not found</p>
        <Link to="/" className="text-jirai-pink hover:underline mt-4 inline-block">
          Back to Catalog
        </Link>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="mb-6 text-jirai-pink hover:underline flex items-center gap-2"
      >
        ← Back
      </button>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
          {/* Image */}
          <div className="aspect-square bg-gray-200 flex items-center justify-center rounded-lg overflow-hidden">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-9xl">👗</span>
            )}
          </div>

          {/* Details */}
          <div>
            <h1 className="text-3xl font-bold text-jirai-black mb-4">
              {item.name}
            </h1>

            {item.brand_name && (
              <p className="text-lg text-gray-600 mb-2">
                <span className="font-semibold">Brand:</span> {item.brand_name}
              </p>
            )}

            {item.category_name && (
              <p className="text-lg text-gray-600 mb-2">
                <span className="font-semibold">Category:</span> {item.category_name}
              </p>
            )}

            {item.price && (
              <p className="text-2xl font-bold text-jirai-pink mb-4">
                ¥{item.price.toLocaleString()}
              </p>
            )}

            {item.description && (
              <div className="mb-6">
                <h2 className="font-semibold text-lg mb-2">Description</h2>
                <p className="text-gray-700 leading-relaxed">
                  {item.description}
                </p>
              </div>
            )}

            {item.tags && item.tags.length > 0 && (
              <div className="mb-6">
                <h2 className="font-semibold text-lg mb-2">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {item.tags.map(tag => (
                    <span
                      key={tag.id}
                      className="bg-jirai-pink text-white px-3 py-1 rounded-full text-sm"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {item.purchase_url && (
              <a
                href={item.purchase_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-jirai-pink text-white px-6 py-3 rounded-lg hover:bg-pink-600 transition font-semibold"
              >
                View on Store 🛍️
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ItemDetail;
