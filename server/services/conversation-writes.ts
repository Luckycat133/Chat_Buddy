import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { conversations, messageBursts, messages, worldEvents } from '../../db/schema.js';
import { newId } from '../../shared/contracts/ids.js';

export type ConversationWriteTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Conversation = typeof conversations.$inferSelect;

export function conversationAdvisoryKey(conversationId: string): string {
  const value = BigInt(`0x${conversationId.replace(/-/g, '')}`);
  return (value & ((1n << 63n) - 1n)).toString();
}

/** Serialize human, generated and proactive message/burst writes per conversation. */
export async function withConversationWrite<T>(
  db: Database,
  conversationId: string,
  write: (tx: ConversationWriteTransaction, conversation: Conversation | undefined) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(${conversationAdvisoryKey(conversationId)})`);
        const [conversation] = await tx.select().from(conversations).where(eq(conversations.id, conversationId));
        return write(tx, conversation);
      }, { isolationLevel: 'read committed' });
    } catch (error) {
      // Also tolerate a concurrent writer that still runs the previous protocol.
      if (attempt >= 5 || !isMessageCollision(error)) throw error;
    }
  }
}

function isMessageCollision(error: unknown): boolean {
  let inner = error as { code?: string; constraint?: string; constraint_name?: string; cause?: unknown } | undefined;
  for (let count = 0; inner && count < 5; count++) {
    const constraint = inner.constraint_name ?? inner.constraint;
    if (inner.code === '23505' && (constraint === 'messages_conv_seq_idx' || constraint === 'messages_idempotency_idx')) return true;
    inner = inner.cause as typeof inner;
  }
  return false;
}

export async function findMessageByKey(db: Pick<Database, 'select'>, conversationId: string, key: string) {
  const [row] = await db.select().from(messages).where(and(
    eq(messages.conversationId, conversationId),
    eq(messages.clientIdempotencyKey, key),
  ));
  return row;
}

export async function findConversationEvent(
  db: Pick<Database, 'select'>,
  conversation: Pick<Conversation, 'id' | 'socialGraphId'>,
  key: string,
) {
  const [event] = await db.select({ id: worldEvents.id }).from(worldEvents).where(and(
    eq(worldEvents.socialGraphId, conversation.socialGraphId),
    eq(worldEvents.conversationId, conversation.id),
    eq(worldEvents.idempotencyKey, key),
  ));
  return event;
}

interface MessageEvent {
  type?: 'message_sent' | 'proactive_message_sent';
  idempotencyKey?: string;
  subjectActorIds?: string[];
  causedByEventId?: string;
  payload?: Record<string, unknown>;
}

type MessageFields = Pick<
  typeof messages.$inferInsert,
  'senderActorId' | 'clientIdempotencyKey' | 'kind' | 'content' | 'replyToMessageId' | 'createdAt'
>;

/** Call with the transaction supplied by withConversationWrite. */
export async function appendConversationMessage(
  tx: ConversationWriteTransaction,
  conversation: Conversation,
  input: MessageFields,
  options: { openBurst: boolean; event?: MessageEvent },
) {
  const [next] = await tx.select({ sequence: sql<number>`coalesce(max(${messages.sequence}), 0) + 1` })
    .from(messages).where(eq(messages.conversationId, conversation.id));
  const sequence = next?.sequence ?? 1;
  const burstId = options.openBurst
    ? await openOrExtendBurst(tx, conversation.id, input.senderActorId, sequence)
    : null;
  const id = newId<string>();
  const event = options.event;
  // Clients historically could choose any key. A server write can retain its
  // event receipt even when an existing client used its preferred message key.
  const clientIdempotencyKey = event?.idempotencyKey && await findMessageByKey(tx, conversation.id, input.clientIdempotencyKey)
    ? `${input.clientIdempotencyKey}:${id}`
    : input.clientIdempotencyKey;
  const [message] = await tx.insert(messages).values({
    ...input,
    clientIdempotencyKey,
    id,
    conversationId: conversation.id,
    sequence,
    burstId,
    status: 'accepted',
  }).returning();
  await tx.insert(worldEvents).values({
    socialGraphId: conversation.socialGraphId,
    actorId: input.senderActorId,
    type: event?.type ?? 'message_sent',
    subjectActorIds: event?.subjectActorIds ?? [input.senderActorId],
    conversationId: conversation.id,
    payload: { ...event?.payload, messageId: id, sequence, burstId },
    visibilityPolicy: { conversation: conversation.id },
    causedByEventId: event?.causedByEventId,
    idempotencyKey: event?.idempotencyKey ?? `message_sent:${id}`,
  });
  return message!;
}

export async function latestOpenBurst(tx: ConversationWriteTransaction, conversationId: string, actorId: string) {
  const [open] = await tx.select().from(messageBursts).where(and(
    eq(messageBursts.conversationId, conversationId),
    eq(messageBursts.senderActorId, actorId),
    isNull(messageBursts.closedAt),
  )).orderBy(desc(messageBursts.openedAt)).limit(1);
  return open;
}

async function openOrExtendBurst(
  tx: ConversationWriteTransaction,
  conversationId: string,
  senderActorId: string,
  sequence: number,
): Promise<string> {
  const open = await latestOpenBurst(tx, conversationId, senderActorId);
  if (open) {
    await tx.update(messageBursts).set({ lastMessageSequence: sequence }).where(eq(messageBursts.id, open.id));
    return open.id;
  }
  const id = newId<string>();
  await tx.insert(messageBursts).values({
    id,
    conversationId,
    senderActorId,
    firstMessageSequence: sequence,
    lastMessageSequence: sequence,
    openedAt: new Date(),
  });
  return id;
}
