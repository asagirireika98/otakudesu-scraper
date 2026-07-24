import { loadEpisodes, loadTrackedAnime } from '../config.js';
import type { EpisodeData } from '../config.js';

interface M3UGeneratorOptions {
  workerBaseUrl: string;
  quality?: string;
}

export function generateM3U(options: M3UGeneratorOptions): string {
  const { workerBaseUrl, quality = '720p' } = options;
  const episodesData = loadEpisodes();
  const config = loadTrackedAnime();

  const lines: string[] = [
    '#EXTM3U',
    `# Generated: ${new Date().toISOString()}`,
    '',
  ];

  const animeMap = new Map(config.anime.map(a => [a.slug, a.name]));

  for (const [animeSlug, episodes] of Object.entries(episodesData.episodes)) {
    const animeName = animeMap.get(animeSlug) || animeSlug;

    for (const [episodeSlug, episodeData] of Object.entries(episodes)) {
      const episodeNum = episodeData.episode_number || extractEpisodeNumber(episodeData.title);
      const displayTitle = `${animeName} Ep.${episodeNum} Sub Indo [${quality}]`;

      const streamUrl = `${workerBaseUrl}/stream?slug=${episodeSlug}&q=${quality}`;

      lines.push(`#EXTINF:-1 group-title="Ongoing" tvg-logo="",${displayTitle}`);
      lines.push(streamUrl);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function extractEpisodeNumber(title: string): number {
  const match = title.match(/Episode\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}
