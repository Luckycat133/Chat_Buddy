/**
 * Realtime gateway per WEB_IMPLEMENTATION §8 + DOMAIN_ARCHITECTURE §12.
 *
 * One authenticated WebSocket manager per session. The gateway is
 * intentionally minimal here: it authenticates, registers channels,
 * and fans out events emitted by other workers.
 *
 * Production wiring would persist channels per account, dedupe by
 * event id, and apply ordered replay after reconnect.
 */
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';

interface RealtimeClient {
  socket: WebSocket;
  accountId: string;
  actorId: string;
  channels: Set<string>;
}

const clients = new Set<RealtimeClient>();

export function registerRealtimeGateway(app: FastifyInstance): void {
  app.get('/v1/realtime', { websocket: true }, (socket, request) => {
    const ctx = request.requestContext;
    if (!ctx.accountId || !ctx.actorId) {
      socket.close(4401, 'unauthorized');
      return;
    }
    const client: RealtimeClient = {
      socket,
      accountId: ctx.accountId,
      actorId: ctx.actorId,
      channels: new Set([`actor:${ctx.actorId}`]),
    };
    clients.add(client);
    socket.on('close', () => {
      clients.delete(client);
    });
    socket.on('message', (raw: Buffer | string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (
        parsed &&
        typeof parsed === 'object' &&
        'subscribe' in parsed &&
        typeof (parsed as { subscribe: unknown }).subscribe === 'string'
      ) {
        client.channels.add((parsed as { subscribe: string }).subscribe);
      }
    });
  });
}

export function broadcastEvent(channel: string, payload: unknown): number {
  const frame = JSON.stringify({ channel, payload });
  let sent = 0;
  for (const c of clients) {
    if (c.channels.has(channel) && c.socket.readyState === c.socket.OPEN) {
      c.socket.send(frame);
      sent += 1;
    }
  }
  return sent;
}

// Channel conventions per DOMAIN_ARCHITECTURE §12:
//   actor:<actor_id>           direct events for an actor
//   conversation:<id>          conversation-level events
//   moment:<id>                Moment interactions
//   friend_request:<actor_id>  friend-request state changes for an actor
//   group_invitation:<actor_id> group-invitation state changes for an actor