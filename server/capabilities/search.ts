/**
 * Lightweight web search adapter per DOMAIN_ARCHITECTURE §11.
 * One bounded retrieval; no recursive deep-research. The synthesized
 * answer lives in the runtime; this adapter only returns raw results
 * with source metadata.
 */
import { serverEnv } from '../config.js';

export interface SearchResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    retrievedAt: string;
  }>;
  source: string;
}

interface RawSearchProvider {
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
}

export async function fetchLightSearch(query: string): Promise<SearchResult> {
  const env = serverEnv();
  if (!env.SEARCH_PROVIDER_URL || !env.SEARCH_PROVIDER_KEY) {
    throw new Error('search provider not configured');
  }
  const url = new URL('/v1/search', env.SEARCH_PROVIDER_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${env.SEARCH_PROVIDER_KEY}`,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    throw new Error(`search provider returned ${res.status}`);
  }
  const raw = (await res.json()) as RawSearchProvider;
  const retrievedAt = new Date().toISOString();
  return {
    query,
    results: raw.results.map((r) => ({ ...r, retrievedAt })),
    source: env.SEARCH_PROVIDER_URL,
  };
}