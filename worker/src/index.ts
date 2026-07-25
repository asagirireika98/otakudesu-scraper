export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/stream') {
      return this.handleStream(url, env);
    }

    if (url.pathname === '/proxy') {
      return this.handleProxy(request, url, env);
    }

    if (url.pathname === '/debug') {
      return this.handleDebug(url, env);
    }

    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  },

  async handleStream(url: URL, env: Env): Promise<Response> {
    const slug = url.searchParams.get('slug');
    const quality = url.searchParams.get('q') || '720p';

    if (!slug) {
      return new Response('Missing slug parameter', { status: 400 });
    }

    try {
      const videoUrl = await this.resolveVideoUrl(slug, quality, env);
      return Response.redirect(videoUrl, 302);
    } catch (error) {
      console.error(`Failed to resolve ${slug}: ${error}`);
      return new Response(`Failed to resolve: ${(error as Error).message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  },

  async handleProxy(request: Request, url: URL, env: Env): Promise<Response> {
    const slug = url.searchParams.get('slug');
    const quality = url.searchParams.get('q') || '720p';

    if (!slug) {
      return new Response('Missing slug parameter', { status: 400 });
    }

    try {
      const videoUrl = await this.resolveVideoUrl(slug, quality, env);
      const videoResponse = await fetch(videoUrl, {
        headers: {
          'User-Agent': env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://otakudesu.blog/',
        },
      });

      if (!videoResponse.ok) {
        return new Response(`Upstream returned ${videoResponse.status}`, { status: 502 });
      }

      const headers = new Headers();
      const contentType = videoResponse.headers.get('Content-Type') || 'video/mp4';
      headers.set('Content-Type', contentType);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Cache-Control', 'public, max-age=3600');

      const contentLength = videoResponse.headers.get('Content-Length');
      if (contentLength) {
        headers.set('Content-Length', contentLength);
      }

      if (request.method === 'HEAD') {
        return new Response(null, { status: 200, headers });
      }

      const range = request.headers.get('Range');
      if (range) {
        const rangeHeaders: Record<string, string> = {
          'User-Agent': env.USER_AGENT || 'Mozilla/5.0',
          'Referer': 'https://otakudesu.blog/',
          'Range': range,
        };

        const rangeResponse = await fetch(videoUrl, { headers: rangeHeaders });

        if (rangeResponse.status === 206) {
          const rangeReturnHeaders = new Headers();
          rangeReturnHeaders.set('Content-Type', contentType);
          rangeReturnHeaders.set('Content-Range', rangeResponse.headers.get('Content-Range') || '');
          rangeReturnHeaders.set('Content-Length', rangeResponse.headers.get('Content-Length') || '0');
          rangeReturnHeaders.set('Accept-Ranges', 'bytes');
          rangeReturnHeaders.set('Access-Control-Allow-Origin', '*');

          return new Response(rangeResponse.body, {
            status: 206,
            headers: rangeReturnHeaders,
          });
        }
      }

      headers.set('Accept-Ranges', 'bytes');

      return new Response(videoResponse.body, {
        status: 200,
        headers,
      });
    } catch (error) {
      console.error(`Failed to proxy ${slug}: ${error}`);
      return new Response(`Failed to proxy: ${(error as Error).message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  },

  async handleDebug(url: URL, env: Env): Promise<Response> {
    const slug = url.searchParams.get('slug') || 'okcm-episode-1-sub-indo';
    const quality = url.searchParams.get('q') || '720p';

    try {
      const videoUrl = await this.resolveVideoUrl(slug, quality, env);
      return new Response(JSON.stringify({ slug, quality, videoUrl }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },

  async resolveVideoUrl(slug: string, quality: string, env: Env): Promise<string> {
    const domains = (env.OTAKUDESU_DOMAINS || 'otakudesu.blog').split(',');
    const userAgent = env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    for (const domain of domains) {
      try {
        return await this.resolveFromDomain(domain.trim(), slug, quality, userAgent);
      } catch (error) {
        console.error(`Failed to resolve from ${domain}: ${error}`);
        continue;
      }
    }

    throw new Error('Failed to resolve video URL from all domains');
  },

  async resolveFromDomain(
    domain: string,
    slug: string,
    quality: string,
    userAgent: string
  ): Promise<string> {
    const episodeUrl = `https://${domain}/episode/${slug}/`;
    const episodeResponse = await fetch(episodeUrl, {
      headers: { 'User-Agent': userAgent },
    });

    if (!episodeResponse.ok) {
      throw new Error(`Failed to fetch episode page: ${episodeResponse.status}`);
    }

    const episodeHtml = await episodeResponse.text();
    const mirrorData = this.extractMirrorData(episodeHtml, quality);

    let playerUrl: string;

    if (mirrorData.length > 0) {
      const nonce = await this.fetchNonce(domain, userAgent);
      const iframeHtml = await this.resolveMirror(domain, mirrorData[0], nonce, userAgent);
      playerUrl = this.extractIframeSrc(iframeHtml);
    } else {
      console.log(`No data-content mirrors for ${quality}, using default iframe`);
      const defaultIframe = episodeHtml.match(/<iframe[^>]+src="([^"]+)"[^>]*>/i);
      if (!defaultIframe) {
        throw new Error(`No mirrors found for quality ${quality} and no default iframe`);
      }
      playerUrl = defaultIframe[1];
    }

    console.log(`Player URL: ${playerUrl}`);

    const videoUrl = await this.resolvePlayerUrl(playerUrl, userAgent);
    console.log(`Final video URL: ${videoUrl.substring(0, 80)}...`);

    return videoUrl;
  },

  async resolvePlayerUrl(playerUrl: string, userAgent: string): Promise<string> {
    const response = await fetch(playerUrl, {
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://otakudesu.blog/',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch player page: ${response.status}`);
    }

    const html = await response.text();

    const allUrls = [...new Set((html.match(/https?:\/\/[^\s"'<>]+/g) || []))];
    for (const u of allUrls) {
      if (u.includes('.m3u8') || (u.includes('.mp4') && !u.includes('mime='))) {
        return u;
      }
    }

    const videoHosts = ['googlevideo.com', 'blogger.com', 'fbcdn'];
    const directUrl = allUrls.find(u => videoHosts.some(h => u.includes(h)));
    if (directUrl) {
      return directUrl;
    }

    const sourceMatch = html.match(/<source[^>]+src=["']([^"']+)["']/i);
    if (sourceMatch) {
      return sourceMatch[1];
    }

    const fileMatch = html.match(/file\s*[:=]\s*["'](https?:\/\/[^"']+)["']/);
    if (fileMatch) {
      return fileMatch[1];
    }

    const srcMatch = html.match(/src\s*[:=]\s*["'](https?:\/\/[^"']+)["']/);
    if (srcMatch) {
      const nestedUrl = srcMatch[1];
      console.log(`Following nested URL: ${nestedUrl}`);
      const nestedResponse = await fetch(nestedUrl, {
        headers: {
          'User-Agent': userAgent,
          'Referer': playerUrl,
        },
      });

      if (nestedResponse.ok) {
        const nestedHtml = await nestedResponse.text();
        const nestedM3u8 = nestedHtml.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
        if (nestedM3u8) return nestedM3u8[0];

        const nestedMp4 = nestedHtml.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/);
        if (nestedMp4) return nestedMp4[0];
      }
    }

    throw new Error('Could not extract video stream URL from player page');
  },

  extractMirrorData(html: string, quality: string): string[] {
    const mirrors: string[] = [];
    const regex = new RegExp(`data-content="([^"]+)"`, 'g');
    let match;

    while ((match = regex.exec(html)) !== null) {
      try {
        const decoded = atob(match[1]);
        const data = JSON.parse(decoded);
        if (data.q === quality) {
          mirrors.push(match[1]);
        }
      } catch {
        continue;
      }
    }

    return mirrors;
  },

  async fetchNonce(domain: string, userAgent: string): Promise<string> {
    const response = await fetch(`https://${domain}/wp-admin/admin-ajax.php`, {
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'action=aa1208d27f29ca340c92c66d1926f13f',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch nonce: ${response.status}`);
    }

    const result = await response.json() as { data: string };
    return result.data;
  },

  async resolveMirror(
    domain: string,
    mirrorData: string,
    nonce: string,
    userAgent: string
  ): Promise<string> {
    const decoded = JSON.parse(atob(mirrorData));

    const params = new URLSearchParams({
      ...decoded,
      nonce,
      action: '2a3505c93b0035d3f455df82bf976b84',
    });

    const response = await fetch(`https://${domain}/wp-admin/admin-ajax.php`, {
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to resolve mirror: ${response.status}`);
    }

    const result = await response.json() as { data: string };
    return atob(result.data);
  },

  extractIframeSrc(iframeHtml: string): string {
    const srcMatch = iframeHtml.match(/src="([^"]+)"/);
    if (!srcMatch) {
      throw new Error('No iframe src found in mirror response');
    }
    return srcMatch[1];
  },
};
