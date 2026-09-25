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

export interface TodayCalendarResult extends CalendarReadResult {
  date: string;
  timezone: string;
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

/** Read today's events from a connected provider in the account timezone. */
export async function readTodayCalendar(
  provider: string,
  timezone: string,
  now = new Date(),
): Promise<TodayCalendarResult> {
  const date = calendarDate(now, timezone);
  if (provider === 'demo') {
    return {
      date,
      timezone,
      source: 'demo',
      events: [
        {
          id: `demo-${date}-morning`,
          title: 'Morning check-in',
          start: zonedDateTimeToUtc(date, 9, 30, timezone).toISOString(),
          end: zonedDateTimeToUtc(date, 10, 0, timezone).toISOString(),
        },
        {
          id: `demo-${date}-afternoon`,
          title: 'Afternoon focus',
          start: zonedDateTimeToUtc(date, 15, 0, timezone).toISOString(),
          end: zonedDateTimeToUtc(date, 16, 0, timezone).toISOString(),
        },
      ],
    };
  }

  const result = await requestCalendarAction({ operation: 'read' });
  return {
    ...result,
    date,
    timezone,
    events: result.events.filter((event) => {
      const start = Date.parse(event.start);
      const end = Date.parse(event.end || event.start);
      return (
        calendarDate(new Date(start), timezone) === date ||
        calendarDate(new Date(end), timezone) === date
      );
    }),
  };
}

export function calendarDate(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) throw new Error('invalid calendar timezone');
  return `${year}-${month}-${day}`;
}

function zonedDateTimeToUtc(
  date: string,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  const [yearText, monthText, dayText] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!year || !month || !day) throw new Error('invalid calendar date');
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let instant = new Date(
    desired - timezoneOffsetMs(new Date(desired), timezone),
  );
  instant = new Date(desired - timezoneOffsetMs(instant, timezone));
  return instant;
}

function timezoneOffsetMs(value: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(value);
  const timeZoneName = parts.find((part) => part.type === 'timeZoneName')?.value;
  if (!timeZoneName || timeZoneName === 'GMT') return 0;
  const match = timeZoneName.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === '+' ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3])) * 60_000;
}
