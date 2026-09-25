/**
 * Weather adapter. Per DOMAIN_ARCHITECTURE §11 the response is normalized
 * with timestamp + source metadata and never fabricated. Provider is
 * selected from env; failures surface to the runtime, never to a fake
 * success.
 */
import { serverEnv } from '../config.js';

export interface WeatherResult {
  city: string;
  temperatureC: number;
  condition: string;
  observedAt: string;
  source: string;
}

interface RawWeatherProvider {
  city?: string;
  temperatureC: number;
  condition: string;
  observedAt: string;
}

export interface WeatherQuery {
  /** Selected city name (stored as the actor default). */
  city?: string;
  /** Coarse browser approximate location after a user gesture (§19). */
  location?: { lat: number; lon: number };
}

export async function fetchWeather(query: WeatherQuery): Promise<WeatherResult> {
  const env = serverEnv();
  if (!env.WEATHER_PROVIDER_URL || !env.WEATHER_PROVIDER_KEY) {
    throw new Error('weather provider not configured');
  }
  const weatherBase = env.WEATHER_PROVIDER_URL!.endsWith('/')
    ? env.WEATHER_PROVIDER_URL
    : `${env.WEATHER_PROVIDER_URL}/`;
  const url = new URL('v1/weather', weatherBase);
  if (query.city) {
    url.searchParams.set('city', query.city);
  }
  if (query.location) {
    // Coarse precision only: one decimal (~11 km) per §10 data minimization.
    url.searchParams.set('lat', query.location.lat.toFixed(1));
    url.searchParams.set('lon', query.location.lon.toFixed(1));
  }
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${env.WEATHER_PROVIDER_KEY}`,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    throw new Error(`weather provider returned ${res.status}`);
  }
  const raw = (await res.json()) as RawWeatherProvider;
  const city =
    raw.city ??
    query.city ??
    (query.location
      ? `${query.location.lat.toFixed(1)},${query.location.lon.toFixed(1)}`
      : '');
  return {
    city,
    temperatureC: raw.temperatureC,
    condition: raw.condition,
    observedAt: raw.observedAt,
    source: env.WEATHER_PROVIDER_URL,
  };
}
