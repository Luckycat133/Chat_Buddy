/**
 * useCloudConversations — cloud data wiring for the /chats landing route.
 * Covers: legacy mode stays idle, ready state maps the server envelope,
 * and gateway failures surface a truthful error (never a fake empty list).
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCloudConversations } from './useCloudConversations';

const cloudMocks = vi.hoisted(() => ({
  cloudEnabled: vi.fn(() => true),
  authedCloudFetch: vi.fn(),
}));

vi.mock('../../../api/cloud-adapter', () => ({
  cloudEnabled: cloudMocks.cloudEnabled,
  authedCloudFetch: cloudMocks.authedCloudFetch,
}));

function cloudResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('useCloudConversations', () => {
  beforeEach(() => {
    cloudMocks.cloudEnabled.mockReturnValue(true);
    cloudMocks.authedCloudFetch.mockReset();
  });

  it('test_when_cloud_disabled_should_stay_idle_without_calling_the_adapter', () => {
    cloudMocks.cloudEnabled.mockReturnValue(false);

    const { result } = renderHook(() => useCloudConversations());

    expect(result.current).toMatchObject({ enabled: false, status: 'idle', items: [], error: null });
    expect(cloudMocks.authedCloudFetch).not.toHaveBeenCalled();
  });

  it('test_when_the_server_returns_conversations_should_expose_them_as_ready', async () => {
    cloudMocks.authedCloudFetch.mockResolvedValue(
      cloudResponse({
        items: [
          { id: 'c1', type: 'direct', publicName: '米拉', memberStatus: 'active', createdAt: '2026-09-24T00:00:00.000Z' },
        ],
      })
    );

    const { result } = renderHook(() => useCloudConversations());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({ id: 'c1', publicName: '米拉' });
    expect(result.current.error).toBeNull();
    expect(cloudMocks.authedCloudFetch).toHaveBeenCalledWith('/v1/conversations');
  });

  it('test_when_the_gateway_fails_should_surface_a_truthful_error_state', async () => {
    cloudMocks.authedCloudFetch.mockResolvedValue(
      cloudResponse({ error: { code: 'INTERNAL', message: 'HTTP 503' } }, false, 503)
    );

    const { result } = renderHook(() => useCloudConversations());

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('HTTP 503');
    expect(result.current.items).toEqual([]);
  });

  it('test_when_the_network_is_down_should_surface_the_network_error', async () => {
    cloudMocks.authedCloudFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useCloudConversations());

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('Failed to fetch');
  });
});
