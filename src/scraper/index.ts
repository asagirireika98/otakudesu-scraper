import { loadTrackedAnime, loadEpisodes, saveEpisodes, type EpisodeData } from '../config.js';
import { getAnimePage, type AnimeInfo, type EpisodeLink } from './anime.js';

export interface ScrapeResult {
  anime: AnimeInfo[];
  newEpisodes: { anime: AnimeInfo; episode: EpisodeLink }[];
  updatedEpisodes: EpisodeData;
}

export async function scrapeAll(): Promise<ScrapeResult> {
  const config = loadTrackedAnime();
  const episodesData = loadEpisodes();
  const results: ScrapeResult = {
    anime: [],
    newEpisodes: [],
    updatedEpisodes: episodesData,
  };

  console.log(`Scraping ${config.anime.length} tracked anime...`);

  for (const animeConfig of config.anime) {
    try {
      console.log(`Fetching: ${animeConfig.name} (${animeConfig.slug})`);
      const anime = await getAnimePage(animeConfig.slug);
      results.anime.push(anime);

      const knownEpisodes = episodesData.episodes[animeConfig.slug] || {};
      const knownSlugs = new Set(Object.keys(knownEpisodes));

      const newEpisodes = anime.episodes.filter(ep => !knownSlugs.has(ep.slug));
      const limitedNew = newEpisodes.slice(0, config.settings.max_episodes_per_anime);

      for (const episode of limitedNew) {
        results.newEpisodes.push({ anime, episode });
        results.updatedEpisodes.episodes[animeConfig.slug] = {
          ...results.updatedEpisodes.episodes[animeConfig.slug],
          [episode.slug]: {
            title: episode.title,
            episode_number: extractEpisodeNumber(episode.title),
            url: episode.url,
            scraped_at: new Date().toISOString(),
          },
        };
      }

      if (newEpisodes.length > 0) {
        console.log(`  Found ${newEpisodes.length} new episodes (limited to ${limitedNew.length})`);
      } else {
        console.log(`  No new episodes`);
      }

      await sleep(1000);
    } catch (error) {
      console.error(`Failed to scrape ${animeConfig.name}: ${(error as Error).message}`);
    }
  }

  results.updatedEpisodes.last_updated = new Date().toISOString();
  saveEpisodes(results.updatedEpisodes);

  return results;
}

function extractEpisodeNumber(title: string): number {
  const match = title.match(/Episode\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
