import { Client, GatewayIntentBits, Events, Collection, TextChannel } from 'discord.js';
import {
  handleSearch,
  handleOngoing,
  handleAdd,
  handleRemove,
  handleList,
  handlePlaylist,
} from './handlers.js';

const commandHandlers = new Collection<string, Function>([
  ['search', handleSearch],
  ['ongoing', handleOngoing],
  ['add', handleAdd],
  ['remove', handleRemove],
  ['list', handleList],
  ['playlist', handlePlaylist],
]);

let client: Client | null = null;

export function getClient(): Client | null {
  return client;
}

export function getNotificationChannel(): TextChannel | null {
  if (!client) return null;
  const channelId = process.env.DISCORD_NOTIFY_CHANNEL_ID;
  if (!channelId) return null;
  return client.channels.cache.get(channelId) as TextChannel | undefined || null;
}

export function getMainChannel(): TextChannel | null {
  if (!client) return null;
  const channelId = process.env.DISCORD_MAIN_CHANNEL_ID;
  if (!channelId) return null;
  return client.channels.cache.get(channelId) as TextChannel | undefined || null;
}

export function startBot(token: string) {
  client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
    console.log(`Serving ${readyClient.guilds.cache.size} guild(s)`);

    const notifyId = process.env.DISCORD_NOTIFY_CHANNEL_ID;
    const mainId = process.env.DISCORD_MAIN_CHANNEL_ID;
    if (notifyId) console.log(`Notify channel: ${notifyId}`);
    if (mainId) console.log(`Main channel: ${mainId}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const handler = commandHandlers.get(interaction.commandName);
    if (!handler) return;

    try {
      await handler(interaction);
    } catch (error) {
      console.error(`Error handling /${interaction.commandName}:`, error);
      const reply = { content: 'An error occurred.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  });

  client.login(token);
}
