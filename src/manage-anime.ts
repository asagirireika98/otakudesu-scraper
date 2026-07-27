import axios from 'axios';
import * as cheerio from 'cheerio';
import { loadDomains } from './config.js';
import { loadTrackedFromGist, saveTrackedToGist } from './gist-config.js';

interface SearchResult {
  slug: string;
  name: string;
  url: string;
}

interface OngoingAnime {
  slug: string;
  name: string;
  episode: string;
  date: string;
  url: string;
}

function getHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
}

export async function searchAnime(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://otakudesu.blog/?s=${encodeURIComponent(query)}&post_type=anime`;
    const res = await axios.get(url, { timeout: 10000, headers: getHeaders() });
    const $ = cheerio.load(res.data);

    const results: SearchResult[] = [];

    $('ul.chivsrc li').each((_, el) => {
      const $el = $(el);
      const link = $el.find('h2 a').first();
      const href = link.attr('href') || '';
      const name = link.text().trim();

      const slugMatch = href.match(/\/anime\/([^/]+)\/?$/);
      if (slugMatch && name) {
        results.push({
          slug: slugMatch[1],
          name,
          url: href,
        });
      }
    });

    return results.slice(0, 12);
  } catch (error) {
    console.error(`Search failed: ${(error as Error).message}`);
    return [];
  }
}

export async function getOngoingAnime(): Promise<OngoingAnime[]> {
  const config = loadDomains();

  for (const domain of config.domains) {
    try {
      const baseUrl = `https://${domain}/ongoing-anime/`;
      const firstRes = await axios.get(baseUrl, { timeout: config.timeout_ms, headers: getHeaders() });
      const first$ = cheerio.load(firstRes.data);

      const lastPageText = first$('.pagination a.page-numbers').not('.next').not('.dots').last().text().trim();
      const maxPage = parseInt(lastPageText, 10) || 1;

      const results = parseOngoingPage(first$);

      for (let page = 2; page <= maxPage; page++) {
        try {
          const pageUrl = `${baseUrl}page/${page}/`;
          const res = await axios.get(pageUrl, { timeout: config.timeout_ms, headers: getHeaders() });
          const $ = cheerio.load(res.data);
          results.push(...parseOngoingPage($));
        } catch (err) {
          console.error(`Failed to fetch ongoing page ${page}: ${(err as Error).message}`);
        }
      }

      return results;
    } catch (error) {
      console.error(`Failed to fetch ongoing from ${domain}: ${(error as Error).message}`);
      continue;
    }
  }

  return [];
}

function parseOngoingPage($: cheerio.CheerioAPI): OngoingAnime[] {
  const results: OngoingAnime[] = [];

  $('.venz .detpost').each((_, el) => {
    const $el = $(el);
    const link = $el.find('.thumb a').first();
    const href = link.attr('href') || '';
    const name = $el.find('h2.jdlflm').text().trim();
    const episode = $el.find('.epz').text().trim().replace('Episode ', 'Ep. ');
    const date = $el.find('.newnime').text().trim();

    const slugMatch = href.match(/\/anime\/([^/]+)\/?$/);
    if (slugMatch && name) {
      results.push({
        slug: slugMatch[1],
        name,
        episode,
        date,
        url: href,
      });
    }
  });

  return results;
}

export function filterRecentOngoing(anime: OngoingAnime[], days: number = 14): OngoingAnime[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const months: Record<string, number> = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'Mei': 4, 'Jun': 5,
    'Jul': 6, 'Agu': 7, 'Sep': 8, 'Okt': 9, 'Nov': 10, 'Des': 11,
    'Januari': 0, 'Februari': 1, 'Maret': 2, 'April': 3,
    'Juni': 5, 'Juli': 6, 'Agustus': 7, 'September': 8,
    'Oktober': 9, 'November': 10, 'Desember': 11,
  };

  return anime.filter(a => {
    const parts = a.date.trim().split(' ');
    if (parts.length !== 2) return true;

    const day = parseInt(parts[0], 10);
    const monthKey = parts[1];
    const month = months[monthKey];

    if (isNaN(day) || month === undefined) return true;

    const year = now.getFullYear();
    const date = new Date(year, month, day);

    if (date > now) {
      date.setFullYear(year - 1);
    }

    return date >= cutoff;
  });
}

