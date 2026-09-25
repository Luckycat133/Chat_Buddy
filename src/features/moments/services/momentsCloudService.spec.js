import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createCloudInteraction,
    createCloudMoment,
    fetchCloudActorNames,
    fetchCloudMomentFeed,
    mapCloudFeedItem,
    newClientInteractionKey,
} from './momentsCloudService';

/**
 * Cloud Moments contract (WEB_IMPLEMENTATION §16): keyset pagination,
 * server-side audience enforcement, idempotent interactions, and truthful
 * error surfacing. The local (logged-out) path keeps the legacy services.
 */
const mocks = vi.hoisted(() => ({
    authedCloudFetch: vi.fn(),
    loadTokens: vi.fn(() => ({
        accessToken: 'token',
        actorId: '11111111-1111-4111-8111-111111111111',
        accountId: '22222222-2222-4222-8222-222222222222',
    })),
}));

vi.mock('../../../api/cloud-adapter', () => ({
    cloudEnabled: () => true,
    authedCloudFetch: mocks.authedCloudFetch,
    loadTokens: mocks.loadTokens,
}));

const VIEWER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '33333333-3333-4333-8333-333333333333';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
    return { ok, status, json: async () => body };
}

beforeEach(() => {
    mocks.authedCloudFetch.mockReset();
    mocks.loadTokens.mockClear();
});

describe('fetchCloudMomentFeed', () => {
    it('requests the first page with a limit and no cursor', async () => {
        mocks.authedCloudFetch.mockResolvedValue(jsonResponse({ items: [], nextCursor: null }));

        await fetchCloudMomentFeed({ limit: 20 });

        expect(mocks.authedCloudFetch).toHaveBeenCalledTimes(1);
        const [path, init] = mocks.authedCloudFetch.mock.calls[0];
        expect(path).toBe('/v1/moments?limit=20');
        expect(init.method).toBe('GET');
    });

    it('passes the opaque keyset cursor through to the server', async () => {
        mocks.authedCloudFetch.mockResolvedValue(jsonResponse({ items: [], nextCursor: null }));

        await fetchCloudMomentFeed({ cursor: 'abc123_cursor', limit: 40 });

        const [path] = mocks.authedCloudFetch.mock.calls[0];
        expect(path).toBe('/v1/moments?limit=40&cursor=abc123_cursor');
    });

    it('surfaces the server error envelope truthfully', async () => {
        mocks.authedCloudFetch.mockResolvedValue(jsonResponse(
            {
                error: {
                    code: 'VALIDATION_FAILED',
                    message: 'Invalid moments cursor',
                    requestId: 'req-3',
                },
            },
            { ok: false, status: 422 },
        ));

        await expect(fetchCloudMomentFeed({ cursor: 'broken' })).rejects.toThrow(
            /VALIDATION_FAILED.*Invalid moments cursor/,
        );
    });
});

describe('createCloudMoment', () => {
    it('posts content with the default public-within-graph audience', async () => {
        mocks.authedCloudFetch.mockResolvedValue(jsonResponse({
            moment: {
                id: '44444444-4444-4444-8444-444444444444',
                actorId: VIEWER_ID,
                socialGraphId: '00000000-0000-0000-0000-000000000001',
                content: 'walked by the river',
                mediaAssets: [],
                audiencePolicy: { allowedActorIds: [], class: 'public_within_graph' },
                sourceEventId: null,
                createdAt: '2026-09-25T01:00:00.000Z',
                deletedAt: null,
            },
        }));

        const moment = await createCloudMoment({ content: 'walked by the river' });

        const [path, init] = mocks.authedCloudFetch.mock.calls[0];
        expect(path).toBe('/v1/moments');
        expect(init.method).toBe('POST');
        const body = JSON.parse(init.body);
        expect(body.content).toBe('walked by the river');
        expect(body.audiencePolicy).toEqual({ allowedActorIds: [], class: 'public_within_graph' });
        expect(moment.id).toBe('44444444-4444-4444-8444-444444444444');
    });
});

