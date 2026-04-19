import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { useAuthStore } from './authStore';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function getApiErrorDetail(err: unknown, fallback = 'Unknown error'): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { detail?: string } } };
    return e.response?.data?.detail || fallback;
  }
  return fallback;
}

// UUID v4 generator
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Guest identity helpers
export function getGuestId(): string {
  let guestId = localStorage.getItem('soundit_guest_id');
  if (!guestId) {
    guestId = generateUUID();
    localStorage.setItem('soundit_guest_id', guestId);
  }
  return guestId;
}

export function getGuestName(): string | null {
  return localStorage.getItem('soundit_guest_name');
}

export function setGuestName(name: string): void {
  localStorage.setItem('soundit_guest_name', name);
}

// Initialize guest ID on module load
getGuestId();

// Helper to get auth token
const getAuthToken = () => {
  const token = useAuthStore.getState().session?.access_token;
  if (token) return token;
  return localStorage.getItem('auth-token') ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('auth-token') || localStorage.getItem('token');
};

const buildAuthHeaders = () => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'X-Guest-ID': getGuestId(),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export interface CommunitySection {
    id: number;
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    post_count?: number;
}

export interface CommunityAuthor {
    id: number;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    is_guest: boolean;
}

export interface CommunityComment {
    id: number;
    post_id: number;
    user: CommunityAuthor;
    content: string;
    created_at: string;
    updated_at?: string;
    like_count: number;
    has_liked: boolean;
    replies?: CommunityComment[];
}

export interface CommunityPost {
    id: number;
    user: CommunityAuthor;
    title?: string;
    content: string;
    images: string[];
    videos: string[];
    event_id?: number;
    event_title?: string;
    section_id?: number;
    section?: CommunitySection | null;
    view_count: number;
    is_approved?: boolean;
    author_type?: string;
    likes_count: number;
    comments_count: number;
    shares_count: number;
    has_liked: boolean;
    comments: CommunityComment[];
    created_at: string;
    updated_at?: string;
}

interface CommunityState {
    posts: CommunityPost[];
    sections: CommunitySection[];
    selectedSection: CommunitySection | null;
    isLoading: boolean;
    isCreating: boolean;
    page: number;
    hasMore: boolean;
    total: number;

    // Actions
    fetchPosts: (params?: { page?: number; event_id?: number; user_id?: number; search?: string }) => Promise<void>;
    fetchSections: () => Promise<void>;
    fetchPostsBySection: (slug: string, page?: number) => Promise<void>;
    createPost: (data: { title?: string; content: string; images?: string[]; videos?: string[]; event_id?: number; section_id?: number; author_type?: string; guestName?: string; guestEmail?: string }) => Promise<boolean>;
    updatePost: (postId: number, data: { title?: string; content?: string; images?: string[]; videos?: string[]; section_id?: number }) => Promise<boolean>;
    deletePost: (postId: number) => Promise<boolean>;
    likePost: (postId: number) => Promise<void>;
    unlikePost: (postId: number) => Promise<void>;
    addComment: (postId: number, content: string, parentCommentId?: number, guestName?: string, guestEmail?: string) => Promise<void>;
    deleteComment: (postId: number, commentId: number) => Promise<boolean>;
    likeComment: (commentId: number, postId: number) => Promise<void>;
    unlikeComment: (commentId: number, postId: number) => Promise<void>;
    sharePost: (postId: number, platform?: string) => Promise<void>;
    incrementView: (postId: number) => Promise<void>;
    uploadMedia: (files: File[]) => Promise<string[]>;
    loadMore: () => Promise<void>;
}

const updateCommentInTree = (
    comments: CommunityComment[],
    commentId: number,
    updater: (comment: CommunityComment) => CommunityComment
): CommunityComment[] => {
    return comments.map((comment) => {
        if (comment.id === commentId) {
            return updater(comment);
        }
        if (comment.replies && comment.replies.length > 0) {
            return { ...comment, replies: updateCommentInTree(comment.replies, commentId, updater) };
        }
        return comment;
    });
};

const deleteCommentFromTree = (
    comments: CommunityComment[],
    commentId: number
): CommunityComment[] => {
    return comments
        .filter((comment) => comment.id !== commentId)
        .map((comment) => {
            if (comment.replies && comment.replies.length > 0) {
                return { ...comment, replies: deleteCommentFromTree(comment.replies, commentId) };
            }
            return comment;
        });
};

