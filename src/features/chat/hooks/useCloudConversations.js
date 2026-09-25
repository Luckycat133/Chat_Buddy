/**
 * Cloud conversation list for the /chats landing route.
 *
 * WEB_IMPLEMENTATION.md §7/§8: /chats is the default landing destination and
 * its server state comes from the cloud client. This hook fetches the
 * account's visible conversations through the authed cloud adapter and
 * exposes truthful loading/ready/error states — the UI renders the
 * [data-testid="chat-list"] container in every state (empty included) and
 * never fakes data while the gateway is unreachable.
 *
 * Legacy local chats (ChatEngine) keep rendering alongside cloud rows during
 * the incremental migration; legacy mode (VITE_USE_CLOUD!=true) is untouched.
 */
import { useEffect, useState } from 'react';
import { cloudEnabled, authedCloudFetch } from '../../../api/cloud-adapter';

export function useCloudConversations() {
    const enabled = cloudEnabled();
    // Initial state derives from the build-time flag so the effect body never
    // needs a synchronous setState (avoids cascading renders on mount).
    const [state, setState] = useState(() =>
        cloudEnabled()
            ? { status: 'loading', items: [], error: null }
            : { status: 'idle', items: [], error: null }
    );

    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const response = await authedCloudFetch('/v1/conversations');
                const data = await response.json().catch(() => null);
                if (!response.ok) {
                    // Truthful failure: surface the server error envelope
                    // (e.g. gateway 503) instead of silently showing nothing.
                    throw new Error(data?.error?.message || `HTTP ${response.status}`);
                }
                if (!cancelled) {
                    setState({
                        status: 'ready',
                        items: Array.isArray(data?.items) ? data.items : [],
                        error: null,
                    });
                }
            } catch (err) {
                if (!cancelled) {
                    setState({
                        status: 'error',
                        items: [],
                        error: err?.message || String(err),
                    });
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [enabled]);

    return { enabled, ...state };
}
