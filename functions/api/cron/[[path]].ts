/**
 * Cron trigger handler - runs every 15 minutes to refresh GitHub data cache
 * Updates KV cache with fresh profile, pinned repos, and contributions data
 */

import { AppEnv } from '../../_shared/auth';
import { getProfile, getPinned, getContributions, writeCache, CACHE_TTL } from '../../_shared/github';

// Extend AppEnv with the KV namespace for this handler
type CronEnv = AppEnv & { GITHUB_CACHE: KVNamespace };

const GH_USERNAME = 'd4x3d';

async function getCacheFresh<T>(env: CronEnv, key: string): Promise<T | null> {
  const raw = await env.GITHUB_CACHE.get(key);
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as { data: T; updatedAt: number };
    return Date.now() - entry.updatedAt < CACHE_TTL ? entry.data : null;
  } catch { return null; }
}

export async function onRequest(context: { request: Request; env: CronEnv }) {
  const { env } = context;
  const username = env.GITHUB_USERNAME || GH_USERNAME;

  const results = { profile: false, pinned: false, contributions: false, timestamp: Date.now() };

  // Check if cache is still fresh - if so, skip
  const profileCached = await getCacheFresh<Awaited<ReturnType<typeof getProfile>>>(env, `profile:${username}`);
  const pinnedCached = await getCacheFresh<Awaited<ReturnType<typeof getPinned>>>(env, `pinned:${username}`);
  const contribCached = await getCacheFresh<Awaited<ReturnType<typeof getContributions>>>(env, `contributions:${username}`);

  if (profileCached && pinnedCached && contribCached) {
    return new Response(JSON.stringify({ status: 'skipped', reason: 'cache_fresh', ...results }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const profile = await getProfile(env, username);
    await writeCache(env, `profile:${username}`, profile);
    results.profile = true;
  } catch (e) { console.error('Profile error:', e); }

  try {
    const pinned = await getPinned(env, username, 6);
    await writeCache(env, `pinned:${username}`, pinned);
    results.pinned = true;
  } catch (e) { console.error('Pinned error:', e); }

  try {
    const contribs = await getContributions(env, username);
    await writeCache(env, `contributions:${username}`, contribs);
    results.contributions = true;
  } catch (e) { console.error('Contributions error:', e); }

  return new Response(JSON.stringify({ status: 'updated', ...results }), {
    headers: { 'content-type': 'application/json' },
  });
}