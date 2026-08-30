import axios from 'axios';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface CarOLXListing {
  id: string;
  title: string;
  description?: string;
  price: number;
  url: string;
  location?: string;
  images?: string[];
  mileage?: number;
  year?: number;
}

export interface CarOLXApiResponse {
  data: CarOLXListing[];
  total: number;
  page: number;
  per_page: number;
  last_page?: number;
  current_page?: number;
}

function extractParam(params: any[], keys: string[]): string | undefined {
  if (!Array.isArray(params)) return undefined;
  for (const key of keys) {
    const found = params.find((p: any) =>
      p.key === key || p.name === key || (p.label && p.label.toLowerCase().includes(key))
    );
    if (found) return found.value ?? found.normalized_value ?? found.label_value;
  }
  return undefined;
}

export class CarOLXService {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor() {
    this.baseUrl = config.olxApiBaseUrl;
    this.accessToken = config.olxAccessToken || null;
  }

  private getAuthHeaders() {
    const headers: any = { Accept: 'application/json' };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    return headers;
  }

  async fetchCarListings(page: number = 0, limit: number = 50): Promise<CarOLXApiResponse> {
    try {
      const url = `${this.baseUrl}/search`;
      const params: any = {
        category_id: 18, // Automobili
        state: 2,        // Polovan (used)
        price_from: 5000,
        page: page + 1,
        per_page: limit,
        sort_by: 'date',
        sort_order: 'desc',
      };

      logger.info(`Fetching OLX car listings: page=${page + 1}, per_page=${limit}`);

      const response = await axios.get(url, {
        params,
        headers: this.getAuthHeaders(),
      });

      const rawListings = response.data.data || [];
      const meta = response.data.meta || {};

      const listings: CarOLXListing[] = rawListings.map((item: any) => {
        const listingId = String(item.id || '');

        let locationString: string | undefined;
        if (item.location && typeof item.location === 'object') {
          if (item.location.lat && item.location.lon) {
            locationString = `${item.location.lat.toFixed(6)},${item.location.lon.toFixed(6)}`;
          } else if (item.location.city_name) {
            locationString = item.location.city_name;
          }
        }

        const listingUrl = item.url || `https://olx.ba/artikal/${listingId}`;

        // Try to extract mileage and year from item params/attrs
        const paramSources = item.params || item.attrs || item.attr_values || [];
        const mileageRaw = extractParam(paramSources, ['kilometraza', 'mileage', 'km', 'prijeđeni kilometri']);
        const yearRaw = extractParam(paramSources, ['godiste', 'year', 'godina', 'godina_proizvodnje']);

        const mileage = mileageRaw ? parseInt(String(mileageRaw).replace(/\D/g, ''), 10) || undefined : undefined;
        const year = yearRaw ? parseInt(String(yearRaw).replace(/\D/g, ''), 10) || undefined : undefined;

        return {
          id: listingId,
          title: item.title || 'No title',
          price: item.price || item.discounted_price_float || 0,
          url: listingUrl,
          location: locationString,
          images: item.images || [],
          mileage: mileage && !isNaN(mileage) ? mileage : undefined,
          year: year && !isNaN(year) && year > 1900 ? year : undefined,
        };
      });

      return {
        data: listings,
        total: meta.total || listings.length,
        page: meta.current_page ? meta.current_page - 1 : page,
        per_page: meta.per_page || limit,
        last_page: meta.last_page,
        current_page: meta.current_page,
      };
    } catch (error: any) {
      logger.error('Error fetching OLX car listings:', error.message);
      if (error.response) {
        logger.error('Response status:', error.response.status);
      }
      return { data: [], total: 0, page, per_page: limit };
    }
  }
}

export const carOlxService = new CarOLXService();
