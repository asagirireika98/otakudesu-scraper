interface GistConfig {
  gistId: string;
  token: string;
}

interface GistFiles {
  [filename: string]: { content: string };
}

export function getGistConfig(): GistConfig | null {
  const gistId = process.env.GIST_ID;
  const token = process.env.GH_PAT;

  if (!gistId || !token) {
    console.log('GIST_ID or GH_PAT not set, skipping Gist update');
    return null;
  }

  return { gistId, token };
}

export async function verifyToken(config: GistConfig): Promise<boolean> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) {
      console.log(`Token verify failed: ${res.status} ${await res.text()}`);
      return false;
    }
    const data = await res.json() as { login: string };
    const scopes = res.headers.get('x-oauth-scopes') || 'none';
    console.log(`Authenticated as: ${data.login}`);
    console.log(`Token scopes: ${scopes}`);
    return true;
  } catch (e) {
    console.log(`Token verify error: ${(e as Error).message}`);
    return false;
  }
}

export async function createGist(
  config: GistConfig,
  files: GistFiles,
  description: string,
  publicGist = false
): Promise<string | null> {
  const res = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ description, public: publicGist, files }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Create gist failed: ${res.status} ${body}`);
  }

  const data = await res.json() as { id: string; html_url: string };
  console.log(`Created gist: ${data.html_url}`);
  return data.id;
}

export async function updateGist(
  config: GistConfig,
  files: GistFiles
): Promise<void> {
  const res = await fetch(`https://api.github.com/gists/${config.gistId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Update gist failed: ${res.status} ${body}`);
  }

  console.log(`Updated gist ${config.gistId}`);
}

export async function getGistContent(
  config: GistConfig,
  filename: string
): Promise<string | null> {
  const res = await fetch(`https://api.github.com/gists/${config.gistId}`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!res.ok) return null;

  const data = await res.json() as { files?: Record<string, { content: string }> };
  return data.files?.[filename]?.content ?? null;
}
