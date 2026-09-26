import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../context/LanguageContext';
import { MomentsStateProvider, useMomentsState } from './MomentsState';
import { MomentsActionProvider, useMomentsActions } from './MomentsActions';

const mocks = vi.hoisted(() => ({
    cloudEnabled: vi.fn(),
    loadTokens: vi.fn(),
    authedCloudFetch: vi.fn(),
    fetchCloudActorNames: vi.fn(),
    fetchCloudMomentFeed: vi.fn(),
    createCloudMoment: vi.fn(),
    createCloudInteraction: vi.fn(),
    mapCloudFeedItem: vi.fn(),
    mapCloudMoment: vi.fn(),
    newClientInteractionKey: vi.fn(),
}));

vi.mock('../../../api/cloud-adapter', () => ({
    cloudEnabled: mocks.cloudEnabled,
    loadTokens: mocks.loadTokens,
    authedCloudFetch: mocks.authedCloudFetch,
}));

vi.mock('../services/momentsCloudService', () => ({
    HEART_REACTION: '❤️',
    DEFAULT_AUDIENCE_POLICY: {
        allowedActorIds: [],
        class: 'public_within_graph',
    },
    fetchCloudActorNames: mocks.fetchCloudActorNames,
    fetchCloudMomentFeed: mocks.fetchCloudMomentFeed,
    createCloudMoment: mocks.createCloudMoment,
    createCloudInteraction: mocks.createCloudInteraction,
    mapCloudFeedItem: mocks.mapCloudFeedItem,
    mapCloudMoment: mocks.mapCloudMoment,
    newClientInteractionKey: mocks.newClientInteractionKey,
}));

const VIEWER_ID = '11111111-1111-4111-8111-111111111111';
const FRIEND_ID = '22222222-2222-4222-8222-222222222222';
const SERVER_POST_ID = '33333333-3333-4333-8333-333333333333';

let latest = null;

function mapMoment(moment, actorNameById = new Map()) {
    return {
        id: moment.id,
        authorId: moment.actorId === VIEWER_ID ? 'user-me' : moment.actorId,
        cloudActorId: moment.actorId,
        cloud: true,
        content: moment.content,
        images: [],
        video: null,
        location: null,
        visibility: moment.audiencePolicy?.class || 'public_within_graph',
        language: 'zh',
        storyTitle: null,
        hashtags: [],
        createdAt: moment.createdAt,
        likes: [],
        comments: [],
        reactions: {},
        reactionCount: 0,
        commentCount: 0,
        shareCount: 0,
        shares: [],
        aiFeedback: null,
        aiAssist: null,
        repostOf: null,
        cloudAuthorName: moment.actorId === VIEWER_ID ? null : (actorNameById.get(moment.actorId)?.publicName || null),
    };
}

function feedItem(moment) {
    return {
        moment,
        reactionCount: 0,
        commentCount: 0,
        viewerInteractions: [],
    };
}

function Harness() {
    const state = useMomentsState();
    return React.createElement(
        MomentsActionProvider,
        {
            setMomentsData: state.setMomentsData,
            setImageApiKey: state.setImageApiKey,
            setCloudFeedError: state.setCloudFeedError,
            cloudMode: state.cloudMode,
            actorNames: state.actorNames,
            posts: state.posts,
        },
        React.createElement(Probe),
    );
}

function Probe() {
    const state = useMomentsState();
    const actions = useMomentsActions();
    latest = { ...state, ...actions };
    return React.createElement('output', {
        'aria-label': 'moments-state',
        children: JSON.stringify({
            posts: state.posts,
            actorNames: state.actorNames,
            cursor: state.cloudFeedCursor,
            loading: state.cloudFeedLoading,
            error: state.cloudFeedError,
        }),
    });
}

function renderMoments() {
    return render(
        React.createElement(
            LanguageProvider,
            null,
            React.createElement(
                MomentsStateProvider,
                null,
                React.createElement(Harness),
            ),
        ),
    );
}

function setLocalPosts(posts) {
    localStorage.setItem('chat-buddy-moments', JSON.stringify({
        posts,
        lastAIPostTime: {},
        imageApiUrl: '',
        draft: null,
        lastStoryEventDate: null,
    }));
}

