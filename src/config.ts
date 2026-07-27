import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getGistConfig, getGistContent, updateGist } from './github/gist.js';

interface DomainConfig {
  domains: string[];
  timeout_ms: number;
  retry_count: number;
  user_agent: string;
}

interface TrackedAnime {
  slug: string;
  name: string;
}

interface TrackedConfig {
  anime: TrackedAnime[];
  settings: {
    max_episodes_per_anime: number;
    preferred_quality: string;
  };
}

interface EpisodeData {
  last_updated: string | null;
  episodes: Record<string, {
    title: string;
    episode_number: number;
    url: string;
    scraped_at: string;
    mirror_data?: string[];
  }>;
}

const configDir = join(process.cwd(), 'config');
const dataDir = join(process.cwd(), 'data');

export function loadDomains(): DomainConfig {
  return JSON.parse(readFileSync(join(configDir, 'domains.json'), 'utf-8'));
}

export async function loadTrackedAnime(): Promise<TrackedConfig> {
  const gistConfig = getGistConfig();
  if (gistConfig) {
    const content = await getGistContent(gistConfig, 'tracked-anime.json');
    if (content) {
      try {
        return JSON.parse(content) as TrackedConfig;
      } catch {}
    }
  }

  return JSON.parse(readFileSync(join(configDir, 'tracked-anime.json'), 'utf-8'));
}

export async function loadEpisodes(): Promise<EpisodeData> {
  const gistConfig = getGistConfig();
  if (gistConfig) {
    const content = await getGistContent(gistConfig, 'episodes.json');
    if (content) {
      try {
        return JSON.parse(content) as EpisodeData;
      } catch {}
    }
  }

  return JSON.parse(readFileSync(join(dataDir, 'episodes.json'), 'utf-8'));
}

export async function saveEpisodes(data: EpisodeData): Promise<void> {
  const gistConfig = getGistConfig();
  if (gistConfig) {
    try {
      await updateGist(gistConfig, {
        'episodes.json': { content: JSON.stringify(data, null, 2) },
      });
      return;
    } catch (error) {
      console.error('Failed to save episodes to Gist:', (error as Error).message);
    }
  }

  writeFileSync(join(dataDir, 'episodes.json'), JSON.stringify(data, null, 2));
}

export type { DomainConfig, TrackedAnime, TrackedConfig, EpisodeData };
