import axios from 'axios';

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  thumbnail?: { url: string };
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

interface DiscordMessage {
  embeds: DiscordEmbed[];
}

export function getDiscordWebhookUrl(): string | null {
  return process.env.DISCORD_WEBHOOK_URL || null;
}

export async function sendNewEpisodeNotification(
  webhookUrl: string,
  animeName: string,
  episodeTitle: string,
  episodeUrl: string
): Promise<void> {
  const embed: DiscordEmbed = {
    title: `New Episode: ${animeName}`,
    description: episodeTitle,
    color: 0x00ff00,
    fields: [
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
    ],
    footer: {
      text: 'Otakudesu Scraper',
    },
    timestamp: new Date().toISOString(),
  };

  const message: DiscordMessage = {
    embeds: [embed],
  };

  try {
    await axios.post(webhookUrl, message);
    console.log(`Sent Discord notification for ${episodeTitle}`);
  } catch (error) {
    console.error(`Failed to send Discord notification: ${(error as Error).message}`);
  }
}

export async function sendBatchNotification(
  webhookUrl: string,
  episodes: { animeName: string; episodeTitle: string; episodeUrl: string }[]
): Promise<void> {
  if (episodes.length === 0) return;

  const embeds: DiscordEmbed[] = episodes.map(ep => ({
    title: ep.animeName,
    description: ep.episodeTitle,
    color: 0x00ff00,
    fields: [
      {
        name: 'Episode',
        value: ep.episodeTitle,
        inline: true,
      },
      {
        name: 'Link',
        value: `[Watch](${ep.episodeUrl})`,
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
  }));

  const message: DiscordMessage = {
    embeds: embeds.slice(0, 10),
  };

  try {
    await axios.post(webhookUrl, message);
    console.log(`Sent Discord batch notification for ${episodes.length} episodes`);
  } catch (error) {
    console.error(`Failed to send Discord batch notification: ${(error as Error).message}`);
  }
}