describe('createCloudInteraction', () => {
    it('sends idempotent interaction writes to the server', async () => {
        mocks.authedCloudFetch.mockResolvedValue(jsonResponse({
            interaction: {
                id: '55555555-5555-4555-8555-555555555555',
                momentId: '44444444-4444-4444-8444-444444444444',
                actorId: VIEWER_ID,
                type: 'reaction',
                content: '❤️',
                parentInteractionId: null,
                createdAt: '2026-09-25T01:00:00.000Z',
            },
            duplicate: false,
        }));

        const key = newClientInteractionKey('react');
        expect(key.length).toBeGreaterThanOrEqual(8);
        expect(key.length).toBeLessThanOrEqual(128);

        const result = await createCloudInteraction('44444444-4444-4444-8444-444444444444', {
            type: 'reaction',
            content: '❤️',
            clientIdempotencyKey: key,
        });

        const [path, init] = mocks.authedCloudFetch.mock.calls[0];
        expect(path).toBe('/v1/moments/44444444-4444-4444-8444-444444444444/interactions');
        const body = JSON.parse(init.body);
        expect(body.clientIdempotencyKey).toBe(key);
        expect(result.duplicate).toBe(false);
    });
});

describe('mapCloudFeedItem', () => {
    const baseMoment = {
        id: '44444444-4444-4444-8444-444444444444',
        actorId: OTHER_ID,
        socialGraphId: '00000000-0000-0000-0000-000000000001',
        content: 'River walk today #sunset',
        mediaAssets: [],
        audiencePolicy: { allowedActorIds: [], class: 'public_within_graph' },
        sourceEventId: null,
        createdAt: '2026-09-25T01:00:00.000Z',
        deletedAt: null,
    };

    it('maps the viewer marker, counts, and own interactions', () => {
        const post = mapCloudFeedItem(
            {
                moment: baseMoment,
                reactionCount: 7,
                commentCount: 3,
                viewerInteractions: [
                    {
                        id: '66666666-6666-4666-8666-666666666666',
                        momentId: baseMoment.id,
                        actorId: VIEWER_ID,
                        type: 'reaction',
                        content: '❤️',
                        parentInteractionId: null,
                        createdAt: '2026-09-25T01:01:00.000Z',
                    },
                    {
                        id: '77777777-7777-4777-8777-777777777777',
                        momentId: baseMoment.id,
                        actorId: VIEWER_ID,
                        type: 'comment',
                        content: 'beautiful!',
                        parentInteractionId: null,
                        createdAt: '2026-09-25T01:02:00.000Z',
                    },
                ],
            },
            VIEWER_ID,
            new Map([[OTHER_ID, { id: OTHER_ID, publicName: 'Luna' }]]),
        );

        expect(post.authorId).toBe(OTHER_ID);
        expect(post.cloudAuthorName).toBe('Luna');
        expect(post.cloud).toBe(true);
        expect(post.likes).toEqual(['user-me']);
        expect(post.reactionCount).toBe(7);
        expect(post.commentCount).toBe(3);
        expect(post.comments).toHaveLength(1);
        expect(post.comments[0].cloudInteractionId).toBe('77777777-7777-4777-8777-777777777777');
        expect(post.hashtags).toContain('#sunset');
        expect(post.reactions['❤️']).toEqual(['user-me']);
    });

    it('maps the viewer\'s own moment to user-me with grant-free audience fields', () => {
        const post = mapCloudFeedItem(
            {
                moment: { ...baseMoment, actorId: VIEWER_ID },
                reactionCount: 0,
                commentCount: 0,
                viewerInteractions: [],
            },
            VIEWER_ID,
            new Map(),
        );
        expect(post.authorId).toBe('user-me');
        expect(post.cloudAuthorName).toBeNull();
        expect(post.likes).toEqual([]);
    });

    it('returns null for malformed feed rows', () => {
        expect(mapCloudFeedItem(null, VIEWER_ID)).toBeNull();
        expect(mapCloudFeedItem({ moment: { id: 'not-a-uuid' } }, VIEWER_ID)).toBeNull();
    });
});

describe('fetchCloudActorNames', () => {
    it('builds an actorId → actor map from /v1/actors', async () => {
        mocks.authedCloudFetch.mockResolvedValue(jsonResponse({
            items: [
                { id: OTHER_ID, type: 'character', publicName: 'Luna' },
                { id: VIEWER_ID, type: 'human', publicName: '访客' },
            ],
        }));

        const map = await fetchCloudActorNames();
        expect(map).toBeInstanceOf(Map);
        expect(map.get(OTHER_ID).publicName).toBe('Luna');
        expect(map.get(VIEWER_ID).publicName).toBe('访客');
    });
});
