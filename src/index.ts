import { scrapeAll } from './scraper/index.js';
import { generateM3U } from './playlist/m3u.js';
import { getGistConfig, updateGist } from './github/gist.js';
import { getDiscordWebhookUrl, sendBatchNotification } from './notify/discord.js';
import { loadEpisodes } from './config.js';

async function main(): Promise<void> {
  console.log('Starting otakudesu scraper...');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  try {
    const scrapeResult = await scrapeAll();

    console.log(`\nScrape completed:`);
    console.log(`  Anime scraped: ${scrapeResult.anime.length}`);
    console.log(`  New episodes found: ${scrapeResult.newEpisodes.length}`);

    if (scrapeResult.newEpisodes.length > 0) {
      const workerBaseUrl = process.env.WORKER_BASE_URL || 'https://otakudesu-worker.YOUR_SUBDOMAIN.workers.dev';
      const m3uContent = generateM3U({ workerBaseUrl });

      const gistConfig = getGistConfig();
      await updateGist(gistConfig, {
        'anime.m3u': { content: m3uContent },
        'episodes.json': { content: JSON.stringify(scrapeResult.updatedEpisodes, null, 2) },
      });

      const webhookUrl = getDiscordWebhookUrl();
      if (webhookUrl) {
        const notifications = scrapeResult.newEpisodes.map(({ anime, episode }) => ({
          animeName: anime.name,
          episodeTitle: episode.title,
          episodeUrl: episode.url,
        }));

        await sendBatchNotification(webhookUrl, notifications);
      }

      console.log('\nUpdated Gist with new episodes and M3U playlist');
    } else {
      console.log('\nNo new episodes to update');
    }

    console.log('\nScraper completed successfully');
  } catch (error) {
    console.error('Scraper failed:', error);
    process.exit(1);
  }
}

main();
