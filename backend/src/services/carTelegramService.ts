import axios from 'axios';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { CarOLXListing } from './carOlxService';
import prisma from '../db/prisma';

export class CarTelegramService {
  private botToken: string;
  private apiUrl: string;

  constructor() {
    this.botToken = config.carTelegramBotToken || '';
    if (!this.botToken) {
      logger.warn('[CarTelegramService] CAR_TELEGRAM_BOT_TOKEN not configured.');
    } else {
      logger.info(`[CarTelegramService] Bot token loaded: ${this.botToken.substring(0, 10)}...`);
    }
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  async sendMessage(chatId: string, message: string): Promise<{ success: boolean; error?: string }> {
    if (!this.botToken) {
      return { success: false, error: 'Car bot token not configured' };
    }
    try {
      await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: String(chatId),
        text: message,
        parse_mode: 'HTML',
      });
      return { success: true };
    } catch (error: any) {
      const msg = error.response?.data?.description || error.message;
      logger.error(`[CarBot] Error sending to ${chatId}:`, msg);
      return { success: false, error: msg };
    }
  }

  async getUpdates(offset?: number): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/getUpdates`, {
        params: { offset, timeout: 10 },
      });
      return response.data;
    } catch (error: any) {
      logger.error('[CarBot] Error getting updates:', error.message);
      return null;
    }
  }

  private formatCarAlert(listing: CarOLXListing): string {
    const parts = ['🚗 NOV OGLAS AUTOMOBILA'];
    parts.push('');
    parts.push(`<b>${listing.title}</b>`);
    parts.push(`💰 ${listing.price.toLocaleString()} KM`);
    if (listing.mileage !== undefined) parts.push(`🛣️ ${listing.mileage.toLocaleString()} km`);
    if (listing.year !== undefined) parts.push(`📅 ${listing.year}`);
    if (listing.location) parts.push(`📍 ${listing.location}`);
    parts.push('');
    parts.push(`<a href="${listing.url}">${listing.url}</a>`);
    return parts.join('\n');
  }

  async sendCarAlert(listing: CarOLXListing): Promise<void> {
    const existing = await prisma.carListing.findUnique({
      where: { id: listing.id },
      select: { notifiedAt: true, priceAtNotification: true },
    });

    if (existing?.notifiedAt) {
      // Check for price drop
      if (existing.priceAtNotification && listing.price < existing.priceAtNotification) {
        const message = `📉 SMANJENA CIJENA - ${listing.title}\nSa ${existing.priceAtNotification.toLocaleString()} na ${listing.price.toLocaleString()} KM\n\n<a href="${listing.url}">${listing.url}</a>`;
        await this.broadcastToAll(message);
        await prisma.carListing.update({
          where: { id: listing.id },
          data: { notifiedAt: new Date(), priceAtNotification: listing.price },
        });
      }
      return;
    }

    const message = this.formatCarAlert(listing);
    const sent = await this.broadcastToAll(message);

    await prisma.carListing.update({
      where: { id: listing.id },
      data: { notifiedAt: new Date(), priceAtNotification: listing.price },
    });

    logger.info(`[CarBot] Alerted ${sent} users for car listing ${listing.id}`);
  }

  private async broadcastToAll(message: string): Promise<number> {
    const users = await prisma.carBotUser.findMany();
    let count = 0;
    for (const user of users) {
      const result = await this.sendMessage(user.telegramId, message);
      if (result.success) count++;
    }
    return count;
  }

  async handleMessage(update: any): Promise<void> {
    if (!update.message?.text) return;

    const message = update.message;
    const chatId = String(message.chat.id);
    const text = message.text.trim();
    const firstName = message.from?.first_name || message.from?.username || 'korisniče';

    if (text === '/start' || text.startsWith('/start ')) {
      try {
        const existing = await prisma.carBotUser.findUnique({ where: { telegramId: chatId } });

        if (existing) {
          await this.sendMessage(chatId, `Već si prijavljen/a, ${existing.username || firstName}! 🚗\nPrimat ćeš obavijesti za nove automobile.`);
          return;
        }

        // Register the user
        await prisma.carBotUser.create({
          data: { telegramId: chatId, username: firstName },
        });

        // If this is the first user, seal all existing listings
        const userCount = await prisma.carBotUser.count();
        if (userCount === 1) {
          const { carSyncService } = await import('./carSyncService');
          await carSyncService.sealExistingListings();
          logger.info('[CarBot] First user registered - existing listings sealed, notifications enabled.');
        }

        await this.sendMessage(
          chatId,
          `Zdravo ${firstName}! 🚗\n\nUspješno si prijavljen/a.\nDobijat ćeš obavijesti za svaki novi oglas automobila (koristeni, kilometraža > ${5000} km).`
        );
        logger.info(`[CarBot] Registered new user: ${chatId} (${firstName})`);
      } catch (error: any) {
        logger.error(`[CarBot] Error handling /start for ${chatId}:`, error.message);
        await this.sendMessage(chatId, 'Greška. Molimo pokušajte ponovo.');
      }
    }
  }
}

export const carTelegramService = new CarTelegramService();
