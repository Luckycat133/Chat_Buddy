import { describe, expect, it, vi } from 'vitest';
import { CloudClient } from './client.js';

const CONVERSATION_ID = '00000000-0000-4000-8000-000000000001';
const MESSAGE_ID = '00000000-0000-4000-8000-000000000002';

function messageEnvelope() {
  return {
    items: [
      {
        id: MESSAGE_ID,
        conversationId: CONVERSATION_ID,
        senderActorId: '00000000-0000-4000-8000-000000000003',
        sequence: 1,
        clientIdempotencyKey: 'client-key-1',
        kind: 'text',
        content: 'hello',
        structuredPayload: null,
        replyToMessageId: null,
        burstId: null,
        status: 'accepted',
        createdAt: '2026-09-25T06:00:00.000Z',
        editedAt: null,
        deletedAt: null,
      },
    ],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('CloudClient conversation and media methods', () => {
  it('loads and sends conversation messages through the authenticated API', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(messageEnvelope()))
      .mockResolvedValueOnce(jsonResponse({ id: MESSAGE_ID, sequence: 1 }));
    const client = new CloudClient({
      baseUrl: 'https://cloud.example/',
      getAccessToken: () => 'access-token',
      fetchImpl,
    });

    const messages = await client.getMessages(CONVERSATION_ID, { limit: 100 });
    const sent = await client.sendMessage(CONVERSATION_ID, {
      clientIdempotencyKey: 'client-key-1',
      kind: 'text',
      content: 'hello',
    });

    expect(messages.items[0]?.content).toBe('hello');
    expect(sent).toEqual({ id: MESSAGE_ID, sequence: 1 });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      `https://cloud.example/v1/conversations/${CONVERSATION_ID}/messages?limit=100`,
    );
    expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).get('authorization')).toBe(
      'Bearer access-token',
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toEqual({
      clientIdempotencyKey: 'client-key-1',
      kind: 'text',
      content: 'hello',
    });
  });

  it('calls the server-owned image and TTS capability endpoints', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ images: ['data:image/png;base64,abc'], model: 'image-01' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          audioBase64: 'QUJD',
          format: 'mp3',
          model: 'speech-2.8-hd',
          durationMs: 900,
        }),
      );
    const client = new CloudClient({
      baseUrl: 'https://cloud.example',
      getAccessToken: () => 'access-token',
      fetchImpl,
    });

    await expect(
      client.generateImage({ prompt: 'a cat', aspectRatio: '4:3' }),
    ).resolves.toEqual({ images: ['data:image/png;base64,abc'], model: 'image-01' });
    await expect(client.synthesizeSpeech({ text: '你好' })).resolves.toEqual({
      audioBase64: 'QUJD',
      format: 'mp3',
      model: 'speech-2.8-hd',
      durationMs: 900,
    });

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://cloud.example/v1/capabilities/media/image',
      'https://cloud.example/v1/capabilities/media/tts',
    ]);
  });
});
