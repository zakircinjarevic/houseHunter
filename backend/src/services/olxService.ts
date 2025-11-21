import axios from 'axios';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface OLXListing {
  id: string;
  title: string;
  description?: string;
  price: number;
  url: string;
  location?: string;
  images?: string[];
  type?: 'apartment' | 'house'; // Type of listing
}

export interface OLXApiResponse {
  data: OLXListing[];
  total: number;
  page: number;
  limit: number;
  per_page: number;
  last_page?: number;
  current_page?: number;
}

export class OLXService {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor() {
    this.baseUrl = config.olxApiBaseUrl;
    // Get access token from config
    this.accessToken = config.olxAccessToken || null;
  }

  /**
   * Set the access token for API requests
   */
  setAccessToken(token: string) {
    this.accessToken = token;
  }

  /**
   * Get authorization headers
   */
  private getAuthHeaders() {
    const headers: any = {
      'Accept': 'application/json',
    };
    
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    
    return headers;
  }

  /**
   * Fetch listings from OLX API with pagination
   * @param type - 'apartment' or 'house'
   * @param page - Page number (0-based)
   * @param limit - Number of items per page
   */
  async fetchListings(type: 'apartment' | 'house' = 'apartment', page: number = 0, limit: number = 50): Promise<OLXApiResponse> {
    try {
      // OLX API search endpoint
      const url = `${this.baseUrl}/search`;
      
      // Configure filters based on type
      let categoryId: number;
      let attr: string;
      
      if (type === 'apartment') {
        categoryId = 23; // Apartments/Stanovi i apartmani
        // Fixed filters: 60-100 sqm, 3 rooms (Trosoban), apartment (Stan), Kanton Sarajevo, price 100k-250k
        attr = '3130322836302d313030293a3130372854726f736f62616e20283329293a37343032285374616e29';
      } else {
        categoryId = 24; // Houses/Kuće
        // House filters: 61-100 sqm, Kanton Sarajevo, price 100k-250k
        attr = '37322836312d31303029';
      }
      
      const params: any = {
        category_id: categoryId,
        page: page + 1, // OLX API uses 1-based pagination
        per_page: limit, // OLX uses per_page, not limit
        attr,
        attr_encoded: '1',
        canton: 9, // Kanton Sarajevo
        cities: '',
        price_from: 100000, // Minimum price: 100,000 KM
        price_to: 250000, // Maximum price: 250,000 KM
        sort_by: 'date', // Sort by date
        sort_order: 'desc', // Newest first
      };

      logger.info(`Fetching OLX ${type} listings: page=${page + 1}, per_page=${limit}`);

      const response = await axios.get(url, { 
        params,
        headers: this.getAuthHeaders(),
      });

      // OLX API response structure: { data: [...], meta: {...}, filters: [...], aggregations: {...} }
      const rawListings = response.data.data || [];
      const meta = response.data.meta || {};

      // Transform response to match our interface
      const listings: OLXListing[] = rawListings.map((item: any) => {
        // Ensure ID is always a string (OLX API returns numbers)
        const listingId = String(item.id || '');
        
        // Handle location - OLX API returns object with lat/lon
        let locationString: string | null = null;
        if (item.location && typeof item.location === 'object') {
          // Format as coordinates since we don't have city name
          if (item.location.lat && item.location.lon) {
            locationString = `${item.location.lat.toFixed(6)},${item.location.lon.toFixed(6)}`;
          }
        }
        
        // Construct URL - OLX listing URLs follow pattern: https://olx.ba/artikal/{id}
        const listingUrl = item.url || `https://olx.ba/artikal/${listingId}`;
        
        return {
          id: listingId,
          title: item.title || 'No title',
          description: undefined, // OLX API doesn't return description in listing list
          price: item.price || item.discounted_price_float || 0,
          url: listingUrl,
          location: locationString || undefined,
          images: item.images || [],
          type, // Store the type
        };
      });

      return {
        data: listings,
        total: meta.total || listings.length,
        page: meta.current_page ? meta.current_page - 1 : page, // Convert back to 0-based
        limit: meta.per_page || limit,
        per_page: meta.per_page || limit,
        last_page: meta.last_page,
        current_page: meta.current_page,
      };
    } catch (error: any) {
      logger.error('Error fetching OLX listings:', error.message);
      if (error.response) {
        logger.error('Response status:', error.response.status);
        logger.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      // Return empty response on error
      return {
        data: [],
        total: 0,
        page,
        limit,
        per_page: limit,
      };
    }
  }

  /**
   * Fetch a single listing by ID
   */
  async fetchListingById(id: string): Promise<OLXListing | null> {
    try {
      const url = `${this.baseUrl}/listings/${id}`;
      const response = await axios.get(url, {
        headers: this.getAuthHeaders(),
      });

      const item = response.data.data || response.data;
      // Ensure ID is always a string
      const listingId = String(item.id || '');
      
      // Handle location - OLX API returns object with lat/lon
      let locationString: string | null = null;
      if (item.location && typeof item.location === 'object') {
        if (item.location.lat && item.location.lon) {
          locationString = `${item.location.lat.toFixed(6)},${item.location.lon.toFixed(6)}`;
        }
      }
      
      // Construct URL - OLX listing URLs follow pattern: https://olx.ba/artikal/{id}
      const listingUrl = item.url || `https://olx.ba/artikal/${listingId}`;
      
        return {
          id: listingId,
          title: item.title || 'No title',
          description: item.description || undefined,
          price: item.price || item.discounted_price_float || 0,
          url: listingUrl,
          location: locationString || undefined,
          images: item.images || [],
        };
    } catch (error: any) {
      logger.error(`Error fetching listing ${id}:`, error.message);
      return null;
    }
  }
}

export const olxService = new OLXService();

