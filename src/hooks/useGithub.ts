import { useEffect, useState } from 'react';
import * as api from '../lib/portfolioApi';

export type GhUser = {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  followers: number;
  html_url: string;
  location?: string | null;
  blog?: string | null;
};

export type PinnedRepo = {
  id: string | number;
  name: string;
  description: string | null;
  stargazerCount?: number;
  url?: string;
  html_url?: string;
  primaryLanguage?: { name: string; color: string } | null;
  language?: string | null;
};

export type ContributionDay = { date: string; contributionCount: number; color: string };

function readCache<T>(key: string): T | null {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; d: T };
    if (!parsed?.t || !parsed.d) return null;
    if (Date.now() - parsed.t > 600_000) return null;
    return parsed.d;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data }));
  } catch {
    // ignore cache errors
  }
}

export function useGithubProfile(username: string, pollMs = 600000) {
  const cacheKey = `gh:profile:${username || 'auto'}`;
  const [data, setData] = useState<GhUser | null>(readCache<GhUser>(cacheKey));
  const [loading, setLoading] = useState<boolean>(!Boolean(data));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const fetchOnce = async () => {
      if (!readCache<GhUser>(cacheKey)) setLoading(true);
      try {
        const next = await api.githubProfile(username);
        if (!alive) return;
        setData(next);
        writeCache(cacheKey, next);
      } catch (err) {
        if (alive) setError(String(err));
      } finally {
        if (alive) setLoading(false);
      }
    };

    void fetchOnce();
    const interval = pollMs ? setInterval(fetchOnce, pollMs) : null;

    return () => {
      alive = false;
      if (interval) clearInterval(interval);
    };
  }, [username, pollMs]);

  return { data, loading, error };
}

export function usePinnedRepos(username: string, pollMs = 600000) {
  const cacheKey = `gh:pinned:${username || 'auto'}`;
  const [data, setData] = useState<PinnedRepo[] | null>(readCache<PinnedRepo[]>(cacheKey));
  const [loading, setLoading] = useState<boolean>(!Boolean(data));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const fetchOnce = async () => {
      if (!readCache<PinnedRepo[]>(cacheKey)) setLoading(true);
      try {
        const next = await api.githubPinned(username, 6);
        if (!alive) return;
        setData(next);
        writeCache(cacheKey, next);
      } catch (err) {
        if (alive) setError(String(err));
      } finally {
        if (alive) setLoading(false);
      }
    };

    void fetchOnce();
    const interval = pollMs ? setInterval(fetchOnce, pollMs) : null;

    return () => {
      alive = false;
      if (interval) clearInterval(interval);
    };
  }, [username, pollMs]);

  return { data, loading, error, usesGraphql: true };
}

export function useContributions(username: string, pollMs = 600000) {
  const cacheKey = `gh:contrib:${username || 'auto'}`;
  const [days, setDays] = useState<ContributionDay[] | null>(readCache<ContributionDay[]>(cacheKey));
  const [loading, setLoading] = useState<boolean>(!Boolean(days));
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;

    const fetchOnce = async () => {
      if (!readCache<ContributionDay[]>(cacheKey)) setLoading(true);
      try {
        const payload = await api.githubContributions(username);
        if (!alive) return;
        setEnabled(Boolean(payload.enabled));
        setDays(payload.enabled ? payload.days || [] : null);
        writeCache(cacheKey, payload.enabled ? payload.days || [] : []);
      } catch (err) {
        if (alive) setError(String(err));
      } finally {
        if (alive) setLoading(false);
      }
    };

    void fetchOnce();
    const interval = pollMs ? setInterval(fetchOnce, pollMs) : null;

    return () => {
      alive = false;
      if (interval) clearInterval(interval);
    };
  }, [username, pollMs]);

  return { data: days, loading, error, enabled };
}

export function useGithubStatus() {
  const [data, setData] = useState<{ username: string; hasToken: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const value = await api.githubStatus();
        if (alive) setData(value);
      } catch {
        if (alive) setData(null);
      }
    };

    run();

    return () => {
      alive = false;
    };
  }, []);

  return data;
}