export const useCommunityStore = create<CommunityState>()(
    persist(
        (set, get) => ({
            posts: [],
            sections: [],
            selectedSection: null,
            isLoading: false,
            isCreating: false,
            page: 1,
            hasMore: false,
            total: 0,

            fetchPosts: async (params = {}) => {
                set({ isLoading: true, selectedSection: null });
                try {
                    const queryParams = new URLSearchParams();
                    queryParams.append('page', String(params.page || 1));
                    queryParams.append('page_size', '10');
                    if (params.event_id) queryParams.append('event_id', String(params.event_id));
                    if (params.user_id) queryParams.append('user_id', String(params.user_id));
                    if (params.search) queryParams.append('search', params.search);

                    const response = await axios.get(`${API_URL}/community/posts?${queryParams.toString()}`, {
                        headers: buildAuthHeaders(),
                    });
                    const data = response.data;

                    if (params.page === 1 || !params.page) {
                        set({ posts: data.posts });
                    } else {
                        set({ posts: [...get().posts, ...data.posts] });
                    }
                    set({
                        hasMore: data.has_more,
                        total: data.total,
                        page: data.page
                    });
                } catch (error) {
                    console.error('Failed to fetch posts:', error);
                    // Silent fail — UI shows empty state instead of alarming toast in production
                } finally {
                    set({ isLoading: false });
                }
            },

            fetchSections: async () => {
                try {
                    const response = await axios.get(`${API_URL}/community/sections`, {
                        headers: buildAuthHeaders(),
                    });
                    set({ sections: response.data });
                } catch (error) {
                    console.error('Failed to fetch sections:', error);
                }
            },

            fetchPostsBySection: async (slug, page = 1) => {
                set({ isLoading: true });
                try {
                    const queryParams = new URLSearchParams();
                    queryParams.append('page', String(page));
                    queryParams.append('page_size', '10');

                    const response = await axios.get(`${API_URL}/community/sections/${slug}/posts?${queryParams.toString()}`, {
                        headers: buildAuthHeaders(),
                    });
                    const data = response.data;

                    if (page === 1) {
                        set({ posts: data.posts });
                    } else {
                        set({ posts: [...get().posts, ...data.posts] });
                    }
                    set({
                        hasMore: data.has_more,
                        total: data.total,
                        page: data.page
                    });
                } catch (error) {
                    console.error('Failed to fetch section posts:', error);
                    // Silent fail — UI shows empty state instead of alarming toast in production
                } finally {
                    set({ isLoading: false });
                }
            },

            createPost: async (data) => {
                set({ isCreating: true });
                try {
                    const payload: Record<string, unknown> = { ...data };
                    if (data.guestName) {
                        payload.guest_name = data.guestName;
                    }
                    if (data.guestEmail) {
                        payload.guest_email = data.guestEmail;
                    }
                    delete payload.guestName;
                    delete payload.guestEmail;

                    const response = await axios.post(`${API_URL}/community/posts`, payload, {
                        headers: buildAuthHeaders(),
                    });
                    const newPost = response.data;
                    set({ posts: [newPost, ...get().posts] });
                    toast.success('Post created successfully!');
                    return true;
                } catch (error: unknown) {
                    console.error('Failed to create post:', error);
                    toast.error(getApiErrorDetail(error, 'Failed to create post'));
                    return false;
                } finally {
                    set({ isCreating: false });
                }
            },

            updatePost: async (postId, data) => {
                try {
                    const response = await axios.put(`${API_URL}/community/posts/${postId}`, data, {
                        headers: buildAuthHeaders(),
                    });
                    const updatedPost = response.data;
                    set({
                        posts: get().posts.map(post =>
                            post.id === postId ? updatedPost : post
                        )
                    });
                    toast.success('Post updated successfully!');
                    return true;
                } catch (error: unknown) {
                    console.error('Failed to update post:', error);
                    toast.error(getApiErrorDetail(error, 'Failed to update post'));
                    return false;
                }
            },

            deletePost: async (postId) => {
                try {
                    await axios.delete(`${API_URL}/community/posts/${postId}`, {
                        headers: buildAuthHeaders(),
                    });
                    set({
                        posts: get().posts.filter(post => post.id !== postId)
                    });
                    toast.success('Post deleted successfully!');
                    return true;
                } catch (error: unknown) {
                    console.error('Failed to delete post:', error);
                    toast.error(getApiErrorDetail(error, 'Failed to delete post'));
                    return false;
                }
            },

            likePost: async (postId) => {
                try {
                    await axios.post(`${API_URL}/community/posts/${postId}/like`, {}, {
                        headers: buildAuthHeaders(),
                    });
                    set({
                        posts: get().posts.map(post =>
                            post.id === postId
                                ? { ...post, has_liked: true, likes_count: post.likes_count + 1 }
                                : post
                        )
                    });
                } catch (error) {
                    console.error('Failed to like post:', error);
                }
            },

            unlikePost: async (postId) => {
                try {
                    await axios.post(`${API_URL}/community/posts/${postId}/unlike`, {}, {
                        headers: buildAuthHeaders(),
                    });
                    set({
                        posts: get().posts.map(post =>
                            post.id === postId
                                ? { ...post, has_liked: false, likes_count: Math.max(0, post.likes_count - 1) }
                                : post
                        )
                    });
                } catch (error) {
                    console.error('Failed to unlike post:', error);
                }
            },

            addComment: async (postId, content, parentCommentId, guestName, guestEmail) => {
                try {
                    const payload: Record<string, unknown> = { content, parent_comment_id: parentCommentId };
                    if (guestName) payload.guest_name = guestName;
                    if (guestEmail) payload.guest_email = guestEmail;

                    const response = await axios.post(`${API_URL}/community/posts/${postId}/comments`, payload, {
                        headers: buildAuthHeaders(),
                    });
                    const newComment = response.data;
                    set({
                        posts: get().posts.map(post => {
                            if (post.id !== postId) return post;
                            if (parentCommentId) {
                                return {
                                    ...post,
                                    comments: updateCommentInTree(post.comments, parentCommentId, (comment) => ({
                                        ...comment,
                                        replies: [...(comment.replies || []), newComment]
                                    })),
                                    comments_count: post.comments_count + 1
                                };
                            }
                            return {
                                ...post,
                                comments: [...post.comments, newComment],
                                comments_count: post.comments_count + 1
                            };
                        })
                    });
                    toast.success('Comment added!');
                } catch (error: unknown) {
                    console.error('Failed to add comment:', error);
                    toast.error(getApiErrorDetail(error, 'Failed to add comment'));
                }
            },

            deleteComment: async (postId, commentId) => {
                try {
                    await axios.delete(`${API_URL}/community/posts/${postId}/comments/${commentId}`, {
                        headers: buildAuthHeaders(),
                    });
                    set({
                        posts: get().posts.map(post =>
                            post.id === postId
                                ? {
                                    ...post,
                                    comments: deleteCommentFromTree(post.comments, commentId),
                                    comments_count: Math.max(0, post.comments_count - 1)
                                }
                                : post
                        )
                    });
                    toast.success('Comment deleted');
                    return true;
                } catch (error: unknown) {
                    console.error('Failed to delete comment:', error);
                    toast.error(getApiErrorDetail(error, 'Failed to delete comment'));
                    return false;
                }
            },

            likeComment: async (commentId, postId) => {
                try {
                    const response = await axios.post(`${API_URL}/community/comments/${commentId}/like`, {}, {
                        headers: buildAuthHeaders(),
                    });
                    const { like_count } = response.data;
                    set({
                        posts: get().posts.map(post =>
                            post.id === postId
                                ? {
                                    ...post,
                                    comments: updateCommentInTree(post.comments, commentId, (comment) => ({
                                        ...comment,
                                        has_liked: true,
                                        like_count
                                    }))
                                }
                                : post
                        )
                    });
                } catch (error) {
                    console.error('Failed to like comment:', error);
                }
            },

            unlikeComment: async (commentId, postId) => {
                try {
                    const response = await axios.post(`${API_URL}/community/comments/${commentId}/unlike`, {}, {
                        headers: buildAuthHeaders(),
                    });
                    const { like_count } = response.data;
                    set({
                        posts: get().posts.map(post =>
                            post.id === postId
                                ? {
                                    ...post,
                                    comments: updateCommentInTree(post.comments, commentId, (comment) => ({
                                        ...comment,
                                        has_liked: false,
                                        like_count
                                    }))
                                }
                                : post
                        )
                    });
                } catch (error) {
                    console.error('Failed to unlike comment:', error);
                }
            },

            sharePost: async (postId, platform) => {
                try {
                    await axios.post(`${API_URL}/community/posts/${postId}/share`, null, {
                        params: { platform },
                        headers: buildAuthHeaders(),
                    });
                    set({
                        posts: get().posts.map(post =>
                            post.id === postId
                                ? { ...post, shares_count: post.shares_count + 1 }
                                : post
                        )
                    });
                    toast.success('Post shared!');
                } catch (error) {
                    console.error('Failed to share post:', error);
                }
            },

            incrementView: async (postId) => {
                try {
                    await axios.post(`${API_URL}/community/posts/${postId}/view`, {}, {
                        headers: buildAuthHeaders(),
                    });
                    set({
                        posts: get().posts.map(post =>
                            post.id === postId
                                ? { ...post, view_count: (post.view_count || 0) + 1 }
                                : post
                        )
                    });
                } catch (error) {
                    console.error('Failed to increment view:', error);
                }
            },

            uploadMedia: async (files) => {
                const urls: string[] = [];
                for (const file of files) {
                    const formData = new FormData();
                    formData.append('file', file);
                    const response = await fetch(`${API_URL}/media/upload`, {
                        method: 'POST',
                        headers: buildAuthHeaders(),
                        body: formData,
                    });
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.detail || 'Media upload failed');
                    }
                    const data = await response.json();
                    urls.push(data.url);
                }
                return urls;
            },

            loadMore: async () => {
                const { page, hasMore, selectedSection } = get();
                if (!hasMore) return;
                if (selectedSection) {
                    await get().fetchPostsBySection(selectedSection.slug, page + 1);
                } else {
                    await get().fetchPosts({ page: page + 1 });
                }
            }
        }),
        {
            name: 'community-storage',
            partialize: (state) => ({ posts: state.posts }),
        }
    )
);
