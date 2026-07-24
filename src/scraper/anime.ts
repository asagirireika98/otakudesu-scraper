import axios from 'axios';
import * as cheerio from 'cheerio';
import { loadDomains, type DomainConfig } from '../config.js';

export interface AnimeInfo {
  title: string;
  slug: string;
  episodes: EpisodeLink[];
}

export interface EpisodeLink {
  title: string;
  slug: string;
  url: string;
  date: string;
}

async function fetchWithRetry(url: string, config: DomainConfig): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.retry_count; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout: config.timeout_ms,
        headers: {
          'User-Agent': config.user_agent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
        },
      });
      return response.data;
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt + 1} failed for ${url}: ${lastError.message}`);
      if (attempt < config.retry_count) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${config.retry_count + 1} attempts`);
}

export async function getAnimePage(slug: string): Promise<AnimeInfo> {
  const config = loadDomains();

  for (const domain of config.domains) {
    try {
      const url = `https://${domain}/anime/${slug}/`;
      const html = await fetchWithRetry(url, config);
      return parseAnimePage(html, slug, domain);
    } catch (error) {
      console.error(`Failed to fetch from ${domain}: ${(error as Error).message}`);
      continue;
    }
  }

  throw new Error(`Failed to fetch anime page for ${slug} from all domains`);
}

function parseAnimePage(html: string, slug: string, domain: string): AnimeInfo {
  const $ = cheerio.load(html);

  const title = $('h1 span').text().trim() ||
    $('h1').first().text().trim() ||
    $('title').text().split('|')[0].trim();

  const episodes: EpisodeLink[] = [];

  $('.episodelist ul li').each((_, element) => {
    const $el = $(element);
    const link = $el.find('a');
    const href = link.attr('href') || '';
    const episodeTitle = link.text().trim();
    const date = $el.find('.zeebr').text().trim();

    const episodeSlug = href.split('/episode/')[1]?.replace(/\/$/, '') || '';
    if (episodeSlug) {
      episodes.push({
        title: episodeTitle,
        slug: episodeSlug,
        url: href,
        date: date,
      });
    }
  });

  return {
    title,
    slug,
    episodes: episodes.reverse(),
  };
}

export async function getEpisodePage(episodeSlug: string): Promise<{
  mirrorData: string[];
  iframeSrc: string | null;
}> {
  const config = loadDomains();

  for (const domain of config.domains) {
    try {
      const url = `https://${domain}/episode/${episodeSlug}/`;
      const html = await fetchWithRetry(url, config);
      return parseEpisodePage(html);
    } catch (error) {
      console.error(`Failed to fetch episode from ${domain}: ${(error as Error).message}`);
      continue;
    }
  }

  throw new Error(`Failed to fetch episode page for ${episodeSlug} from all domains`);
}

function parseEpisodePage(html: string): {
  mirrorData: string[];
  iframeSrc: string | null;
} {
  const $ = cheerio.load(html);

  const mirrorData: string[] = [];
  $('.mirrorstream a[href="#"]').each((_, element) => {
    const dataContent = $(element).attr('data-content');
    if (dataContent) {
      mirrorData.push(dataContent);
    }
  });

  const iframeSrc = $('iframe').first().attr('src') || null;

  return { mirrorData, iframeSrc };
}
