import dotenv from 'dotenv';
import path from 'path';

// Load .env file from backend directory
const envPath = path.resolve(__dirname, '../../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn(`[CONFIG] Warning: Could not load .env file from ${envPath}`);
} else {
  console.log(`[CONFIG] Loaded .env file from ${envPath}`);
}

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';

// Log token status (without exposing the full token)
if (telegramBotToken) {
  console.log(`[CONFIG] Telegram Bot Token loaded: ${telegramBotToken.substring(0, 10)}...`);
} else {
  console.warn('[CONFIG] TELEGRAM_BOT_TOKEN not found in environment variables');
}

export const config = {
  port: parseInt(process.env.PORT || '8080', 10), // Cloud Run uses 8080 by default
  databaseUrl: process.env.DATABASE_URL || 'file:./data/dev.db',
  olxApiBaseUrl: process.env.OLX_API_BASE_URL || 'https://api.olx.ba',
  olxClientId: process.env.OLX_CLIENT_ID || '',
  olxClientSecret: process.env.OLX_CLIENT_SECRET || '',
  olxAccessToken: process.env.OLX_ACCESS_TOKEN || '',
  telegramBotToken: telegramBotToken,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};

