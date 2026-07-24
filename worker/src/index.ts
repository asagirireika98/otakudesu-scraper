export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/stream') {
      return this.handleStream(url, env);
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
      return new Response('Failed to resolve video URL', { status: 500 });
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

    if (mirrorData.length === 0) {
      throw new Error(`No mirrors found for quality ${quality}`);
    }

    const nonce = await this.fetchNonce(domain, userAgent);
    const iframeHtml = await this.resolveMirror(domain, mirrorData[0], nonce, userAgent);
    const videoUrl = this.extractVideoUrl(iframeHtml);

    return videoUrl;
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

  extractVideoUrl(iframeHtml: string): string {
    const srcMatch = iframeHtml.match(/src="([^"]+)"/);
    if (!srcMatch) {
      throw new Error('No iframe src found');
    }
    return srcMatch[1];
  },
};
