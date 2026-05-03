import { useState, useEffect, useCallback } from 'react';
import { createLogger } from '../utils/logger';

const log = createLogger('useNetworkStatus');

const EVENTS = ['online', 'offline'];

export function useNetworkStatus({ onOnline, onOffline } = {}) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const handleOnline = useCallback(() => {
    log.info('Network restored');
    setIsOnline(true);
    onOnline?.();
  }, [onOnline]);

  const handleOffline = useCallback(() => {
    log.warn('Network lost');
    setIsOnline(false);
    onOffline?.();
  }, [onOffline]);

  useEffect(() => {
    EVENTS.forEach(event => window.addEventListener(event, event === 'online' ? handleOnline : handleOffline));
    return () => {
      EVENTS.forEach(event => window.removeEventListener(event, event === 'online' ? handleOnline : handleOffline));
    };
  }, [handleOnline, handleOffline]);

  return isOnline;
}

export function NetworkStatusBanner() {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[var(--z-toast)] bg-[var(--color-warning)] text-black text-center py-2 px-4 text-sm font-medium animate-fade-slide-down"
    >
      You are offline. Messages will be queued and sent when connection is restored.
    </div>
  );
}
