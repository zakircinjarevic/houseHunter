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
  viewCount?: number;
  fuelType?: string;
  engineSize?: string;
  transmission?: string;
  power?: string;
}

export interface CarOLXApiResponse {
  data: CarOLXListing[];
  total: number;
  page: number;
  per_page: number;
  last_page?: number;
  current_page?: number;
}

function resolveParamValue(raw: any): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'string' || typeof raw === 'number') return String(raw);
  // OLX often returns value as { key, label } or { key, label, value }
  if (typeof raw === 'object') {
    return raw.label ?? raw.value ?? raw.key ?? undefined;
  }
  return undefined;
}

function extractParam(params: any[], keys: string[]): string | undefined {
  if (!Array.isArray(params)) return undefined;
  for (const key of keys) {
    const lowerKey = key.toLowerCase();
    const found = params.find((p: any) =>
      p.key === key ||
      p.key === lowerKey ||
      p.name === key ||
      (p.name && p.name.toLowerCase() === lowerKey) ||
      (p.label && p.label.toLowerCase().includes(lowerKey))
    );
    if (found) {
      const resolved = resolveParamValue(found.value) ?? resolveParamValue(found.normalized_value) ?? resolveParamValue(found.label_value);
      if (resolved !== undefined) return resolved;
    }
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

      // Log raw params of first listing once to help debug extraction
      if (rawListings.length > 0 && page === 0) {
        const sample = rawListings[0];
        logger.info('[CarOLX] Sample raw params:', JSON.stringify(sample.params || sample.attrs || []));
        logger.info('[CarOLX] Sample raw location:', JSON.stringify(sample.location));
      }

      const listings: CarOLXListing[] = rawListings.map((item: any) => {
        const listingId = String(item.id || '');

        let locationString: string | undefined;
        if (item.location && typeof item.location === 'object') {
          // Try nested city object first (most common OLX structure)
          const cityName = item.location.city?.name ?? item.location.city_name ?? item.location.cityName;
          const regionName = item.location.region?.name ?? item.location.region_name;
          if (cityName) {
            locationString = regionName ? `${cityName}, ${regionName}` : cityName;
          } else if (item.location.lat && item.location.lon) {
            locationString = `${item.location.lat.toFixed(6)},${item.location.lon.toFixed(6)}`;
          }
        }

        const listingUrl = item.url || `https://olx.ba/artikal/${listingId}`;

        // Try to extract mileage and year from item params/attrs
        const paramSources = item.params || item.attrs || item.attr_values || [];
        const mileageRaw = extractParam(paramSources, ['mileage', 'kilometraza', 'km', 'Kilometraža', 'prijeđeni kilometri']);
        const yearRaw = extractParam(paramSources, ['model_year', 'godiste', 'year', 'Godište', 'godina', 'godina_proizvodnje']);

        const mileage = mileageRaw ? parseInt(String(mileageRaw).replace(/\D/g, ''), 10) || undefined : undefined;
        const year = yearRaw ? parseInt(String(yearRaw).replace(/\D/g, ''), 10) || undefined : undefined;

        const fuelTypeRaw = extractParam(paramSources, ['fuel_type', 'fuel', 'gorivo', 'Gorivo', 'vrsta_goriva', 'tip_goriva']);
        const engineSizeRaw = extractParam(paramSources, ['enginesize', 'engine_volume', 'kubikaza', 'Kubikaža', 'engine_size', 'zapremina', 'cm3', 'ccm']);
        const transmissionRaw = extractParam(paramSources, ['gearbox', 'transmission', 'mjenjac', 'Transmisija', 'vrsta_mjenjaca']);
        const powerRaw = extractParam(paramSources, ['engine_power', 'power', 'snaga', 'Snaga motora (KW)', 'kw', 'konjske_snage', 'ks']);

        const viewCount: number | undefined =
          typeof item.stats?.views === 'number' ? item.stats.views :
          typeof item.view_count === 'number' ? item.view_count :
          typeof item.views === 'number' ? item.views :
          undefined;

        return {
          id: listingId,
          title: item.title || 'No title',
          price: item.price || item.discounted_price_float || 0,
          url: listingUrl,
          location: locationString,
          images: item.images || [],
          mileage: mileage && !isNaN(mileage) ? mileage : undefined,
          year: year && !isNaN(year) && year > 1900 ? year : undefined,
          viewCount,
          fuelType: fuelTypeRaw ?? undefined,
          engineSize: engineSizeRaw ?? undefined,
          transmission: transmissionRaw ?? undefined,
          power: powerRaw ?? undefined,
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
