import 'dotenv/config';
import { scrapeAll } from './scraper/index.js';
import { generateM3U } from './playlist/m3u.js';
import { getGistConfig, verifyToken, updateGist, createGist } from './github/gist.js';
import { getDiscordWebhookUrl, sendBatchNotification, testWebhook } from './notify/discord.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function main(): Promise<void> {
  console.log('Starting otakudesu scraper...');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  try {
    const webhookUrl = getDiscordWebhookUrl();
    if (webhookUrl) {
      await testWebhook(webhookUrl);
    }

    const scrapeResult = await scrapeAll();

    console.log(`\nScrape completed:`);
    console.log(`  Anime scraped: ${scrapeResult.anime.length}`);
    console.log(`  New episodes found: ${scrapeResult.newEpisodes.length}`);

    const m3uMode = (process.env.M3U_MODE as 'worker' | 'direct') || 'worker';
    const workerBaseUrl = process.env.WORKER_BASE_URL || '';
    const m3uContent = generateM3U({
      mode: m3uMode,
      workerBaseUrl: workerBaseUrl || undefined,
    });

    const outputDir = join(process.cwd(), 'output');
    mkdirSync(outputDir, { recursive: true });
    const m3uPath = join(outputDir, 'anime.m3u');
    writeFileSync(m3uPath, m3uContent);
    console.log(`\nM3U saved to: ${m3uPath}`);

    const gistConfig = getGistConfig();
    let gistId = gistConfig?.gistId;
    if (gistConfig) {
      const tokenValid = await verifyToken(gistConfig);
      if (tokenValid) {
        try {
          await updateGist(gistConfig, {
            'anime.m3u': { content: m3uContent },
            'episodes.json': { content: JSON.stringify(scrapeResult.updatedEpisodes, null, 2) },
          });
          console.log('Updated Gist with new episodes and M3U playlist');
        } catch (error) {
          console.error('Gist update failed:', (error as Error).message);
          console.log('Attempting to create a new Gist...');
          try {
            const newId = await createGist(
              gistConfig,
              {
                'anime.m3u': { content: m3uContent },
                'episodes.json': { content: JSON.stringify(scrapeResult.updatedEpisodes, null, 2) },
              },
              'Otakudesu Anime Playlist'
            );
            if (newId) {
              gistId = newId;
              console.log(`\nNew Gist created: ${newId}`);
              console.log(`Update GIST_ID in .env to: ${newId}`);
            }
          } catch (createErr) {
            console.error('Create gist also failed:', (createErr as Error).message);
          }
        }
      }
    } else {
      console.log('Skipped Gist update (missing env vars)');
    }

    const playlistUrl = gistId
      ? `https://gist.githubusercontent.com/asagirireika98/${gistId}/raw/anime.m3u`
      : undefined;

    if (scrapeResult.newEpisodes.length > 0 && webhookUrl) {
      const notifications = scrapeResult.newEpisodes.map(({ anime, episode }) => ({
        animeName: anime.name,
        episodeTitle: episode.title,
        episodeUrl: episode.url,
      }));
      await sendBatchNotification(webhookUrl, notifications, playlistUrl);
    } else if (webhookUrl && scrapeResult.newEpisodes.length === 0) {
      console.log('No new episodes, skipping notification');
    } else if (!webhookUrl) {
      console.log('Skipped Discord notification (webhook not set)');
    }

    console.log('\nScraper completed successfully');
  } catch (error) {
    console.error('Scraper failed:', error);
    process.exit(1);
  }
}

main();
