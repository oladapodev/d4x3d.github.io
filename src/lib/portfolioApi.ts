export type Viewer = {
  id: string;
  githubId: string;
  name: string | null;
  displayName: string | null;
  email: string | null;
  image: string | null;
  isOwner: boolean;
} | null;

export type CommentItem = {
  _id: string;
  userName: string;
  text: string;
  createdAt: number;
};

export type PostItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  authorName: string;
  createdAt: number;
  updatedAt: number;
  likesCount: number;
  userLiked: boolean;
  comments: CommentItem[];
};

export async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `Request failed (${response.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error) message = parsed.error;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }

  const data = (await response.json()) as T;
  return data;
}

export async function getSession(): Promise<Viewer> {
  const payload = await requestJson<{ user: Viewer }>('/api/auth/session');
  return payload.user;
}

export function signIn(returnPath = '/#/blog') {
  window.location.assign(`/api/auth/github/start?redirect=${encodeURIComponent(returnPath)}`);
}

export async function signOut() {
  await requestJson<{ ok: boolean }>('/api/auth/signout', { method: 'POST' });
}

export async function listPosts(): Promise<PostItem[]> {
  const payload = await requestJson<{ posts: PostItem[] }>('/api/blog');
  return payload.posts || [];
}

export async function getPost(slug: string): Promise<PostItem | null> {
  const payload = await requestJson<{ post: PostItem }>(`/api/blog/${encodeURIComponent(slug)}`);
  return payload.post || null;
}

export async function createPost(input: { title: string; summary?: string; content?: string }) {
  return requestJson<PostItem>('/api/blog', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updatePost(slug: string, input: { title?: string; summary?: string; content?: string }) {
  return requestJson<{ post: PostItem }>(`/api/blog/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deletePost(slug: string) {
  return requestJson<{ ok: boolean }>(`/api/blog/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  });
}

export async function likePost(slug: string): Promise<{ likesCount: number; liked: boolean } > {
  return requestJson<{ likesCount: number; liked: boolean }>(`/api/blog/${encodeURIComponent(slug)}/like`, {
    method: 'POST',
  });
}

export async function addComment(slug: string, text: string): Promise<{ post: PostItem }> {
  return requestJson<{ post: PostItem }>(`/api/blog/${encodeURIComponent(slug)}/comment`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

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
};

export type ContributionDay = { date: string; contributionCount: number; color: string };

export async function githubProfile(username: string): Promise<GhUser> {
  return requestJson<GhUser>(`/api/github/profile?username=${encodeURIComponent(username)}`);
}

export async function githubPinned(username: string, limit = 6): Promise<PinnedRepo[]> {
  const payload = await requestJson<unknown>(`/api/github/pinned?username=${encodeURIComponent(username)}&limit=${limit}`);
  return payload as PinnedRepo[];
}

export async function githubContributions(username: string): Promise<{ enabled: boolean; days?: ContributionDay[] }> {
  return requestJson<{ enabled: boolean; days?: ContributionDay[] }>(`/api/github/contributions?username=${encodeURIComponent(username)}`);
}

export async function githubStatus(): Promise<{ username: string; hasToken: boolean }> {
  return requestJson<{ username: string; hasToken: boolean }>('/api/github/status');
}
