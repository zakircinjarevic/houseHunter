import { carTelegramService } from './carTelegramService';
import { logger } from '../utils/logger';

export class CarTelegramPollingService {
  private lastUpdateId: number = 0;
  private isPolling: boolean = false;

  async startPolling(): Promise<void> {
    if (this.isPolling) {
      logger.warn('[CarBot] Polling already started');
      return;
    }
    this.isPolling = true;
    logger.info('[CarBot] Starting Telegram polling service');
    this.poll();
  }

  private async poll(): Promise<void> {
    while (this.isPolling) {
      try {
        const updates = await carTelegramService.getUpdates(
          this.lastUpdateId > 0 ? this.lastUpdateId + 1 : undefined
        );

        if (updates?.ok && updates.result) {
          for (const update of updates.result) {
            if (update.update_id >= this.lastUpdateId) {
              this.lastUpdateId = update.update_id;
            }
            await carTelegramService.handleMessage(update);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        logger.error('[CarBot] Polling error:', error.message);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  stopPolling(): void {
    this.isPolling = false;
    logger.info('[CarBot] Stopped polling');
  }
}

export const carTelegramPollingService = new CarTelegramPollingService();
