/**
 * Cloud bridge — opt-in React context provider that exposes the typed
 * `CloudClient` to the existing UI without a full migration.
 *
 * Existing contexts (FriendContext, SocialContext, etc.) can call
 * `useCloud()` to access the live cloud backend; when
 * `VITE_USE_CLOUD !== 'true'` they keep their current local-only paths.
 *
 * The bridge:
 *   - Signs in via the dev convenience endpoint on first mount.
 *   - Persists tokens in sessionStorage via `cloud-adapter.ts`.
 *   - Exposes `{ client, tokens, actorId, accountId, ready, error }`.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { CloudClient, CloudRequestError } from './client.js';
import {
  cloudEnabled,
  devSignIn,
  loadTokens,
  clearTokens,
} from './cloud-adapter.js';

interface CloudBridgeValue {
  ready: boolean;
  error: string | null;
  client: CloudClient;
  tokens: ReturnType<typeof loadTokens>;
  actorId: string | null;
  accountId: string | null;
  signOut: () => void;
}

const Ctx = createContext<CloudBridgeValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  baseUrl?: string;
  displayName?: string;
}

export function CloudBridgeProvider({
  children,
  baseUrl,
  displayName,
}: ProviderProps) {
  const client = useMemo(
    () =>
      new CloudClient({
        baseUrl:
          baseUrl ??
          (import.meta.env.VITE_CLOUD_BASE_URL as string | undefined) ??
          'http://localhost:8080',
        getAccessToken: () => loadTokens().accessToken,
      }),
    [baseUrl],
  );
  const [tokens, setTokens] = useState(() => loadTokens());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = cloudEnabled();
  const name =
    displayName ??
    (import.meta.env.VITE_DEMO_DISPLAY_NAME as string | undefined) ??
    'Demo User';

  useEffect(() => {
    let cancelled = false;
    async function bootstrap(): Promise<void> {
      if (!enabled) {
        setReady(true);
        return;
      }
      try {
        if (!tokens.accessToken) {
          const issued = await devSignIn(name);
          setTokens({
            accessToken: issued.accessToken,
            refreshToken: issued.refreshToken,
            actorId: issued.actorId,
            accountId: issued.accountId,
          });
        }
        if (!cancelled) setReady(true);
      } catch (err) {
        const message =
          err instanceof CloudRequestError
            ? `${err.code}: ${err.message}`
            : err instanceof Error
              ? err.message
              : String(err);
        if (!cancelled) {
          setError(message);
          setReady(true);
        }
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [enabled, name, tokens.accessToken]);

  const signOut = useCallback(() => {
    clearTokens();
    setTokens({
      accessToken: null,
      refreshToken: null,
      actorId: null,
      accountId: null,
    });
  }, []);

  const value = useMemo<CloudBridgeValue>(
    () => ({
      ready,
      error,
      client,
      tokens,
      actorId: tokens.actorId,
      accountId: tokens.accountId,
      signOut,
    }),
    [ready, error, client, tokens, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCloud(): CloudBridgeValue {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error('useCloud must be used inside CloudBridgeProvider');
  }
  return v;
}