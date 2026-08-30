import { carOlxService, CarOLXListing } from './carOlxService';
import { logger } from '../utils/logger';
import prisma from '../db/prisma';

const MILEAGE_THRESHOLD = 5000;

export class CarSyncService {
  private carOffset: number = 0;
  private lastCarBackfillTime: Date | null = null;
  private lastCarCheckTime: Date | null = null;
  private notificationEnabled: boolean = false;

  private shouldNotify(listing: CarOLXListing): boolean {
    // Notify for all listings where mileage is unknown OR mileage > threshold
    if (listing.mileage === undefined || listing.mileage === null) return true;
    return listing.mileage > MILEAGE_THRESHOLD;
  }

  async initialCarBackfill(): Promise<void> {
    try {
      const limit = 50;
      const page = Math.floor(this.carOffset / limit);

      logger.info(`[Cars] Starting backfill at offset ${this.carOffset}, page ${page}`);

      const response = await carOlxService.fetchCarListings(page, limit);

      if (response.data.length === 0) {
        if (response.last_page && response.current_page && response.current_page >= response.last_page) {
          logger.info(`[Cars] Reached last page (${response.last_page}), resetting offset`);
          this.carOffset = 0;
        }
        return;
      }

      if (response.last_page && response.current_page && response.current_page >= response.last_page) {
        logger.info(`[Cars] Reached last page (${response.last_page}), will reset after this batch`);
        this.carOffset = 0;
      } else {
        this.carOffset += response.data.length;
      }

      let newCount = 0;
      for (const listing of response.data) {
        const exists = await prisma.carListing.findUnique({ where: { id: listing.id } });
        if (!exists) newCount++;
        await this.upsertCarListing(listing);
      }

      this.lastCarBackfillTime = new Date();
      logger.info(`[Cars] Backfill complete: ${newCount} new, ${response.data.length - newCount} updated, page ${page + 1}`);
    } catch (error: any) {
      logger.error('[Cars] Error in backfill:', error.message);
    }
  }

  async checkForNewCarListings(): Promise<void> {
    try {
      logger.info('[Cars] Checking for new car listings...');
      const response = await carOlxService.fetchCarListings(0, 50);

      if (response.data.length === 0) {
        logger.info('[Cars] No car listings found');
        return;
      }

      const toNotify: CarOLXListing[] = [];

      for (const listing of response.data) {
        const existing = await prisma.carListing.findUnique({ where: { id: listing.id } });

        if (!existing) {
          await this.upsertCarListing(listing);
          if (this.shouldNotify(listing)) toNotify.push(listing);
        } else {
          if (!existing.notifiedAt && this.shouldNotify(listing)) {
            toNotify.push(listing);
          } else if (existing.priceAtNotification && listing.price < existing.priceAtNotification) {
            toNotify.push(listing);
          }
          await this.upsertCarListing(listing);
        }
      }

      this.lastCarCheckTime = new Date();
      logger.info(`[Cars] Check done: ${response.data.length} checked, ${toNotify.length} to notify`);

      if (this.notificationEnabled && toNotify.length > 0) {
        // Import here to avoid circular deps at module load time
        const { carTelegramService } = await import('./carTelegramService');
        for (const listing of toNotify) {
          await carTelegramService.sendCarAlert(listing);
        }
      }
    } catch (error: any) {
      logger.error('[Cars] Error checking for new listings:', error.message);
    }
  }

  /**
   * Mark all unnotified listings as notified so new users aren't spammed.
   * Called once when the first CarBotUser registers.
   */
  async sealExistingListings(): Promise<void> {
    const now = new Date();
    const result = await prisma.carListing.updateMany({
      where: { notifiedAt: null },
      data: { notifiedAt: now, priceAtNotification: undefined },
    });
    this.notificationEnabled = true;
    logger.info(`[Cars] Sealed ${result.count} existing listings. Notifications now enabled.`);
  }

  enableNotifications(): void {
    this.notificationEnabled = true;
    logger.info('[Cars] Notifications enabled (pre-seeded flow).');
  }

  isNotificationEnabled(): boolean {
    return this.notificationEnabled;
  }

  private async upsertCarListing(listing: CarOLXListing): Promise<void> {
    await prisma.carListing.upsert({
      where: { id: listing.id },
      create: {
        id: listing.id,
        title: listing.title,
        price: listing.price,
        url: listing.url,
        location: listing.location ?? null,
        images: JSON.stringify(listing.images || []),
        mileage: listing.mileage ?? null,
        year: listing.year ?? null,
        lastSeen: new Date(),
      },
      update: {
        title: listing.title,
        price: listing.price,
        url: listing.url,
        location: listing.location ?? null,
        images: JSON.stringify(listing.images || []),
        mileage: listing.mileage ?? null,
        year: listing.year ?? null,
        lastSeen: new Date(),
      },
    });
  }

  getCarStatus() {
    return {
      carOffset: this.carOffset,
      lastCarBackfillTime: this.lastCarBackfillTime,
      lastCarCheckTime: this.lastCarCheckTime,
      notificationEnabled: this.notificationEnabled,
    };
  }
}

export const carSyncService = new CarSyncService();
