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
  fuelType?: string;
  transmission?: string;
  engineSize?: number;
  power?: number;
  viewCount?: number;
}

export interface CarOLXApiResponse {
  data: CarOLXListing[];
  total: number;
  page: number;
  per_page: number;
  last_page?: number;
  current_page?: number;
}

function findSpecialLabel(labels: any[], name: string): string | undefined {
  if (!Array.isArray(labels)) return undefined;
  const found = labels.find((l: any) => l.label === name);
  if (!found || found.value === null || found.value === undefined) return undefined;
  return String(found.value);
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

  async fetchCarListing(id: string): Promise<Partial<CarOLXListing>> {
    try {
      const response = await axios.get(`${this.baseUrl}/listings/${id}`, {
        headers: this.getAuthHeaders(),
      });
      const item = response.data;

      const attrs: any[] = item.attributes || [];
      const findAttr = (code: string) => attrs.find((a: any) => a.attr_code === code)?.value;

      const year = findAttr('godiste');
      const mileage = findAttr('kilometra-a'); // ž is encoded as -a in attr_code
      const fuelType = findAttr('gorivo');
      const transmission = findAttr('transmisija');
      const engineSize = findAttr('kubikaza');
      const power = findAttr('kilovata-kw');
      const location = item.cities?.[0]?.name ?? undefined;

      return {
        viewCount: typeof item.views === 'number' ? item.views : undefined,
        year: typeof year === 'number' && year > 1900 ? year : undefined,
        mileage: typeof mileage === 'number' ? mileage : undefined,
        fuelType: typeof fuelType === 'string' ? fuelType : undefined,
        transmission: typeof transmission === 'string' ? transmission : undefined,
        engineSize: typeof engineSize === 'number' ? engineSize : undefined,
        power: typeof power === 'number' ? power : undefined,
        location,
      };
    } catch (error: any) {
      logger.error(`[CarOLX] Error fetching listing ${id}:`, error.message);
      return {};
    }
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
        const listingUrl = item.url || `https://olx.ba/artikal/${listingId}`;

        // OLX search API returns structured car data in special_labels
        // e.g. [{ label: 'Gorivo', value: 'dizel' }, { label: 'Kilometraža', value: '243.228' }, { label: 'Godište', value: 2010 }]
        const specialLabels: any[] = item.special_labels || [];
        const fuelType = findSpecialLabel(specialLabels, 'Gorivo');
        const mileageStr = findSpecialLabel(specialLabels, 'Kilometraža');
        const yearStr = findSpecialLabel(specialLabels, 'Godište');

        // labels[1] is raw mileage integer (no formatting), prefer it over parsing the string
        const mileageRaw: number | undefined =
          Array.isArray(item.labels) && typeof item.labels[1] === 'number' ? item.labels[1] :
          mileageStr ? parseInt(mileageStr.replace(/\D/g, ''), 10) || undefined :
          undefined;

        const year = yearStr ? parseInt(yearStr.replace(/\D/g, ''), 10) || undefined : undefined;

        return {
          id: listingId,
          title: item.title || 'No title',
          price: item.price || item.discounted_price_float || 0,
          url: listingUrl,
          location: undefined, // not returned by OLX search API
          images: item.images || [],
          mileage: mileageRaw && !isNaN(mileageRaw) ? mileageRaw : undefined,
          year: year && !isNaN(year) && year > 1900 ? year : undefined,
          fuelType: fuelType ?? undefined,
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
