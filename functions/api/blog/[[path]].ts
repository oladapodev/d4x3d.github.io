import { jsonResponse, parseCookie } from '../../_shared/response';
import { AppEnv, getUserFromSession } from '../../_shared/auth';

function bad(status: number, error: string, code?: string) {
  const payload: Record<string, string> = { error };
  if (code) payload.code = code;
  return jsonResponse(payload, status);
}

function parsePath(pathname: string): string[] {
  const parts = pathname.split('/').filter(Boolean); // ['', 'api', 'blog', ...]
  return parts.slice(2); // remove api, blog
}

function normalizeSlug(value: string | null | undefined) {
  if (!value) return '';
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_.]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function makeSlug(base: string): string {
  const baseSlug = normalizeSlug(base);
  return baseSlug || `post-${Date.now().toString(36)}`;
}

async function getViewer(session: string | null, env: AppEnv) {
  if (!session) return null;
  return getUserFromSession(env, session);
}

function jsonDate(row: Record<string, any> | null) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    content: row.content,
    authorName: row.author_name,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

async function buildPostRow(env: AppEnv, row: Record<string, any>, viewerName?: string) {
  const postId = Number(row.id);
  const comments = (await env.DB.prepare('SELECT id, user_name, text, created_at FROM comments WHERE post_id = ? ORDER BY created_at ASC').bind(postId).all<{ id: number; user_name: string; text: string; created_at: number }>()).results || [];
  const likeCountRow = await env.DB.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?').bind(postId).first<{ count: number }>();
  let userLiked = false;
  if (viewerName) {
    const like = await env.DB.prepare('SELECT id FROM likes WHERE post_id = ? AND user_name = ?').bind(postId, viewerName).first<{ id: string }>();
    userLiked = Boolean(like);
  }

  return {
    ...jsonDate(row),
    comments: comments.map((comment) => ({
      _id: String(comment.id),
      userName: comment.user_name,
      text: comment.text,
      createdAt: Number(comment.created_at),
    })),
    likesCount: Number(likeCountRow?.count || 0),
    userLiked,
  };
}

