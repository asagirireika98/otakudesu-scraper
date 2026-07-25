import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

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

export function loadTrackedAnime(): TrackedConfig {
  return JSON.parse(readFileSync(join(configDir, 'tracked-anime.json'), 'utf-8'));
}

export function loadEpisodes(): EpisodeData {
  return JSON.parse(readFileSync(join(dataDir, 'episodes.json'), 'utf-8'));
}

export function saveEpisodes(data: EpisodeData): void {
  writeFileSync(join(dataDir, 'episodes.json'), JSON.stringify(data, null, 2));
}

export type { DomainConfig, TrackedAnime, TrackedConfig, EpisodeData };
