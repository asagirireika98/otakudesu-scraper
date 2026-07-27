import { getGistConfig, getGistContent, updateGist } from '../github/gist.js';

interface TrackedConfig {
  anime: { slug: string; name: string }[];
  settings: {
    max_episodes_per_anime: number;
    preferred_quality: string;
  };
}

const DEFAULT_CONFIG: TrackedConfig = {
  anime: [],
  settings: {
    max_episodes_per_anime: 50,
    preferred_quality: '720p',
  },
};

export async function loadTrackedFromGist(): Promise<TrackedConfig> {
  const config = getGistConfig();
  if (!config) return DEFAULT_CONFIG;

  const content = await getGistContent(config, 'tracked-anime.json');
  if (!content) return DEFAULT_CONFIG;

  try {
    return JSON.parse(content) as TrackedConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveTrackedToGist(data: TrackedConfig): Promise<boolean> {
  const config = getGistConfig();
  if (!config) return false;

  try {
    await updateGist(config, {
      'tracked-anime.json': { content: JSON.stringify(data, null, 2) },
    });
    return true;
  } catch (error) {
    console.error('Failed to save tracked-anime.json to Gist:', (error as Error).message);
    return false;
  }
}
