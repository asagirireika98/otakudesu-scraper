import { loadEpisodes, loadTrackedAnime } from '../config.js';

interface M3UGeneratorOptions {
  mode?: 'worker' | 'direct';
  workerBaseUrl?: string;
  domain?: string;
  quality?: string;
}

export function generateM3U(options: M3UGeneratorOptions = {}): string {
  const {
    mode = 'worker',
    workerBaseUrl = 'https://otakudesu-worker.YOUR_SUBDOMAIN.workers.dev',
    domain = 'otakudesu.blog',
    quality = '720p',
  } = options;

  const episodesData = loadEpisodes();
  const config = loadTrackedAnime();
  const animeMap = new Map(config.anime.map(a => [a.slug, a.name]));

  const entries: string[] = [];

  for (const [animeSlug, episodes] of Object.entries(episodesData.episodes)) {
    const animeName = animeMap.get(animeSlug) || animeSlug;

    for (const [episodeSlug, episodeData] of Object.entries(episodes)) {
      const episodeNum = episodeData.episode_number || extractEpisodeNumber(episodeData.title);
      const displayTitle = `${animeName} Ep.${episodeNum} Sub Indo [${quality}]`;

      let streamUrl: string;
      if (mode === 'worker') {
        streamUrl = `${workerBaseUrl}/proxy?slug=${episodeSlug}&q=${quality}`;
      } else {
        streamUrl = `https://${domain}/episode/${episodeSlug}/`;
      }

      entries.push(`#EXTINF:-1 tvg-logo="" group-title="Ongoing",${displayTitle}`);
      entries.push(streamUrl);
    }
  }

  return `#EXTM3U\r\n${entries.join('\r\n')}\r\n`;
}

function extractEpisodeNumber(title: string): number {
  const match = title.match(/Episode\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}
