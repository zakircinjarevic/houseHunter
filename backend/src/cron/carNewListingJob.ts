import cron from 'node-cron';
import { carSyncService } from '../services/carSyncService';
import { logger } from '../utils/logger';

export function startCarNewListingJob() {
  logger.info('[Cars] Starting car new listing check cron job (every 1 minute)');

  carSyncService.checkForNewCarListings();

  cron.schedule('*/1 * * * *', async () => {
    await carSyncService.checkForNewCarListings();
  });
}
