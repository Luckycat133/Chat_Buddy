/**
 * Push notification contract per WEB_IMPLEMENTATION §15 ("send APNs
 * through the backend, record delivery attempts") and
 * DOMAIN_ARCHITECTURE §10 ("send APNs/Web notification").
 *
 * The worker depends on the `PushPort` interface only. Real APNs
 * credentials/transport are out of scope for the P0 contract: the default
 * `NoopPushPort` succeeds without side effects so the delivery-attempt
 * ledger can be exercised end to end.
 */

export type PushChannel = 'apns' | 'web';

export interface PushSendInput {
  actorId: string;
  intentId: string;
  conversationId?: string;
  messageId?: string;
  title?: string;
  body?: string;
}

export interface PushResult {
  ok: boolean;
  /** Machine-readable outcome detail, stored with the attempt record. */
  detail: string;
}

export interface PushPort {
  readonly channel: PushChannel;
  send(input: PushSendInput): Promise<PushResult>;
}

/**
 * Contract stub: no real delivery. Always succeeds so the proactive
 * worker records a succeeded attempt without requiring APNs credentials.
 */
export class NoopPushPort implements PushPort {
  readonly channel: PushChannel = 'apns';

  async send(_input: PushSendInput): Promise<PushResult> {
    void _input;
    return { ok: true, detail: 'noop: P0 push contract stub' };
  }
}

/** Push port that always fails; used by tests and credential-less runs. */
export class FailingPushPort implements PushPort {
  readonly channel: PushChannel = 'apns';

  constructor(private readonly detail = 'push failed (simulated)') {}

  async send(_input: PushSendInput): Promise<PushResult> {
    void _input;
    return { ok: false, detail: this.detail };
  }
}
