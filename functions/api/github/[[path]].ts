import { jsonResponse } from '../../_shared/response';
import { AppEnv } from '../../_shared/auth';
import { getProfile, getPinned, getContributions, readCache, writeCache } from '../../_shared/github';

type Action = 'profile' | 'pinned' | 'contributions' | 'status';

// Extend AppEnv with optional KV namespace
type GhEnv = AppEnv & { GITHUB_CACHE?: KVNamespace };

export async function onRequest(context: { request: Request; env: GhEnv }) {
  const { request, env } = context;

  if (request.method.toUpperCase() !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const action = url.pathname.replace('/api/github/', '').replace(/^\/+|\/+$/g, '') as Action;
  const username = url.searchParams.get('username') || env.GITHUB_USERNAME || 'd4x3d';

  try {
    if (action === 'profile') {
      const cached = await readCache(env, `profile:${username}`);
      if (cached) return jsonResponse(cached);
      const data = await getProfile(env, username);
      await writeCache(env, `profile:${username}`, data);
      return jsonResponse(data);
    }

    if (action === 'pinned') {
      const cached = await readCache(env, `pinned:${username}`);
      if (cached) return jsonResponse(cached);
      const limit = Number(url.searchParams.get('limit') || '6');
      const items = await getPinned(env, username, Number.isFinite(limit) ? limit : 6);
      await writeCache(env, `pinned:${username}`, items);
      return jsonResponse(items);
    }

    if (action === 'contributions') {
      const cached = await readCache(env, `contributions:${username}`);
      if (cached) return jsonResponse(cached);
      const days = await getContributions(env, username);
      const data = { enabled: Boolean(env.GITHUB_TOKEN), days };
      await writeCache(env, `contributions:${username}`, data);
      return jsonResponse(data);
    }

    if (action === 'status') {
      return jsonResponse({ username, hasToken: Boolean(env.GITHUB_TOKEN) });
    }

    return jsonResponse({ error: 'Unknown endpoint' }, 404);
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
}