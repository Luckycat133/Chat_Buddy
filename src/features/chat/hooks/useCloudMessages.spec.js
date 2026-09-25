/**
 * useCloudMessages — cloud timeline wiring for /chats/:conversationId.
 * Covers: loading messages, sending messages with optimistic updates,
 * truthful send failures (role=alert + retry), and composer staying usable.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCloudMessages } from './useCloudMessages';

const cloudMocks = vi.hoisted(() => ({
  getCloud: vi.fn(),
  loadTokens: vi.fn(() => ({ actorId: 'actor-me' })),
}));

vi.mock('../../../api/cloud-adapter', () => ({
  getCloud: cloudMocks.getCloud,
  loadTokens: cloudMocks.loadTokens,
}));

function createMockCloud(overrides = {}) {
  return {
    getMessages: vi.fn().mockResolvedValue({ items: [] }),
    listActors: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue({ id: 'msg-1', sequence: 1 }),
    ...overrides,
  };
}

describe('useCloudMessages', () => {
  beforeEach(() => {
    sessionStorage.clear();
    cloudMocks.getCloud.mockReset();
    cloudMocks.loadTokens.mockReturnValue({ actorId: 'actor-me' });
  });

  it('test_when_loading_messages_should_expose_ready_state_with_server_items', async () => {
    const cloud = createMockCloud({
      getMessages: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'm1',
            conversationId: 'c1',
            senderActorId: 'actor-1',
            sequence: 1,
            clientIdempotencyKey: 'k1',
            kind: 'text',
            content: 'hello',
            structuredPayload: null,
            replyToMessageId: null,
            burstId: null,
            status: 'accepted',
            createdAt: '2026-09-24T00:00:00.000Z',
            editedAt: null,
            deletedAt: null,
          },
        ],
      }),
      listActors: vi.fn().mockResolvedValue([{ id: 'actor-1', publicName: 'Mira' }]),
    });
    cloudMocks.getCloud.mockReturnValue(cloud);

    const { result } = renderHook(() => useCloudMessages('c1'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('hello');
    expect(result.current.actorMap.get('actor-1').publicName).toBe('Mira');
    expect(cloud.getMessages).toHaveBeenCalledWith('c1', { limit: 100 });
  });

  it('test_when_fetch_fails_should_surface_truthful_error_without_fake_data', async () => {
    const cloud = createMockCloud({
      getMessages: vi.fn().mockRejectedValue(new Error('Gateway timeout')),
    });
    cloudMocks.getCloud.mockReturnValue(cloud);

    const { result } = renderHook(() => useCloudMessages('c1'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('Gateway timeout');
    expect(result.current.messages).toEqual([]);
  });

  it('test_when_sending_message_should_add_optimistic_pending_message_then_replace_with_server_id', async () => {
    const cloud = createMockCloud({
      sendMessage: vi.fn().mockResolvedValue({ id: 'msg-server', sequence: 2 }),
    });
    cloudMocks.getCloud.mockReturnValue(cloud);

    const { result } = renderHook(() => useCloudMessages('c1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    // act() flushes the synchronous optimistic insert before we assert it.
    let sendPromise;
    act(() => {
      sendPromise = result.current.sendMessage('hi cloud');
    });
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].status).toBe('pending');

    await act(async () => {
      await sendPromise;
    });
    await waitFor(() => expect(result.current.messages[0].status).toBe('accepted'));
    expect(result.current.messages[0].id).toBe('msg-server');
    expect(result.current.messages[0].sequence).toBe(2);
    expect(result.current.sendStatus).toBe('idle');
  });

  it('test_when_send_fails_should_mark_message_failed_and_surface_error', async () => {
    const cloud = createMockCloud({
      sendMessage: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    cloudMocks.getCloud.mockReturnValue(cloud);

    const { result } = renderHook(() => useCloudMessages('c1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let sendResult;
    await act(async () => {
      sendResult = await result.current.sendMessage('oops');
    });
    expect(sendResult.success).toBe(false);
    expect(sendResult.error).toBe('Network error');
    expect(result.current.messages[0].status).toBe('failed');
    expect(result.current.sendError).toBe('Network error');
    expect(result.current.sendStatus).toBe('error');
  });

  it('test_when_another_send_is_in_progress_should_keep_composer_enabled', async () => {
    // DEMO_EXPERIENCE.md §7.1: the client sends individual messages
    // immediately — an in-flight send never locks out the next one.
    let resolveFirst;
    const cloud = createMockCloud({
      sendMessage: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve;
            }),
        )
        .mockResolvedValue({ id: 'msg-2', sequence: 2 }),
    });
    cloudMocks.getCloud.mockReturnValue(cloud);

    const { result } = renderHook(() => useCloudMessages('c1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let firstPromise;
    act(() => {
      firstPromise = result.current.sendMessage('first');
    });
    await waitFor(() => expect(result.current.sendStatus).toBe('sending'));

    // Composer is never disabled: the second send goes out while the
    // first is still in flight.
    let secondResult;
    await act(async () => {
      secondResult = await result.current.sendMessage('second');
    });
    expect(secondResult.success).toBe(true);
    expect(cloud.sendMessage).toHaveBeenCalledTimes(2);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].status).toBe('pending');
    expect(result.current.messages[1].status).toBe('accepted');

    // The first send still resolves and replaces its optimistic entry.
    await act(async () => {
      resolveFirst({ id: 'msg-1', sequence: 1 });
      await firstPromise;
    });
    expect(result.current.messages[0].status).toBe('accepted');
    expect(result.current.messages[0].id).toBe('msg-1');
  });
});
