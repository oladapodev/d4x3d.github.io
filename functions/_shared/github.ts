/**
 * Shared GitHub fetch utilities for Cloudflare Workers
 * Used by both the GitHub API handler and the cron refresh handler
 */

import type { AppEnv } from './auth';

export interface GhUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  followers: number;
  html_url: string;
  location?: string | null;
  blog?: string | null;
}

export interface PinnedRepo {
  id: string | number;
  name: string;
  description: string | null;
  stargazerCount?: number;
  url?: string;
  html_url?: string;
  primaryLanguage?: { name: string; color: string } | null;
}

export interface ContributionDay {
  date: string;
  contributionCount: number;
  color: string;
}

export interface CacheEntry<T> {
  data: T;
  updatedAt: number;
}

export const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export async function fetchGitHub(url: string, token?: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'User-Agent': 'portfolio-app',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

export async function getProfile(env: AppEnv, username: string): Promise<GhUser> {
  return (await fetchGitHub(`https://api.github.com/users/${encodeURIComponent(username)}`, env.GITHUB_TOKEN)) as GhUser;
}

export async function getPinned(env: AppEnv, username: string, limit = 6): Promise<PinnedRepo[]> {
  if (!env.GITHUB_TOKEN) {
    const repos = (await fetchGitHub(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=${Number(limit) || 6}`,
      env.GITHUB_TOKEN
    )) as Array<{ id: string | number; name: string; description: string | null; stargazers_count: number; html_url: string; language: string | null }>;
    return repos.map((r) => ({
      id: r.id, name: r.name, description: r.description,
      stargazerCount: r.stargazers_count, url: r.html_url,
      primaryLanguage: r.language ? { name: r.language, color: '#999' } : null,
    }));
  }
  const gql = `query($login:String!,$n:Int!){ user(login:$login){ pinnedItems(first:$n, types:[REPOSITORY]){ nodes{ ... on Repository { id name description stargazerCount url primaryLanguage { name color } } } } } }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GITHUB_TOKEN}` },
    body: JSON.stringify({ query: gql, variables: { login: username, n: Number(limit) || 6 } }),
  });
  const json = await res.json() as { errors?: unknown; data?: { user?: { pinnedItems?: { nodes?: PinnedRepo[] } } } };
  if (json.errors) throw new Error('GitHub GraphQL error');
  return json.data?.user?.pinnedItems?.nodes || [];
}

export async function getContributions(env: AppEnv, username: string): Promise<ContributionDay[]> {
  if (!env.GITHUB_TOKEN) return [];
  const gql = `query($login:String!){ user(login:$login){ contributionsCollection { contributionCalendar { weeks { contributionDays { date contributionCount color } } } } } }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GITHUB_TOKEN}` },
    body: JSON.stringify({ query: gql, variables: { login: username } }),
  });
  const json = await res.json() as { errors?: unknown; data?: { user?: { contributionsCollection?: { contributionCalendar?: { weeks?: Array<{ contributionDays?: ContributionDay[] }> } } } } };
  if (json.errors) throw new Error('GitHub GraphQL error');
  const weeks = json.data?.user?.contributionsCollection?.contributionCalendar?.weeks || [];
  return weeks.flatMap((w) => w.contributionDays || []);
}

// KV cache helpers
export async function readCache<T>(env: AppEnv & { GITHUB_CACHE?: KVNamespace }, key: string): Promise<T | null> {
  if (!env.GITHUB_CACHE) return null;
  try {
    const raw = await env.GITHUB_CACHE.get(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    return Date.now() - entry.updatedAt < CACHE_TTL ? entry.data : null;
  } catch { return null; }
}

export async function writeCache<T>(env: AppEnv & { GITHUB_CACHE?: KVNamespace }, key: string, data: T): Promise<void> {
  if (!env.GITHUB_CACHE) return;
  try {
    const entry: CacheEntry<T> = { data, updatedAt: Date.now() };
    await env.GITHUB_CACHE.put(key, JSON.stringify(entry));
  } catch { /* ignore */ }
}