export type D1Like = {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => {
      first: <T = Record<string, any>>() => Promise<T | null>;
      all: <T = Record<string, any>>() => Promise<{ results: T[] }>;
      run: () => Promise<{ success: boolean }>;
    };
  };
};

export type AppEnv = {
  DB: D1Like;
  GITHUB_TOKEN?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_USERNAME?: string;
  OWNER_GITHUB_LOGIN?: string;
  OWNER_GITHUB_ID?: string;
};

export type Viewer = {
  id: string;
  githubId: string;
  name: string | null;
  displayName: string | null;
  email: string | null;
  image: string | null;
  isOwner: boolean;
};

export async function randomToken(length = 32): Promise<string> {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isOwnerByEnv(
  env: Pick<AppEnv, 'OWNER_GITHUB_LOGIN' | 'OWNER_GITHUB_ID'>,
  githubLogin: string,
  githubId: string,
): boolean {
  if (env.OWNER_GITHUB_ID && env.OWNER_GITHUB_ID === githubId) return true;
  if (!env.OWNER_GITHUB_LOGIN) return false;
  return env.OWNER_GITHUB_LOGIN.toLowerCase() === githubLogin.toLowerCase();
}

export async function hasOwnerUser(env: AppEnv): Promise<boolean> {
  const row = await env.DB.prepare('SELECT id FROM users WHERE is_owner = 1 LIMIT 1').first<{ id: string }>();
  return Boolean(row);
}

export async function getUserFromSession(env: AppEnv, sessionId: string): Promise<Viewer | null> {
  const now = Date.now();
  const session = await env.DB
    .prepare('SELECT id, user_id, expires_at FROM sessions WHERE id = ? AND expires_at > ?')
    .bind(sessionId, now)
    .first<{ id: string; user_id: string; expires_at: number }>();

  if (!session) return null;

  const user = await env.DB
    .prepare('SELECT id, github_id, name, display_name, email, image, is_owner FROM users WHERE id = ?')
    .bind(session.user_id)
    .first<Record<string, any>>();

  if (!user) return null;

  return {
    id: user.id,
    githubId: user.github_id,
    name: user.name ?? null,
    displayName: user.display_name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
    isOwner: user.is_owner === 1 || user.is_owner === true,
  };
}

export function normalizeViewer(viewer: Viewer | null) {
  return viewer
    ? {
        id: viewer.id,
        githubId: viewer.githubId,
        name: viewer.name,
        displayName: viewer.displayName,
        email: viewer.email,
        image: viewer.image,
        isOwner: Boolean(viewer.isOwner),
      }
    : null;
}
