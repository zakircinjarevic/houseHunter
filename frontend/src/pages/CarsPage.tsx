import { useState, useEffect } from 'react';

interface CarListing {
  id: string;
  title: string;
  price: number;
  url: string;
  location?: string;
  images: string[];
  mileage?: number;
  year?: number;
  createdAt: string;
}

interface CarsResponse {
  listings: CarListing[];
  total: number;
  page: number;
  totalPages: number;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function fetchCarListings(page: number, limit: number): Promise<CarsResponse> {
  const res = await fetch(`${API_BASE}/api/car-listings?page=${page}&limit=${limit}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch car listings');
  return res.json();
}

export default function CarsPage() {
  const [listings, setListings] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    load();
  }, [page]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchCarListings(page, limit);
      setListings(data.listings || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Error loading car listings:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-US').format(price) + ' KM';

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString();

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900">🚗 Used Cars</h2>
        <p className="mt-2 text-sm text-gray-600">Total: {total} listings</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading car listings...</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">No car listings yet. Backfill is running...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                {listing.images && listing.images.length > 0 && (
                  <div className="h-48 bg-gray-200 flex items-center justify-center">
                    <img
                      src={listing.images[0]}
                      alt={listing.title}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                    {listing.title}
                  </h3>
                  <p className="text-2xl font-bold text-blue-600 mb-2">
                    {formatPrice(listing.price)}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {listing.mileage !== undefined && (
                      <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        🛣️ {listing.mileage.toLocaleString()} km
                      </span>
                    )}
                    {listing.year !== undefined && (
                      <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        📅 {listing.year}
                      </span>
                    )}
                  </div>
                  {listing.location && (
                    <p className="text-sm text-gray-600 mb-2">📍 {listing.location}</p>
                  )}
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-xs text-gray-400">{formatDate(listing.createdAt)}</span>
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View →
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-center items-center space-x-4">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-gray-600">
              Page {page + 1} of {Math.ceil(total / limit)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * limit >= total}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