function parseBody<T>(text: string): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function onRequest(context: { request: Request; env: AppEnv }) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const parts = parsePath(url.pathname);
  const slug = parts[0];
  const action = parts[1] || null;

  const session = parseCookie(request.headers.get('cookie'), 'portfolio_session');
  const viewer = await getViewer(session, env);

  // GET /api/blog -> list
  if (!slug && method === 'GET') {
    const postsRows = await env.DB.prepare('SELECT * FROM posts ORDER BY created_at DESC').all<{ id: number; slug: string; title: string; summary: string; content: string; author_name: string; created_at: number; updated_at: number }>();
    const posts = await Promise.all(
      (postsRows.results || []).map((row) =>
        buildPostRow(env, row, viewer ? viewer.name || viewer.displayName || viewer.email || viewer.githubId : undefined)
      )
    );
    return jsonResponse({ posts });
  }

  // GET /api/blog/:slug
  if (slug && !action && method === 'GET') {
    const postRow = await env.DB.prepare('SELECT * FROM posts WHERE slug = ?').bind(slug).first<Record<string, any>>();
    if (!postRow) return bad(404, 'Post not found', 'NOT_FOUND');
    const post = await buildPostRow(
      env,
      postRow,
      viewer ? viewer.name || viewer.displayName || viewer.email || viewer.githubId : undefined,
    );
    return jsonResponse({ post });
  }

  // POST /api/blog
  if (!slug && method === 'POST') {
    if (!viewer || !viewer.isOwner) return bad(403, 'Owner access required', 'FORBIDDEN');
    const bodyText = await request.text();
    const body = parseBody<{ title: string; summary?: string; content?: string; slug?: string }>(bodyText);
    if (!body?.title) return bad(400, 'Missing title', 'VALIDATION_ERROR');

    const normalized = makeSlug(body.slug || body.title);
    const existing = await env.DB
      .prepare('SELECT id FROM posts WHERE slug = ? LIMIT 1')
      .bind(normalized)
      .first<{ id: string }>();

    if (existing) return bad(409, 'Post slug already exists', 'DUPLICATE_SLUG');

    const now = Date.now();
    await env.DB
      .prepare('INSERT INTO posts (slug, title, summary, content, author_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(
        normalized,
        body.title,
        body.summary || '',
        body.content || '',
        viewer.displayName || viewer.name || viewer.email || viewer.githubId,
        now,
        now,
      )
      .run();

    const inserted = await env.DB.prepare('SELECT * FROM posts WHERE slug = ?').bind(normalized).first<Record<string, any>>();
    if (!inserted) return bad(500, 'Failed to create post', 'DB_ERROR');
    const post = await buildPostRow(env, inserted, viewer?.name || viewer?.displayName || viewer?.email || viewer?.githubId);
    return jsonResponse(post, 201);
  }

  // PUT /api/blog/:slug
  if (slug && !action && method === 'PUT') {
    if (!viewer || !viewer.isOwner) return bad(403, 'Owner access required', 'FORBIDDEN');
    const bodyText = await request.text();
    const body = parseBody<{ title?: string; summary?: string; content?: string }>(bodyText);
    if (!body) return bad(400, 'Invalid JSON', 'INVALID_JSON');

    const target = await env.DB.prepare('SELECT id FROM posts WHERE slug = ?').bind(slug).first<{ id: number }>();
    if (!target) return bad(404, 'Post not found', 'NOT_FOUND');
    const now = Date.now();
    await env.DB
      .prepare('UPDATE posts SET title = COALESCE(?, title), summary = COALESCE(?, summary), content = COALESCE(?, content), updated_at = ? WHERE slug = ?')
      .bind(body.title || null, body.summary || null, body.content || null, now, slug)
      .run();

    const updated = await env.DB.prepare('SELECT * FROM posts WHERE slug = ?').bind(slug).first<Record<string, any>>();
    if (!updated) return bad(500, 'Failed to load updated post', 'DB_ERROR');
    const post = await buildPostRow(env, updated, viewer?.name || viewer?.displayName || viewer?.email || viewer?.githubId);
    return jsonResponse({ post });
  }

  // DELETE /api/blog/:slug
  if (slug && !action && method === 'DELETE') {
    if (!viewer || !viewer.isOwner) return bad(403, 'Owner access required', 'FORBIDDEN');

    const target = await env.DB.prepare('SELECT id FROM posts WHERE slug = ?').bind(slug).first<{ id: number }>();
    if (!target) return bad(404, 'Post not found', 'NOT_FOUND');
    const postId = target.id;

    await env.DB.prepare('DELETE FROM comments WHERE post_id = ?').bind(postId).run();
    await env.DB.prepare('DELETE FROM likes WHERE post_id = ?').bind(postId).run();
    await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(postId).run();

    return jsonResponse({ ok: true });
  }

  // POST /api/blog/:slug/like
  if (slug && action === 'like' && method === 'POST') {
    if (!viewer) return bad(403, 'Sign in required', 'UNAUTHORIZED');

    const post = await env.DB.prepare('SELECT id FROM posts WHERE slug = ?').bind(slug).first<{ id: number }>();
    if (!post) return bad(404, 'Post not found', 'NOT_FOUND');
    const postId = post.id;

    const userName = viewer.name || viewer.displayName || viewer.email || viewer.githubId;
    const existing = await env.DB.prepare('SELECT id FROM likes WHERE post_id = ? AND user_name = ?').bind(postId, userName).first<{ id: number }>();

    if (existing) {
      await env.DB.prepare('DELETE FROM likes WHERE id = ?').bind(existing.id).run();
    } else {
      await env.DB.prepare('INSERT INTO likes (post_id, user_name, created_at) VALUES (?, ?, ?)').bind(postId, userName, Date.now()).run();
    }

    const likeCountRow = await env.DB.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?').bind(postId).first<{ count: number }>();
    return jsonResponse({
      likesCount: Number(likeCountRow?.count || 0),
      liked: !Boolean(existing),
      userName,
      slug,
    });
  }

  // POST /api/blog/:slug/comment
  if (slug && action === 'comment' && method === 'POST') {
    if (!viewer) return bad(403, 'Sign in required', 'UNAUTHORIZED');

    const bodyText = await request.text();
    const body = parseBody<{ text?: string }>(bodyText);
    if (!body?.text?.trim()) return bad(400, 'Comment text required', 'VALIDATION_ERROR');

    const post = await env.DB.prepare('SELECT id FROM posts WHERE slug = ?').bind(slug).first<{ id: number }>();
    if (!post) return bad(404, 'Post not found', 'NOT_FOUND');

    const now = Date.now();
    const userName = viewer.displayName || viewer.name || viewer.email || viewer.githubId;

    await env.DB
      .prepare('INSERT INTO comments (post_id, user_name, text, created_at) VALUES (?, ?, ?, ?)')
      .bind(post.id, userName, body.text.trim(), now)
      .run();

    const updated = await env.DB.prepare('SELECT * FROM posts WHERE slug = ?').bind(slug).first<Record<string, any>>();
    if (!updated) return bad(500, 'Failed to resolve post', 'DB_ERROR');

    const postData = await buildPostRow(env, updated, viewer.name || viewer.displayName || viewer.email || viewer.githubId);
    return jsonResponse({ post: postData }, 201);
  }

  if (slug && action === 'comments' && method === 'GET') {
    const post = await env.DB.prepare('SELECT id FROM posts WHERE slug = ?').bind(slug).first<{ id: number }>();
    if (!post) return bad(404, 'Post not found', 'NOT_FOUND');

    const comments = (await env.DB
      .prepare('SELECT id, user_name, text, created_at FROM comments WHERE post_id = ? ORDER BY created_at DESC')
      .bind(post.id)
      .all<{ id: number; user_name: string; text: string; created_at: number }>()
    ).results || [];

    return jsonResponse({
      comments: comments.map((comment) => ({
        _id: String(comment.id),
        userName: comment.user_name,
        text: comment.text,
        createdAt: Number(comment.created_at),
      })),
    });
  }

  return bad(405, 'Method not supported', 'METHOD_NOT_ALLOWED');
}
