import axios from 'axios';
import { getNotificationChannel } from '../bot/index.js';
import { EmbedBuilder, TextChannel } from 'discord.js';

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  thumbnail?: { url: string };
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

export function getDiscordWebhookUrl(): string | null {
  return process.env.DISCORD_WEBHOOK_URL || null;
}

export async function testWebhook(webhookUrl: string): Promise<boolean> {
  try {
    await axios.post(webhookUrl, {
      content: 'Otakudesu Scraper connected!',
    });
    console.log('Discord webhook test successful');
    return true;
  } catch (error) {
    console.error(`Discord webhook test failed: ${(error as Error).message}`);
    return false;
  }
}

export async function sendNewEpisodeNotification(
  webhookUrl: string,
  animeName: string,
  episodeTitle: string,
  episodeUrl: string,
  playlistUrl?: string
): Promise<void> {
  const fields: { name: string; value: string; inline?: boolean }[] = [
    {
      name: 'Episode',
      value: episodeTitle,
      inline: true,
    },
    {
      name: 'Link',
      value: `[Watch on Otakudesu](${episodeUrl})`,
      inline: true,
    },
  ];

  if (playlistUrl) {
    fields.push({
      name: 'Playlist',
      value: `[Open in VLC](${playlistUrl})`,
      inline: false,
    });
  }

  const embed: DiscordEmbed = {
    title: `New Episode: ${animeName}`,
    description: episodeTitle,
    color: 0x00ff00,
    fields,
    footer: { text: 'Otakudesu Scraper' },
    timestamp: new Date().toISOString(),
  };

  try {
    await axios.post(webhookUrl, { embeds: [embed] });
    console.log(`Sent Discord notification for ${episodeTitle}`);
  } catch (error) {
    console.error(`Failed to send Discord notification: ${(error as Error).message}`);
  }
}

export async function sendBatchNotification(
  webhookUrl: string,
  episodes: { animeName: string; episodeTitle: string; episodeUrl: string }[],
  playlistUrl?: string
): Promise<void> {
  if (episodes.length === 0) return;

  const embeds: DiscordEmbed[] = episodes.map(ep => ({
    title: ep.animeName,
    description: ep.episodeTitle,
    color: 0x00ff00,
    fields: [
      { name: 'Episode', value: ep.episodeTitle, inline: true },
      { name: 'Link', value: `[Watch](${ep.episodeUrl})`, inline: true },
    ],
    timestamp: new Date().toISOString(),
  }));

  const content = playlistUrl
    ? `**${episodes.length} new episode(s)!**\n[VLC Playlist](${playlistUrl})`
    : `**${episodes.length} new episode(s)!**`;

  try {
    await axios.post(webhookUrl, {
      content,
      embeds: embeds.slice(0, 10),
    });
    console.log(`Sent Discord batch notification for ${episodes.length} episodes`);
  } catch (error) {
    console.error(`Failed to send Discord batch notification: ${(error as Error).message}`);
  }
}

export async function sendBotNotification(
  episodes: { animeName: string; episodeTitle: string; episodeUrl: string }[],
  playlistUrl?: string
): Promise<void> {
  const channel = getNotificationChannel();
  if (!channel) return;

  if (episodes.length === 0) return;

  const embeds = episodes.map(ep =>
    new EmbedBuilder()
      .setTitle(ep.animeName)
      .setDescription(ep.episodeTitle)
      .setColor(0x57f287)
      .addFields(
        { name: 'Episode', value: ep.episodeTitle, inline: true },
        { name: 'Link', value: `[Watch](${ep.episodeUrl})`, inline: true }
      )
      .setTimestamp()
  );

  const content = playlistUrl
    ? `**${episodes.length} new episode(s)!**\n[VLC Playlist](${playlistUrl})`
    : `**${episodes.length} new episode(s)!**`;

  try {
    await channel.send({ content, embeds: embeds.slice(0, 10) });
    console.log(`Sent bot notification for ${episodes.length} episodes`);
  } catch (error) {
    console.error(`Failed to send bot notification: ${(error as Error).message}`);
  }
}

export async function sendStatusMessage(
  webhookUrl: string,
  message: string
): Promise<void> {
  try {
    await axios.post(webhookUrl, { content: message });
  } catch (error) {
    console.error(`Failed to send Discord status: ${(error as Error).message}`);
  }
}
