import { Octokit } from 'octokit';

interface GistConfig {
  gistId: string;
  token: string;
}

interface GistFiles {
  [filename: string]: { content: string };
}

export function getGistConfig(): GistConfig {
  const gistId = process.env.GIST_ID;
  const token = process.env.GITHUB_TOKEN;

  if (!gistId || !token) {
    throw new Error('GIST_ID and GITHUB_TOKEN environment variables are required');
  }

  return { gistId, token };
}

export async function updateGist(
  config: GistConfig,
  files: GistFiles
): Promise<void> {
  const octokit = new Octokit({ auth: config.token });

  await octokit.rest.gists.update({
    gist_id: config.gistId,
    files,
  });

  console.log(`Updated gist ${config.gistId}`);
}

export async function getGistContent(
  config: GistConfig,
  filename: string
): Promise<string | null> {
  const octokit = new Octokit({ auth: config.token });

  const response = await octokit.rest.gists.get({
    gist_id: config.gistId,
  });

  const file = response.data.files?.[filename];
  if (file && 'content' in file) {
    return file.content;
  }

  return null;
}