export async function addAnime(slug: string): Promise<{ success: boolean; name?: string; error?: string }> {
  const config = await loadTrackedFromGist();

  if (config.anime.some(a => a.slug === slug)) {
    return { success: false, error: `Already tracking: ${slug}` };
  }

  try {
    const url = `https://otakudesu.blog/anime/${slug}/`;
    const res = await axios.get(url, { timeout: 10000, headers: getHeaders() });
    const $ = cheerio.load(res.data);
    const name = $('h1 span').text().trim() || $('h1').first().text().trim();

    if (!name) {
      return { success: false, error: `Could not find anime name for slug: ${slug}` };
    }

    config.anime.push({ slug, name });
    const saved = await saveTrackedToGist(config);

    if (!saved) {
      return { success: false, error: 'Failed to save to Gist' };
    }

    return { success: true, name };
  } catch (error) {
    return { success: false, error: `Failed to fetch: ${(error as Error).message}` };
  }
}

export async function removeAnime(slug: string): Promise<{ success: boolean; error?: string }> {
  const config = await loadTrackedFromGist();
  const idx = config.anime.findIndex(a => a.slug === slug);

  if (idx === -1) {
    return { success: false, error: `Not tracking: ${slug}` };
  }

  config.anime.splice(idx, 1);
  const saved = await saveTrackedToGist(config);

  if (!saved) {
    return { success: false, error: 'Failed to save to Gist' };
  }

  return { success: true };
}

export async function listAnime(): Promise<{ slug: string; name: string }[]> {
  const config = await loadTrackedFromGist();
  return config.anime;
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

async function showOngoing() {
  console.log('Fetching ongoing anime...\n');

  const ongoing = await getOngoingAnime();

  if (ongoing.length === 0) {
    console.log('No ongoing anime found.');
    return;
  }

  const recent = filterRecentOngoing(ongoing, 14);
  const older = ongoing.filter(a => !recent.includes(a));
  const all = [...recent, ...older];

  let num = 1;

  console.log(`=== Recent (2 weeks) [${recent.length}] ===`);
  recent.forEach((a) => {
    console.log(`  ${num}. ${a.name}`);
    console.log(`     ${a.episode} | ${a.date} | slug: ${a.slug}`);
    num++;
  });

  if (older.length > 0) {
    console.log(`\n=== Older [${older.length}] ===`);
    older.forEach((a) => {
      console.log(`  ${num}. ${a.name}`);
      console.log(`     ${a.episode} | ${a.date} | slug: ${a.slug}`);
      num++;
    });
  }

  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const question = (q: string) => new Promise<string>(resolve => rl.question(q, resolve));

  const choice = await question('\nEnter number to add anime (or 0 to cancel): ');
  const idx = parseInt(choice, 10) - 1;

  if (idx >= 0 && idx < all.length) {
    const result = await addAnime(all[idx].slug);
    if (result.success) {
      console.log(`\nAdded: ${result.name} (${all[idx].slug})`);
    } else {
      console.log(`\nFailed: ${result.error}`);
    }
  }

  rl.close();
}

if (process.argv[1] && process.argv[1].includes('manage-anime')) {
  const command = process.argv[2];
  const arg = process.argv[3];

  if (command === 'search') {
    interactiveSearch();
  } else if (command === 'ongoing') {
    showOngoing();
  } else if (command === 'add' && arg) {
    addAnime(arg).then(r => console.log(r));
  } else if (command === 'remove' && arg) {
    removeAnime(arg).then(r => console.log(r));
  } else if (command === 'list') {
    listAnime().then(anime => {
      if (anime.length === 0) {
        console.log('No anime tracked yet.');
      } else {
        anime.forEach(a => console.log(`  - ${a.name} (${a.slug})`));
      }
    });
  } else {
    console.log('Usage:');
    console.log('  tsx src/manage-anime.ts search        # Search & add by name');
    console.log('  tsx src/manage-anime.ts ongoing       # List ongoing anime (2 weeks)');
    console.log('  tsx src/manage-anime.ts add <slug>    # Add by slug');
    console.log('  tsx src/manage-anime.ts remove <slug> # Remove by slug');
    console.log('  tsx src/manage-anime.ts list          # List tracked anime');
  }
}
