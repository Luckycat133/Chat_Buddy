import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Laptop, RefreshCw, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { authedCloudFetch } from '../api/cloud-adapter.js';
import { cn } from '../utils/cn.js';

async function jsonRequest(path, init = {}) {
  const response = await authedCloudFetch(path, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || `HTTP ${response.status}`);
  }
  return body;
}

function formatDeviceTime(value, language, t) {
  if (!value) return t('device_session_unknown');
  try {
    const formatted = new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
    return t('device_session_last_seen', { time: formatted });
  } catch {
    return t('device_session_unknown');
  }
}

export function DeviceSessionsPanel() {
  const { t, language } = useLanguage();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const body = await jsonRequest('/v1/auth/sessions');
      setItems(Array.isArray(body.items) ? body.items : []);
      setStatus('ready');
    } catch (error) {
      setStatus(error.message || 'error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const revoke = async (item) => {
    if (item.current || !window.confirm(t('revoke_session'))) return;
    setBusyId(item.id);
    try {
      await jsonRequest(`/v1/auth/sessions/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      setStatus(t('session_revoked'));
      await load();
    } catch (error) {
      setStatus(error.message || t('session_revoke_failed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="glass-crystal rounded-[var(--radius-2xl)] p-5 shadow-floating">
      <div className="flex items-start gap-3 mb-4">
        <div className="page-header-icon shrink-0"><Laptop size={20} /></div>
        <div className="min-w-0">
          <h2 className="font-bold text-[var(--color-text-primary)]">{t('device_sessions')}</h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t('device_sessions_desc')}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-icon ml-auto" onClick={load} aria-label={t('refresh_sessions')}>
          <RefreshCw size={16} className={status === 'loading' ? 'animate-spin' : ''} />
        </button>
      </div>
      {status === 'loading' && <p className="text-sm text-[var(--color-text-muted)]">{t('loading')}</p>}
      {status !== 'loading' && status !== 'ready' && <p className="text-sm text-[var(--color-danger)]">{status}</p>}
      {status === 'ready' && (
        <div className="space-y-2">
          {items.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">{t('device_session_unknown')}</p>}
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-bg-white)]/60 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate text-[var(--color-text-primary)]">
                  {item.userAgent || t('device_session_unknown')}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {formatDeviceTime(item.lastSeenAt, language, t)}
                  {item.current ? ` · ${t('device_session_current')}` : ''}
                </p>
              </div>
              <button
                type="button"
                className={cn('btn btn-ghost btn-icon text-[var(--color-danger)]', item.current && 'opacity-40 cursor-not-allowed')}
                disabled={item.current || busyId === item.id}
                onClick={() => revoke(item)}
                aria-label={t('revoke_session')}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function TodaySchedulePanel() {
  const { t, language } = useLanguage();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setData(await jsonRequest('/v1/capabilities/calendar/today'));
      setStatus('ready');
    } catch (error) {
      setStatus(error.message || 'error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    setBusy(true);
    try {
      await jsonRequest('/v1/capabilities/calendar/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'demo' }),
      });
      await load();
    } catch (error) {
      setStatus(error.message || t('calendar_connect_failed'));
    } finally {
      setBusy(false);
    }
  };

  const formatTime = (value) => {
    try {
      return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
        hour: '2-digit', minute: '2-digit',
      }).format(new Date(value));
    } catch { return value; }
  };

  return (
    <section className="glass-crystal rounded-[var(--radius-2xl)] p-5 shadow-floating">
      <div className="flex items-start gap-3 mb-4">
        <div className="page-header-icon shrink-0"><CalendarDays size={20} /></div>
        <div className="min-w-0">
          <h2 className="font-bold text-[var(--color-text-primary)]">{t('today_schedule')}</h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t('today_schedule_desc')}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-icon ml-auto" onClick={load} aria-label={t('refresh_sessions')}>
          <RefreshCw size={16} className={status === 'loading' ? 'animate-spin' : ''} />
        </button>
      </div>
      {status === 'loading' && <p className="text-sm text-[var(--color-text-muted)]">{t('loading')}</p>}
      {status !== 'loading' && status !== 'ready' && <p className="text-sm text-[var(--color-danger)]">{status}</p>}
      {status === 'ready' && data?.connected === false && (
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-white)]/60 p-4">
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">
            {data.guidance?.message || t('calendar_not_connected')}
          </p>
          <button type="button" className="btn-primary text-xs px-3 py-2" onClick={connect} disabled={busy}>
            {busy ? t('loading') : t('calendar_connect_demo')}
          </button>
        </div>
      )}
      {status === 'ready' && data?.connected === true && (
        data.events?.length ? (
          <div className="space-y-2">
            {data.events.map((event) => (
              <div key={event.id} className="rounded-[var(--radius-lg)] bg-[var(--color-bg-white)]/60 px-3 py-2.5">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{event.title}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {t('calendar_event_time', { start: formatTime(event.start), end: formatTime(event.end) })}
                </p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-[var(--color-text-muted)]">{t('calendar_no_events')}</p>
      )}
    </section>
  );
}
