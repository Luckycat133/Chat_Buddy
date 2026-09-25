/**
 * CloudChatWindow — /chats/:conversationId route smoke test.
 * Verifies: loading state, message rendering, failure alert, and composer send.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CloudChatWindow from './CloudChatWindow';
import { LanguageProvider } from '../../context/LanguageContext';

const cloudMocks = vi.hoisted(() => ({
  getCloud: vi.fn(),
  loadTokens: vi.fn(() => ({ actorId: 'actor-me' })),
}));

vi.mock('../../api/cloud-adapter', () => ({
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

function renderRoute(cloud) {
  cloudMocks.getCloud.mockReturnValue(cloud);
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/chats/c1']}>
        <Routes>
          <Route path="chats/:conversationId" element={<CloudChatWindow />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe('CloudChatWindow', () => {
  beforeEach(() => {
    sessionStorage.clear();
    cloudMocks.getCloud.mockReset();
    cloudMocks.loadTokens.mockReturnValue({ actorId: 'actor-me' });
  });

  it('test_when_messages_load_should_render_timeline_bubbles', async () => {
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
            content: 'Hello from cloud',
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
    renderRoute(cloud);

    await waitFor(() => expect(screen.getByTestId('cloud-message-timeline')).toBeInTheDocument());
    expect(screen.getByText('Hello from cloud')).toBeInTheDocument();
  });

  it('test_when_load_fails_should_show_alert_with_retry_button', async () => {
    const cloud = createMockCloud({
      getMessages: vi.fn().mockRejectedValue(new Error('Boom')),
    });
    renderRoute(cloud);

    await waitFor(() => expect(screen.getByTestId('cloud-chat-error')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/Boom/);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('test_when_user_sends_message_should_call_cloud_send', async () => {
    const user = userEvent.setup();
    const cloud = createMockCloud();
    renderRoute(cloud);

    await waitFor(() => expect(screen.getByTestId('cloud-message-timeline')).toBeInTheDocument());
    const input = screen.getByPlaceholderText(/type a message/i);
    await user.type(input, 'hi');
    await user.click(screen.getByLabelText(/send/i));

    await waitFor(() => expect(cloud.sendMessage).toHaveBeenCalledTimes(1));
    expect(cloud.sendMessage).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ content: 'hi', kind: 'text' }),
    );
  });

  it('test_when_send_fails_should_show_role_alert_with_retry', async () => {
    const user = userEvent.setup();
    const cloud = createMockCloud({
      sendMessage: vi.fn().mockRejectedValue(new Error('Send failed')),
    });
    renderRoute(cloud);

    await waitFor(() => expect(screen.getByTestId('cloud-message-timeline')).toBeInTheDocument());
    const input = screen.getByPlaceholderText(/type a message/i);
    await user.type(input, 'oops');
    await user.click(screen.getByLabelText(/send/i));

    await waitFor(() => expect(screen.getByTestId('cloud-message-error')).toBeInTheDocument());
    expect(screen.getByTestId('cloud-message-error')).toHaveAttribute('role', 'alert');
  });
});
