/**
 * Calendar adapter per DOMAIN_ARCHITECTURE §11. Writes require client
 * confirmation; the server-side propose path returns a confirmation
 * envelope, and success is only claimed after `/calendar/result` posts
 * the structured result back.
 */
import { serverEnv } from '../config.js';

export interface CalendarReadResult {
  events: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    notes?: string;
  }>;
  source: string;
}

export interface CalendarAction {
  operation: 'read' | 'create' | 'update' | 'delete';
  title?: string;
  start?: string;
  end?: string;
  notes?: string;
  eventId?: string;
}

export async function requestCalendarAction(
  action: CalendarAction,
): Promise<CalendarReadResult> {
  const env = serverEnv();
  if (!env.WEATHER_PROVIDER_URL) {
    throw new Error('calendar provider not configured');
  }
  if (action.operation !== 'read') {
    // Writes must be confirmed client-side; the adapter does not act
    // until the client posts back via `/v1/capabilities/calendar/result`.
    return { events: [], source: 'awaiting_confirmation' };
  }
  const url = new URL('/v1/calendar/events', env.WEATHER_PROVIDER_URL);
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${env.WEATHER_PROVIDER_KEY ?? ''}`,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    throw new Error(`calendar provider returned ${res.status}`);
  }
  const raw = (await res.json()) as { events: CalendarReadResult['events'] };
  return { events: raw.events, source: env.WEATHER_PROVIDER_URL };
}