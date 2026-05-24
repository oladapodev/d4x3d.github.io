import { useCallback, useEffect, useState } from 'react';
import type { CommentItem, PostItem, Viewer } from '../lib/portfolioApi';
import * as api from '../lib/portfolioApi';

export function useAuthSession() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const sessionViewer = await api.getSession();
      setViewer(sessionViewer);
    } catch {
      setViewer(null);
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback((returnPath = '/#/blog') => {
    api.signIn(returnPath);
  }, []);

  const signOut = useCallback(async () => {
    await api.signOut();
    setViewer(null);
  }, []);

  return {
    viewer,
    loading,
    ready,
    refresh,
    signIn,
    signOut,
    isOwner: Boolean(viewer?.isOwner),
    loggedIn: Boolean(viewer),
  };
}

export function useBlogPosts() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await api.listPosts();
      setPosts(next);
    } catch (e) {
      setError((e as Error).message || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createPost = useCallback(async (input: { title: string; summary?: string; content?: string }) => {
    await api.createPost(input);
    await refresh();
  }, [refresh]);

  const updatePost = useCallback(async (slug: string, input: { title?: string; summary?: string; content?: string }) => {
    await api.updatePost(slug, input);
    await refresh();
  }, [refresh]);

  const removePost = useCallback(async (slug: string) => {
    await api.deletePost(slug);
    await refresh();
  }, [refresh]);

  const likePost = useCallback(async (slug: string) => {
    const result = await api.likePost(slug);
    setPosts((current) =>
      current.map((post) =>
        post.slug === slug
          ? {
              ...post,
              likesCount: result.likesCount,
              userLiked: result.liked,
            }
          : post,
      ),
    );
  }, []);

  const addComment = useCallback(async (slug: string, text: string) => {
    const payload = await api.addComment(slug, text);
    if (payload.post) {
      setPosts((current) => current.map((post) => (post.slug === slug ? payload.post : post)));
    } else {
      await refresh();
    }
  }, [refresh]);

  const fetchOne = useCallback(async (slug: string): Promise<PostItem | null> => {
    return api.getPost(slug);
  }, []);

  return {
    posts,
    loading,
    error,
    refresh,
    createPost,
    updatePost,
    removePost,
    likePost,
    addComment,
    fetchOne,
    commentCount: posts.reduce((acc, post) => acc + (post.comments?.length || 0), 0),
  };
}
