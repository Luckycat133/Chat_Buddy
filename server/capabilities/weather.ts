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
  city: string;
  temperatureC: number;
  condition: string;
  observedAt: string;
}

export async function fetchWeather(city: string): Promise<WeatherResult> {
  const env = serverEnv();
  if (!env.WEATHER_PROVIDER_URL || !env.WEATHER_PROVIDER_KEY) {
    throw new Error('weather provider not configured');
  }
  const url = new URL('/v1/weather', env.WEATHER_PROVIDER_URL);
  url.searchParams.set('city', city);
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
  return {
    city: raw.city,
    temperatureC: raw.temperatureC,
    condition: raw.condition,
    observedAt: raw.observedAt,
    source: env.WEATHER_PROVIDER_URL,
  };
}