function localPost(id = 'local-post') {
    return {
        id,
        authorId: 'ai-1',
        content: 'local fake post',
        images: [],
        video: null,
        createdAt: '2026-09-25T10:00:00.000Z',
        likes: [],
        comments: [],
        reactions: {},
        shareCount: 0,
        shares: [],
    };
}

describe('Moments cloud wiring', () => {
    beforeEach(() => {
        localStorage.clear();
        latest = null;
        vi.resetAllMocks();
        mocks.cloudEnabled.mockReturnValue(true);
        mocks.loadTokens.mockReturnValue({
            accessToken: 'access',
            refreshToken: 'refresh',
            actorId: VIEWER_ID,
            accountId: 'account',
        });
        mocks.newClientInteractionKey.mockReturnValue('idem-non-empty');
        const actorNames = new Map([
            [VIEWER_ID, { id: VIEWER_ID, publicName: 'Viewer' }],
            [FRIEND_ID, { id: FRIEND_ID, publicName: 'Cloud Friend' }],
        ]);
        mocks.fetchCloudActorNames.mockResolvedValue(actorNames);
        mocks.fetchCloudMomentFeed.mockResolvedValue({ items: [], nextCursor: null });
        mocks.createCloudMoment.mockResolvedValue({
            id: SERVER_POST_ID,
            actorId: VIEWER_ID,
            content: 'server post',
            createdAt: '2026-09-25T12:00:00.000Z',
            audiencePolicy: { class: 'public_within_graph' },
        });
        mocks.createCloudInteraction.mockResolvedValue({
            interaction: { id: 'interaction' },
            duplicate: false,
        });
        mocks.mapCloudFeedItem.mockImplementation((item, _viewerActorId, actorNameById) => (
            mapMoment(item.moment, actorNameById)
        ));
        mocks.mapCloudMoment.mockImplementation(moment => mapMoment(moment));
    });

    it('loads and maps the authoritative cloud feed on mount', async () => {
        mocks.fetchCloudMomentFeed.mockResolvedValueOnce({
            items: [
                feedItem({
                    id: '44444444-4444-4444-8444-444444444444',
                    actorId: FRIEND_ID,
                    content: 'older friend post',
                    createdAt: '2026-09-25T09:00:00.000Z',
                    audiencePolicy: { class: 'public_within_graph' },
                }),
                feedItem({
                    id: '55555555-5555-4555-8555-555555555555',
                    actorId: VIEWER_ID,
                    content: 'new viewer post',
                    createdAt: '2026-09-25T11:00:00.000Z',
                    audiencePolicy: { class: 'public_within_graph' },
                }),
            ],
            nextCursor: 'next-page',
        });
        setLocalPosts([localPost()]);

        renderMoments();

        await waitFor(() => expect(latest.cloudFeedLoading).toBe(false));
        expect(mocks.fetchCloudActorNames).toHaveBeenCalledTimes(1);
        expect(mocks.fetchCloudMomentFeed).toHaveBeenCalledWith({ limit: 20 });
        expect(latest.posts.map(post => post.id)).toEqual([
            '55555555-5555-4555-8555-555555555555',
            '44444444-4444-4444-8444-444444444444',
        ]);
        expect(latest.posts[0].authorId).toBe('user-me');
        expect(latest.posts[1].authorId).toBe(FRIEND_ID);
        expect(latest.posts[1].cloudAuthorName).toBe('Cloud Friend');
        expect(latest.actorNames[FRIEND_ID].publicName).toBe('Cloud Friend');
        expect(latest.cloudFeedCursor).toBe('next-page');
    });

    it('keeps cloud feed failures empty instead of restoring local fake data', async () => {
        setLocalPosts([localPost()]);
        mocks.fetchCloudMomentFeed.mockRejectedValueOnce(new Error('feed unavailable'));

        renderMoments();

        await waitFor(() => expect(latest.cloudFeedError).toContain('feed unavailable'));
        expect(latest.posts).toEqual([]);
        expect(latest.cloudFeedCursor).toBe(null);
    });

    it('loads the next cloud page with the saved cursor and deduplicates posts', async () => {
        mocks.fetchCloudMomentFeed
            .mockResolvedValueOnce({
                items: [feedItem({
                    id: '55555555-5555-4555-8555-555555555555',
                    actorId: VIEWER_ID,
                    content: 'first',
                    createdAt: '2026-09-25T11:00:00.000Z',
                })],
                nextCursor: 'next-page',
            })
            .mockResolvedValueOnce({
                items: [
                    feedItem({
                        id: '55555555-5555-4555-8555-555555555555',
                        actorId: VIEWER_ID,
                        content: 'duplicate',
                        createdAt: '2026-09-25T11:00:00.000Z',
                    }),
                    feedItem({
                        id: '44444444-4444-4444-8444-444444444444',
                        actorId: FRIEND_ID,
                        content: 'second page',
                        createdAt: '2026-09-25T08:00:00.000Z',
                    }),
                ],
                nextCursor: null,
            });
        renderMoments();
        await waitFor(() => expect(latest.cloudFeedCursor).toBe('next-page'));

        await act(async () => latest.loadMoreMoments());

        expect(mocks.fetchCloudMomentFeed).toHaveBeenLastCalledWith({ cursor: 'next-page', limit: 20 });
        expect(latest.posts).toHaveLength(2);
        expect(latest.cloudFeedCursor).toBe(null);
    });

    it('optimistically creates a human post and replaces it with the mapped server moment', async () => {
        renderMoments();
        await waitFor(() => expect(latest.cloudFeedLoading).toBe(false));

        act(() => latest.createPost('human cloud post', [], null, 'user-me', { language: 'en' }));
        expect(latest.posts[0].authorId).toBe('user-me');
        expect(latest.posts[0].content).toBe('human cloud post');
        expect(latest.posts[0].pending).toBe(true);

        await waitFor(() => expect(latest.posts[0].id).toBe(SERVER_POST_ID));
        expect(latest.posts[0].pending).toBeUndefined();
        expect(mocks.createCloudMoment).toHaveBeenCalledWith({
            content: 'human cloud post',
            audiencePolicy: {
                allowedActorIds: [],
                class: 'public_within_graph',
            },
            mediaAssets: [],
        });
    });

    it('rolls a failed human post back', async () => {
        mocks.createCloudMoment.mockRejectedValueOnce(new Error('create failed'));
        renderMoments();
        await waitFor(() => expect(latest.cloudFeedLoading).toBe(false));

        act(() => latest.createPost('will fail', [], null, 'user-me'));
        await waitFor(() => expect(latest.cloudFeedError).toContain('create failed'));
        expect(latest.posts).toEqual([]);
    });

    it('creates an idempotent cloud reaction for a human like and rolls failures back', async () => {
        mocks.fetchCloudMomentFeed.mockResolvedValueOnce({
            items: [feedItem({
                id: '55555555-5555-4555-8555-555555555555',
                actorId: FRIEND_ID,
                content: 'like me',
                createdAt: '2026-09-25T11:00:00.000Z',
            })],
            nextCursor: null,
        });
        renderMoments();
        await waitFor(() => expect(latest.cloudFeedLoading).toBe(false));
        const postId = latest.posts[0].id;

        act(() => latest.toggleLike(postId, 'user-me'));
        expect(latest.posts[0].likes).toContain('user-me');
        await waitFor(() => expect(mocks.createCloudInteraction).toHaveBeenCalledTimes(1));
        expect(mocks.createCloudInteraction).toHaveBeenCalledWith(postId, {
            type: 'reaction',
            content: '❤️',
            clientIdempotencyKey: 'idem-non-empty',
        });

        mocks.createCloudInteraction.mockRejectedValueOnce(new Error('like failed'));
        act(() => latest.toggleLike(postId, 'user-me'));
        act(() => latest.toggleLike(postId, 'user-me'));
        await waitFor(() => expect(latest.cloudFeedError).toContain('like failed'));
        expect(latest.posts[0].likes).not.toContain('user-me');
    });

    it('creates an idempotent cloud reaction for a human emoji and rolls failures back', async () => {
        mocks.fetchCloudMomentFeed.mockResolvedValueOnce({
            items: [feedItem({
                id: '55555555-5555-4555-8555-555555555555',
                actorId: FRIEND_ID,
                content: 'react to me',
                createdAt: '2026-09-25T11:00:00.000Z',
            })],
            nextCursor: null,
        });
        renderMoments();
        await waitFor(() => expect(latest.cloudFeedLoading).toBe(false));
        const postId = latest.posts[0].id;

        act(() => latest.addReaction(postId, '🔥', 'user-me'));
        expect(latest.posts[0].reactions['🔥']).toEqual(['user-me']);
        await waitFor(() => expect(mocks.createCloudInteraction).toHaveBeenCalledTimes(1));
        expect(mocks.createCloudInteraction).toHaveBeenCalledWith(postId, {
            type: 'reaction',
            content: '🔥',
            clientIdempotencyKey: 'idem-non-empty',
        });

        mocks.createCloudInteraction.mockRejectedValueOnce(new Error('reaction failed'));
        act(() => latest.addReaction(postId, '🎉', 'user-me'));
        await waitFor(() => expect(latest.cloudFeedError).toContain('reaction failed'));
        expect(latest.posts[0].reactions['🎉']).toBeUndefined();
    });

    it('creates cloud comments and rolls a failed optimistic comment back', async () => {
        mocks.fetchCloudMomentFeed.mockResolvedValueOnce({
            items: [feedItem({
                id: '55555555-5555-4555-8555-555555555555',
                actorId: FRIEND_ID,
                content: 'comment me',
                createdAt: '2026-09-25T11:00:00.000Z',
            })],
            nextCursor: null,
        });
        renderMoments();
        await waitFor(() => expect(latest.cloudFeedLoading).toBe(false));
        const postId = latest.posts[0].id;

        act(() => latest.addComment(postId, 'first comment', 'user-me', null));
        expect(latest.posts[0].comments).toHaveLength(1);
        await waitFor(() => expect(mocks.createCloudInteraction).toHaveBeenCalledTimes(1));
        expect(mocks.createCloudInteraction).toHaveBeenCalledWith(postId, {
            type: 'comment',
            content: 'first comment',
            clientIdempotencyKey: 'idem-non-empty',
        });

        mocks.createCloudInteraction.mockRejectedValueOnce(new Error('comment failed'));
        act(() => latest.addComment(postId, 'failing comment', 'user-me', null));
        await waitFor(() => expect(latest.cloudFeedError).toContain('comment failed'));
        expect(latest.posts[0].comments).toHaveLength(1);
    });

    it('keeps AI persona create, like, and comment paths entirely local', async () => {
        mocks.fetchCloudMomentFeed.mockResolvedValueOnce({
            items: [feedItem({
                id: '55555555-5555-4555-8555-555555555555',
                actorId: VIEWER_ID,
                content: 'cloud post',
                createdAt: '2026-09-25T11:00:00.000Z',
            })],
            nextCursor: null,
        });
        renderMoments();
        await waitFor(() => expect(latest.cloudFeedLoading).toBe(false));
        mocks.createCloudMoment.mockClear();
        mocks.createCloudInteraction.mockClear();

        act(() => latest.createPost('AI post', [], null, 'ai-1'));
        const aiPost = latest.posts.find(post => post.authorId === 'ai-1');
        expect(aiPost).toBeDefined();
        act(() => latest.toggleLike(latest.posts.find(post => post.authorId === 'user-me').id, 'ai-1'));
        act(() => latest.addComment(latest.posts.find(post => post.authorId === 'user-me').id, 'AI comment', 'ai-1'));

        expect(mocks.createCloudMoment).not.toHaveBeenCalled();
        expect(mocks.createCloudInteraction).not.toHaveBeenCalled();
        const cloudPost = latest.posts.find(post => post.authorId === 'user-me');
        expect(cloudPost.likes).toContain('ai-1');
        expect(cloudPost.comments[0].authorId).toBe('ai-1');
    });

    it('uses no cloud calls and preserves synchronous local creation when cloud mode is off', () => {
        mocks.cloudEnabled.mockReturnValue(false);
        setLocalPosts([localPost('existing')]);
        renderMoments();

        expect(mocks.fetchCloudActorNames).not.toHaveBeenCalled();
        expect(mocks.fetchCloudMomentFeed).not.toHaveBeenCalled();
        act(() => latest.createPost('local new post', [], null, 'user-me'));
        expect(latest.posts[0].authorId).toBe('user-me');
        expect(latest.posts[0].content).toBe('local new post');
        expect(latest.cloudFeedLoading).toBe(false);
    });
});
