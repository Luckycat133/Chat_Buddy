/**
 * Cloud Moments service (WEB_IMPLEMENTATION.md §16).
 *
 * In cloud mode the feed is server-authoritative:
 *   - GET /v1/moments is keyset-paginated (opaque cursor) and audience
 *     filtering happens server-side — the client never decides visibility.
 *   - POST /v1/moments creates moments in the caller's graph with an
 *     explicit audience policy.
 *   - POST /v1/moments/:id/interactions is idempotent per
 *     `clientIdempotencyKey`: optimistic clients replay safely instead of
 *     writing a second copy.
 *
 * Failure states are returned truthfully (thrown errors carry the
 * server's stable error code + message) so the UI can render real
 * loading/empty/error states — the cloud path never falls back to fake
 * local data. Logged-out (legacy local) mode keeps the local service.
 */

import { authedCloudFetch, loadTokens } from '../../../api/cloud-adapter';
import { detectMomentLanguage } from './momentsContentService';

/** Canonical heart reaction — mirrors MomentCard's like semantics. */
export const HEART_REACTION = '❤️';

/** Default audience: public within the caller's social graph. */
export const DEFAULT_AUDIENCE_POLICY = {
    allowedActorIds: [],
    class: 'public_within_graph',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
    return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Idempotency key for optimistic interactions (§16). Length stays within
 * the server's min(8)/max(128) contract.
 */
export function newClientInteractionKey(prefix = 'ix') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function cloudRequest(path, init) {
    const res = await authedCloudFetch(path, init);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const code = data?.error?.code || `HTTP_${res.status}`;
        const message = data?.error?.message || 'moments request failed';
        const err = new Error(`[${code}] ${message}`);
        err.code = code;
        err.status = res.status;
        throw err;
    }
    return data;
}

/**
 * Fetch one page of the feed. `cursor` is the opaque `nextCursor` from a
 * previous page (null = newest page). Returns the raw envelope
 * `{ items: MomentFeedItem[], nextCursor: string | null }`.
 */
export async function fetchCloudMomentFeed({ cursor = null, limit = 20 } = {}) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (cursor) params.set('cursor', cursor);
    return cloudRequest(`/v1/moments?${params.toString()}`, { method: 'GET' });
}

/** Create a moment; returns the server Moment contract object. */
export async function createCloudMoment({ content, audiencePolicy = DEFAULT_AUDIENCE_POLICY, mediaAssets = [] }) {
    const data = await cloudRequest('/v1/moments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content,
            audiencePolicy,
            ...(mediaAssets.length > 0 ? { mediaAssets } : {}),
        }),
    });
    return data?.moment ?? null;
}

/**
 * Create an idempotent interaction. `payload`:
 * { type: 'view'|'reaction'|'comment'|'reply', content?, parentInteractionId?, clientIdempotencyKey? }
 * Returns `{ interaction, duplicate }`.
 */
export async function createCloudInteraction(momentId, payload) {
    return cloudRequest(
        `/v1/moments/${encodeURIComponent(momentId)}/interactions`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        },
    );
}

/**
 * Actor id → { publicName } map for author rendering (cloud actor ids are
 * UUIDs, unknown to the local persona table).
 */
export async function fetchCloudActorNames() {
    const data = await cloudRequest('/v1/actors', { method: 'GET' });
    const map = new Map();
    for (const actor of Array.isArray(data?.items) ? data.items : []) {
        map.set(actor.id, actor);
    }
    return map;
}

function extractHashtags(content) {
    return [...new Set((content || '').match(/#[\w\u3400-\u9fff-]+/g) || [])];
}

/**
 * Map one server MomentFeedItem into the local post shape the Moments UI
 * consumes. The viewer's cloud actor maps to 'user-me' so own-post logic
 * (delete menu, like state) keeps working unchanged. Server counts are
 * carried in `reactionCount`/`commentCount`; `viewerInteractions` supply
 * the viewer's own like/reaction/comment state without any N+1 fetches.
 */
export function mapCloudFeedItem(item, viewerActorId, actorNameById = new Map()) {
    const moment = item?.moment;
    if (!moment || !isUuid(moment.id)) return null;

    const isViewerPost = viewerActorId && moment.actorId === viewerActorId;
    const actor = actorNameById.get(moment.actorId);
    const interactions = Array.isArray(item.viewerInteractions) ? item.viewerInteractions : [];

    const likes = [];
    const reactions = {};
    const comments = [];
    for (const ix of interactions) {
        if (ix.type === 'reaction') {
            const emoji = ix.content || HEART_REACTION;
            if (!reactions[emoji]) reactions[emoji] = [];
            reactions[emoji].push('user-me');
            if (emoji === HEART_REACTION && !likes.includes('user-me')) {
                likes.push('user-me');
            }
        } else if (ix.type === 'comment' || ix.type === 'reply') {
            comments.push({
                id: ix.id,
                authorId: 'user-me',
                content: ix.content || '',
                createdAt: ix.createdAt,
                replyTo: null, // feed contract does not include parent content
                cloudInteractionId: ix.id,
            });
        }
    }

    const content = moment.content || '';
    const detected = detectMomentLanguage(content);

    return {
        id: moment.id,
        authorId: isViewerPost ? 'user-me' : moment.actorId,
        cloudActorId: moment.actorId,
        cloud: true,
        content,
        // Server mediaAssets carry uploaded asset ids only; rendering them
        // needs the object-storage endpoint, so cloud posts are text-first
        // in this pass (images stay available on local posts).
        images: [],
        video: null,
        location: null,
        visibility: moment.audiencePolicy?.class || 'public_within_graph',
        language: detected === 'en' || detected === 'zh' ? detected : 'zh',
        storyTitle: null,
        hashtags: extractHashtags(content),
        createdAt: moment.createdAt,
        likes,
        comments,
        reactions,
        reactionCount: typeof item.reactionCount === 'number' ? item.reactionCount : likes.length,
        commentCount: typeof item.commentCount === 'number' ? item.commentCount : comments.length,
        shareCount: 0,
        shares: [],
        aiFeedback: null,
        aiAssist: null,
        repostOf: null,
        cloudAuthorName: isViewerPost ? null : (actor?.publicName || null),
    };
}

/** Map a POST /v1/moments response into the local post shape. */
export function mapCloudMoment(moment, actorNameById = new Map()) {
    return mapCloudFeedItem(
        { moment, reactionCount: 0, commentCount: 0, viewerInteractions: [] },
        loadTokens().actorId,
        actorNameById,
    );
}
