import { deleteCookie, jsonResponse, parseCookie, setCookie } from '../../_shared/response';
import { AppEnv, getUserFromSession, randomToken, normalizeViewer } from '../../_shared/auth';

const SESSION_COOKIE = 'portfolio_session';
const OAUTH_STATE_COOKIE = 'portfolio_oauth_state';

function getAction(pathname: string): string {
  return pathname.replace('/api/auth/', '').replace(/^\/+|\/+$/g, '') || 'session';
}

function buildFallbackRedirect(origin: string, redirect?: string | null) {
  if (!redirect) return `${origin}/#/blog`;
  if (redirect.startsWith('http://') || redirect.startsWith('https://')) return redirect;
  return `${origin}/${redirect.replace(/^\/+/, '')}`;
}

function redirectWithCookies(location: string, headers: Record<string, string | string[]> = {}) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export async function onRequest(context: { request: Request; env: AppEnv }) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = getAction(url.pathname);
  const method = request.method.toUpperCase();

  if (action === 'github/start') {
    if (method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

    const clientId = env.GITHUB_CLIENT_ID;
    if (!clientId) return jsonResponse({ error: 'Missing GITHUB_CLIENT_ID' }, 500);

    const redirect = new URLSearchParams(url.search).get('redirect');
    const callbackUrl = `${url.origin}/api/auth/github/callback`;
    const state = await randomToken(24);
    const oauthState = `${state}.${Date.now()}.${encodeURIComponent(redirect || '/#/blog')}`;

    const stateCookie = setCookie(OAUTH_STATE_COOKIE, oauthState, 10 * 60, {
      path: '/',
      secure: true,
      sameSite: 'Lax',
    });

    const ghUrl = new URL('https://github.com/login/oauth/authorize');
    ghUrl.searchParams.set('client_id', clientId);
    ghUrl.searchParams.set('redirect_uri', callbackUrl);
    ghUrl.searchParams.set('scope', 'read:user user:email');
    ghUrl.searchParams.set('state', state);

    return new Response(null, {
      status: 302,
      headers: {
        Location: ghUrl.toString(),
        'Set-Cookie': stateCookie,
        'cache-control': 'no-store',
      },
    });
  }

  if (action === 'github/callback') {
    if (method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const rawState = parseCookie(request.headers.get('cookie'), OAUTH_STATE_COOKIE);

    if (!code || !state) return jsonResponse({ error: 'Missing code/state' }, 400);
    const [, storedState, , encodedRedirect] = (rawState || '').split('.', 4);
    if (!storedState || state !== storedState) {
      return jsonResponse({ error: 'Invalid OAuth state' }, 400);
    }

    const clientId = env.GITHUB_CLIENT_ID;
    const clientSecret = env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return jsonResponse({ error: 'Missing OAuth credentials' }, 500);
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${url.origin}/api/auth/github/callback`,
      }),
    });

    if (!tokenRes.ok) {
      return jsonResponse({ error: 'Failed to exchange token' }, 500);
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token || tokenData.error) {
      return jsonResponse({ error: tokenData.error || 'OAuth exchange failed' }, 400);
    }

    const githubUserRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'portfolio-app',
      },
    });
    if (!githubUserRes.ok) return jsonResponse({ error: 'Unable to fetch GitHub user' }, 500);

    const githubUser = (await githubUserRes.json()) as {
      id: number;
      login: string;
      name?: string;
      email?: string;
      avatar_url?: string;
    };

    let email = githubUser.email || null;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'portfolio-app',
        },
      });
      if (emailRes.ok) {
        const emails = (await emailRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
        const primary = emails.find((entry) => entry.primary && entry.verified);
        if (primary?.email) email = primary.email;
      }
    }

    const githubId = String(githubUser.id);
    const now = Date.now();
    const existing = await env.DB
      .prepare('SELECT id, is_owner FROM users WHERE github_id = ?')
      .bind(githubId)
      .first<{ id: string; is_owner: number }>();

    const ownerByEnv = (() => {
      const envLogin = (env.OWNER_GITHUB_LOGIN || '').trim().toLowerCase();
      const envId = (env.OWNER_GITHUB_ID || '').trim();
      return (envLogin && envLogin === githubUser.login.toLowerCase()) || (envId && envId === githubId);
    })();

    const ownerRows = await env.DB
      .prepare('SELECT id FROM users WHERE is_owner = 1 LIMIT 1')
      .all<{ id: string }>();
    const hasOwner = (ownerRows.results?.length ?? 0) > 0;
    const isOwner = ownerByEnv || Boolean(existing?.is_owner) || (!hasOwner && !existing);

    const displayName = githubUser.name || githubUser.login;

    const userId = existing?.id || `${now.toString(36)}-${await randomToken(6)}`;
    if (existing) {
      await env.DB
        .prepare('UPDATE users SET name = ?, display_name = ?, email = ?, image = ?, is_owner = ?, last_seen = ?, github_username = ? WHERE id = ?')
        .bind(
          displayName,
          displayName,
          email,
          githubUser.avatar_url || '',
          isOwner ? 1 : 0,
          now,
          githubUser.login,
          existing.id,
        )
        .run();
    } else {
      await env.DB
        .prepare(
          'INSERT INTO users (id, github_id, github_username, name, display_name, email, image, is_owner, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          userId,
          githubId,
          githubUser.login,
          displayName,
          displayName,
          email,
          githubUser.avatar_url || '',
          isOwner ? 1 : 0,
          now,
          now,
        )
        .run();
    }

    const sessionId = await randomToken(32);
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
    await env.DB
      .prepare('INSERT INTO sessions (id, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(sessionId, userId, expiresAt, now, now)
      .run();

    const redirectTo = buildFallbackRedirect(url.origin, encodedRedirect ? decodeURIComponent(encodedRedirect) : null);

    const sessionCookie = setCookie(SESSION_COOKIE, sessionId, 7 * 24 * 60 * 60, {
      path: '/',
      secure: true,
      sameSite: 'Lax',
    });
    const clearOauthCookie = `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

    return redirectWithCookies(redirectTo, {
      'Set-Cookie': `${sessionCookie}, ${clearOauthCookie}`,
    });
  }

  if (action === 'session') {
    if (method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

    const sid = parseCookie(request.headers.get('cookie'), SESSION_COOKIE);
    if (!sid) return jsonResponse({ user: null }, 200);

    const viewer = await getUserFromSession(env, sid);
    return jsonResponse({ user: normalizeViewer(viewer) }, 200);
  }

  if (action === 'signout') {
    if (method !== 'POST' && method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

    const sid = parseCookie(request.headers.get('cookie'), SESSION_COOKIE);
    if (sid) {
      await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sid).run();
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'Set-Cookie': deleteCookie(SESSION_COOKIE),
        'cache-control': 'no-store',
      },
    });
  }

  if (action === 'ping') {
    return jsonResponse({ ok: true, now: Date.now() }, 200);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}
