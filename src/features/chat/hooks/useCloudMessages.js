/**
 * Cloud message timeline for a single conversation.
 *
 * WEB_IMPLEMENTATION.md §8: server state lives in TanStack Query in the long
 * run, but during incremental migration this hook uses the cloud adapter
 * directly. It loads messages truthfully, sends through the cloud POST
 * endpoint, and surfaces failures as real error states — the composer stays
 * enabled so the user can retry or keep typing.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCloud, loadTokens } from '../../../api/cloud-adapter';

function newIdempotencyKey() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getCurrentActorId() {
  return loadTokens().actorId;
}

export function useCloudMessages(conversationId) {
  const [status, setStatus] = useState('loading');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [sendError, setSendError] = useState(null);
  const [sendStatus, setSendStatus] = useState('idle');
  const [actors, setActors] = useState([]);
  const [reloadToken, setReloadToken] = useState(0);
  const currentActorId = getCurrentActorId();

  const cloud = useMemo(() => getCloud(), []);

  useEffect(() => {
    // `ignored` discards stale responses so a slow fetch for a previous
    // conversation can never clobber the current timeline.
    let ignored = false;
    async function run() {
      try {
        const [messageEnvelope, actorList] = await Promise.all([
          cloud.getMessages(conversationId, { limit: 100 }),
          cloud.listActors(),
        ]);
        if (ignored) return;
        setMessages(messageEnvelope.items);
        setActors(actorList);
        setStatus('ready');
      } catch (err) {
        if (ignored) return;
        setMessages([]);
        setError(err?.message || String(err));
        setStatus('error');
      }
    }
    run();
    return () => {
      ignored = true;
    };
  }, [cloud, conversationId, reloadToken]);

  const refetch = useCallback(() => {
    // Event-handler updates: the window shows loading while refetching,
    // then flips to the truthful ready/error state.
    setStatus('loading');
    setError(null);
    setReloadToken((token) => token + 1);
  }, []);

  const sendMessage = useCallback(
    async (content) => {
      if (!conversationId || !content.trim()) return { success: false };
      const trimmed = content.trim();
      const clientIdempotencyKey = newIdempotencyKey();
      const optimistic = {
        id: `local-${clientIdempotencyKey}`,
        conversationId,
        senderActorId: currentActorId,
        sequence: -1,
        clientIdempotencyKey,
        kind: 'text',
        content: trimmed,
        structuredPayload: null,
        replyToMessageId: null,
        burstId: null,
        status: 'pending',
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
      };
      setMessages((prev) => [...prev, optimistic]);
      setSendStatus('sending');
      setSendError(null);
      try {
        const result = await cloud.sendMessage(conversationId, {
          clientIdempotencyKey,
          kind: 'text',
          content: trimmed,
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.clientIdempotencyKey === clientIdempotencyKey
              ? {
                  ...m,
                  id: result.id,
                  sequence: result.sequence,
                  status: 'accepted',
                }
              : m,
          ),
        );
        setSendStatus('idle');
        return { success: true };
      } catch (err) {
        const message = err?.message || String(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.clientIdempotencyKey === clientIdempotencyKey
              ? { ...m, status: 'failed' }
              : m,
          ),
        );
        setSendError(message);
        setSendStatus('error');
        return { success: false, error: message };
      }
    },
    [cloud, conversationId, currentActorId],
  );

  const dismissSendError = useCallback(() => {
    setSendError(null);
    setSendStatus('idle');
  }, []);

  const actorMap = useMemo(() => {
    const map = new Map();
    for (const actor of actors) {
      map.set(actor.id, actor);
    }
    return map;
  }, [actors]);

  return {
    status,
    messages,
    error,
    sendStatus,
    sendError,
    sendMessage,
    dismissSendError,
    refetch,
    actorMap,
    currentActorId,
  };
}
