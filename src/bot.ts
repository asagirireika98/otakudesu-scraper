import 'dotenv/config';
import { startBot } from './bot/index.js';

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.error('Missing DISCORD_BOT_TOKEN in .env');
  process.exit(1);
}

console.log('Starting Otakudesu Discord Bot...');
startBot(token);
