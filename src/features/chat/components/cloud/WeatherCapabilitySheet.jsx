import React, { useEffect, useState } from 'react';
import { CloudSun, X } from 'lucide-react';
import { useLanguage } from '../../../../context/LanguageContext';
import {
  authedCloudFetch,
  cloudEnabled,
} from '../../../../api/cloud-adapter';

/**
 * Weather capability consent entry (WEB_IMPLEMENTATION §19).
 *
 * The authorization gesture lives in the app: the user toggles the
 * capability and may store a default city. Values persist through
 * POST /v1/capabilities/settings (pure consent write — never a provider
 * call), and failures are surfaced truthfully instead of faking success.
 * Data minimization (§10): only the chosen city is stored; the sheet
 * never touches browser geolocation.
 */
export default function WeatherCapabilitySheet({ open, onClose }) {
  const { t } = useLanguage();
  const [loadState, setLoadState] = useState('idle'); // idle|loading|ready|error
  const [loadError, setLoadError] = useState(null);
  const [consent, setConsent] = useState(false);
  const [city, setCity] = useState('');
  const [saveState, setSaveState] = useState('idle'); // idle|saving|saved|error
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let ignored = false;
    (async () => {
      setLoadState('loading');
      setLoadError(null);
      setSaveState('idle');
      setSaveError(null);
      if (!cloudEnabled()) {
        if (!ignored) {
          setLoadState('error');
          setLoadError('cloud mode is disabled');
        }
        return;
      }
      try {
        const res = await authedCloudFetch('/v1/capabilities/settings');
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error?.message || `HTTP ${res.status}`);
        }
        if (!ignored) {
          setConsent(Boolean(data?.weatherConsent));
          setCity(typeof data?.weatherCity === 'string' ? data.weatherCity : '');
          setLoadState('ready');
        }
      } catch (err) {
        if (!ignored) {
          setLoadError(err?.message || String(err));
          setLoadState('error');
        }
      }
    })();
    return () => {
      ignored = true;
    };
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    setSaveState('saving');
    setSaveError(null);
    try {
      const res = await authedCloudFetch('/v1/capabilities/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          weatherConsent: consent,
          weatherCity: city.trim() ? city.trim() : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }
      setSaveState('saved');
      onClose();
    } catch (err) {
      setSaveError(err?.message || String(err));
      setSaveState('error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      data-testid="weather-capability-sheet"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={t('weather_capability_title')}
        className="w-full max-w-md rounded-t-3xl bg-[var(--color-bg-white)] p-5 shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[17px] font-bold text-[var(--color-text-main)]">
            <CloudSun size={20} className="text-[var(--color-primary)]" />
            {t('weather_capability_title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('cancel')}
            className="rounded-full p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]"
          >
            <X size={18} />
          </button>
        </div>

        {loadState === 'loading' && (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
            {t('loading')}
          </p>
        )}

        {loadState === 'error' && (
          <p
            role="alert"
            data-testid="weather-settings-error"
            className="py-4 text-center text-sm text-[var(--color-danger)]"
          >
            {t('weather_settings_error', { message: loadError ?? '' })}
          </p>
        )}

        {loadState === 'ready' && (
          <div>
            <p className="mb-4 text-sm text-[var(--color-text-muted)]">
              {t('weather_capability_desc')}
            </p>

            <label className="mb-4 flex items-center justify-between gap-3">
              <span className="text-[15px] text-[var(--color-text-main)]">
                {t('weather_enable_label')}
              </span>
              <input
                type="checkbox"
                role="switch"
                data-testid="weather-consent-toggle"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="h-6 w-11 appearance-none rounded-full bg-[var(--color-bg-hover)] transition-colors checked:bg-[var(--color-primary)] relative cursor-pointer"
              />
            </label>

            <label className="mb-5 block">
              <span className="mb-1 block text-[13px] text-[var(--color-text-muted)]">
                {t('weather_city_label')}
              </span>
              <input
                type="text"
                data-testid="weather-city-input"
                value={city}
                maxLength={120}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t('weather_city_placeholder')}
                className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-chat)] px-3 text-[15px] text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)]"
              />
            </label>

            {saveState === 'error' && (
              <p
                role="alert"
                data-testid="weather-save-error"
                className="mb-3 text-sm text-[var(--color-danger)]"
              >
                {t('weather_settings_error', { message: saveError ?? '' })}
              </p>
            )}

            <button
              type="button"
              data-testid="weather-save-button"
              onClick={handleSave}
              disabled={saveState === 'saving'}
              className="min-h-11 w-full rounded-full bg-[var(--color-primary)] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saveState === 'saving' ? t('loading') : t('weather_save')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
