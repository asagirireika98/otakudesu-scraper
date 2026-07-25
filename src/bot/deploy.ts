import 'dotenv/config';
import { deployCommands } from './commands.js';

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error('Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID in .env');
  process.exit(1);
}

deployCommands(token, clientId, guildId);
