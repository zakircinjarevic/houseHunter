import cron from 'node-cron';
import { carSyncService } from '../services/carSyncService';
import { logger } from '../utils/logger';

export function startCarBackfillJob() {
  logger.info('[Cars] Starting car backfill cron job (every 2 minutes)');

  carSyncService.initialCarBackfill();

  cron.schedule('*/2 * * * *', async () => {
    await carSyncService.initialCarBackfill();
  });
}
