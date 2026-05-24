import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CommentItem, PostItem } from '../lib/portfolioApi';
import { useAuthSession } from '../hooks/useBlog';
import { useBlogPosts } from '../hooks/useBlog';

function formatDate(value: number) {
  return new Date(value).toLocaleDateString();
}

function PostForm({
  onSubmit,
  initial,
}: {
  onSubmit: (data: { title: string; summary: string; content: string }) => Promise<void>;
  initial: { title: string; summary: string; content: string };
}) {
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  const [content, setContent] = useState(initial.content);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(initial.title);
    setSummary(initial.summary);
    setContent(initial.content);
  }, [initial.title, initial.summary, initial.content]);

  return (
    <form
      className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await onSubmit({ title: title.trim(), summary: summary.trim(), content: content.trim() });
          setTitle('');
          setSummary('');
          setContent('');
        } finally {
          setSaving(false);
        }
      }}
    >
      <h3 className="text-2xl font-black mb-3">{initial.title ? 'Edit post' : 'Create post'}</h3>
      <input
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full border-4 border-black p-3"
        placeholder="Post title"
      />
      <input
        required
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        className="w-full border-4 border-black p-3"
        placeholder="Short summary"
      />
      <textarea
        required
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full border-4 border-black p-3 h-40"
        placeholder="Markdown/HTML allowed"
      />
      <button
        type="submit"
        className="bg-black text-white px-5 py-2 border-4 border-black font-black disabled:opacity-60"
        disabled={saving || !title.trim() || !summary.trim() || !content.trim()}
      >
        {initial.title ? 'Update Post' : 'Publish Post'}
      </button>
    </form>
  );
}

function CommentArea({
  comments,
  onSubmit,
}: {
  comments: CommentItem[];
  onSubmit: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="mt-3">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setSubmitting(true);
          try {
            await onSubmit(text);
            setText('');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full border-4 border-black p-3 h-20"
          placeholder="Leave a comment"
        />
        <button
          disabled={submitting || !text.trim()}
          className="mt-2 bg-emerald-500 border-4 border-black font-black px-4 py-2 disabled:opacity-50"
          type="submit"
        >
          Post comment
        </button>
      </form>

      <div className="mt-3 space-y-2">
        {comments.map((comment) => (
          <div key={comment._id} className="border border-black p-2">
            <p className="text-sm font-black">{comment.userName}</p>
            <p className="text-sm">{comment.text}</p>
            <p className="text-xs text-gray-700">{formatDate(comment.createdAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostCard({
  post,
  viewer,
  onLike,
  onDelete,
  onSelectEdit,
  onComment,
}: {
  post: PostItem;
  viewer: any;
  onLike: (slug: string) => Promise<void>;
  onDelete: (slug: string) => Promise<void>;
  onSelectEdit: (post: PostItem) => void;
  onComment: (slug: string, text: string) => Promise<void>;
}) {
  return (
    <article className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      <h2 className="font-black text-2xl">{post.title}</h2>
      <p className="text-sm opacity-70 mb-2">{post.authorName} • {formatDate(post.createdAt)}</p>
      <p className="mb-3">{post.summary}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{post.content}</p>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => onLike(post.slug)}
          className={`px-3 py-1 border-4 border-black font-black ${
            post.userLiked ? 'bg-rose-300' : 'bg-orange-300'
          }`}
        >
          {post.userLiked ? 'Liked' : 'Like'} ({post.likesCount})
        </button>

        {viewer?.isOwner ? (
          <button
            onClick={() => onSelectEdit(post)}
            className="bg-blue-300 border-4 border-black px-3 py-1 font-black"
          >
            Edit
          </button>
        ) : null}

        {viewer?.isOwner ? (
          <button
            onClick={() => onDelete(post.slug)}
            className="bg-rose-300 border-4 border-black px-3 py-1 font-black"
          >
            Delete
          </button>
        ) : null}
      </div>

      <CommentArea comments={post.comments || []} onSubmit={(text) => onComment(post.slug, text)} />
    </article>
  );
}

export default function BlogPage() {
  const { viewer, loading: authLoading, signIn, signOut, refresh: refreshAuth } = useAuthSession();
  const { posts, loading, error, createPost, updatePost, removePost, likePost, addComment, refresh } = useBlogPosts();

  const [editing, setEditing] = useState<PostItem | null>(null);

  const isOwner = Boolean(viewer?.isOwner);

  const canView = useMemo(() => posts.length > 0, [posts]);

  useEffect(() => {
    // keep in sync when auth changes
  }, [viewer?.isOwner]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-black">Blog Console</h1>
          <p className="font-bold">Manage posts, likes, and comments</p>
        </div>

        <div className="space-x-2">
          <Link to="/" className="bg-yellow-300 border-4 border-black px-4 py-2 inline-block font-black mr-2">
            Back
          </Link>

          {viewer ? (
            <button onClick={signOut} className="bg-rose-300 border-4 border-black px-4 py-2 font-black">
              Sign out {viewer.displayName || viewer.name || viewer.email}
            </button>
          ) : (
            <button onClick={() => signIn('/#/blog')} className="bg-lime-300 border-4 border-black px-4 py-2 font-black">
              Sign in with GitHub
            </button>
          )}
        </div>
      </header>

      {authLoading ? <div>Loading session...</div> : null}
      {error ? <div className="text-red-600 font-black">{error}</div> : null}

      {isOwner ? (
        <section>
          <PostForm
            initial={
              editing
                ? {
                    title: editing.title,
                    summary: editing.summary,
                    content: editing.content,
                  }
                : { title: '', summary: '', content: '' }
            }
            onSubmit={async (formData) => {
              if (editing) {
                await updatePost(editing.slug, formData);
                setEditing(null);
              } else {
                await createPost(formData);
              }
            }}
          />
        </section>
      ) : null}

      {loading ? (
        <div>Loading posts...</div>
      ) : canView ? (
        <section className="grid gap-4">
          {posts.map((post) => (
            <PostCard
              key={post.slug}
              post={post}
              viewer={viewer}
              onLike={async (slug) => {
                if (!viewer) {
                  signIn('/#/blog');
                  return;
                }
                await likePost(slug);
              }}
              onDelete={async (slug) => {
                await removePost(slug);
              }}
              onSelectEdit={setEditing}
              onComment={async (slug, text) => {
                await addComment(slug, text);
              }}
            />
          ))}
        </section>
      ) : (
        <div className="border border-black p-6 bg-yellow-100">No posts yet.</div>
      )}

      <button onClick={refresh} className="bg-cyan-200 border-4 border-black px-4 py-2 font-black">
        Refresh
      </button>
      <button
        onClick={async () => {
          await refreshAuth();
        }}
        className="bg-indigo-200 border-4 border-black px-4 py-2 ml-2 font-black"
      >
        Refresh session
      </button>
    </div>
  );
}
