import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

const configPath = join(process.cwd(), 'config', 'tracked-anime.json');

interface TrackedConfig {
  anime: { slug: string; name: string }[];
  settings: {
    max_episodes_per_anime: number;
    preferred_quality: string;
  };
}

interface SearchResult {
  slug: string;
  name: string;
  url: string;
}

export function loadConfig(): TrackedConfig {
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

export function saveConfig(config: TrackedConfig): void {
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

export async function searchAnime(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://otakudesu.blog/?s=${encodeURIComponent(query)}&post_type=anime`;
    const res = await axios.get(url, { timeout: 10000, headers });
    const $ = cheerio.load(res.data);

    const results: SearchResult[] = [];

    $('.venz .detpost').each((_, el) => {
      const $el = $(el);
      const link = $el.find('a').first();
      const href = link.attr('href') || '';
      const name = $el.find('h2.jdlflm').text().trim();

      const slugMatch = href.match(/\/anime\/([^/]+)\/?$/);
      if (slugMatch && name) {
        results.push({
          slug: slugMatch[1],
          name,
          url: href,
        });
      }
    });

    return results.slice(0, 10);
  } catch (error) {
    console.error(`Search failed: ${(error as Error).message}`);
    return [];
  }
}

export async function addAnime(slug: string): Promise<{ success: boolean; name?: string; error?: string }> {
  const config = loadConfig();

  if (config.anime.some(a => a.slug === slug)) {
    return { success: false, error: `Already tracking: ${slug}` };
  }

  try {
    const url = `https://otakudesu.blog/anime/${slug}/`;
    const res = await axios.get(url, { timeout: 10000, headers });
    const $ = cheerio.load(res.data);
    const name = $('h1 span').text().trim() || $('h1').first().text().trim();

    if (!name) {
      return { success: false, error: `Could not find anime name for slug: ${slug}` };
    }

    config.anime.push({ slug, name });
    saveConfig(config);

    return { success: true, name };
  } catch (error) {
    return { success: false, error: `Failed to fetch: ${(error as Error).message}` };
  }
}

export function removeAnime(slug: string): { success: boolean; error?: string } {
  const config = loadConfig();
  const idx = config.anime.findIndex(a => a.slug === slug);

  if (idx === -1) {
    return { success: false, error: `Not tracking: ${slug}` };
  }

  config.anime.splice(idx, 1);
  saveConfig(config);

  return { success: true };
}

export function listAnime(): { slug: string; name: string }[] {
  return loadConfig().anime;
}

async function interactiveSearch() {
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const question = (q: string) => new Promise<string>(resolve => rl.question(q, resolve));

  const query = await question('Search anime name: ');
  console.log(`\nSearching for "${query}"...\n`);

  const results = await searchAnime(query);

  if (results.length === 0) {
    console.log('No results found.');
    rl.close();
    return;
  }

  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.name}`);
    console.log(`     slug: ${r.slug}`);
  });

  const choice = await question('\nEnter number to add (or 0 to cancel): ');
  const idx = parseInt(choice, 10) - 1;

  if (idx >= 0 && idx < results.length) {
    const result = await addAnime(results[idx].slug);
    if (result.success) {
      console.log(`\nAdded: ${result.name} (${results[idx].slug})`);
    } else {
      console.log(`\nFailed: ${result.error}`);
    }
  } else {
    console.log('Cancelled.');
  }

  rl.close();
}

if (process.argv[1] && process.argv[1].includes('manage-anime')) {
  const command = process.argv[2];
  const arg = process.argv[3];

  if (command === 'search') {
    interactiveSearch();
  } else if (command === 'add' && arg) {
    addAnime(arg).then(r => console.log(r));
  } else if (command === 'remove' && arg) {
    console.log(removeAnime(arg));
  } else if (command === 'list') {
    const anime = listAnime();
    if (anime.length === 0) {
      console.log('No anime tracked yet.');
    } else {
      anime.forEach(a => console.log(`  - ${a.name} (${a.slug})`));
    }
  } else {
    console.log('Usage:');
    console.log('  tsx src/manage-anime.ts search        # Search & add by name');
    console.log('  tsx src/manage-anime.ts add <slug>    # Add by slug');
    console.log('  tsx src/manage-anime.ts remove <slug> # Remove by slug');
    console.log('  tsx src/manage-anime.ts list          # List tracked anime');
  }
}
