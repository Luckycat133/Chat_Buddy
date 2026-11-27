import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CloudSun } from 'lucide-react';
import { MIRA_WELCOME_MESSAGE_KEY } from '../../../shared/contracts/message';
import { authedCloudFetch } from '../../api/cloud-adapter';
import { useLanguage } from '../../context/LanguageContext';
import { useCloudMessages } from './hooks/useCloudMessages';
import CloudMessageTimeline from './components/cloud/CloudMessageTimeline';
import CloudChatComposer from './components/cloud/CloudChatComposer';
import WeatherCapabilitySheet from './components/cloud/WeatherCapabilitySheet';

export default function CloudChatWindowRoute() {
  const { conversationId } = useParams();
  const [search] = useSearchParams();
  const from = Number(search.get('restoredFrom'));
  const firstSequence = Number.isSafeInteger(from) && from > 0 && from <= 2147483647 ? from : undefined;
  // Remount per conversation: message/sending state can never bleed from
  // one cloud conversation into the next.
  return <CloudChatWindow key={`${conversationId ?? 'none'}:${firstSequence ?? ''}`} conversationId={conversationId} firstSequence={firstSequence} />;
}

function CloudChatWindow({ conversationId, firstSequence }) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const restoredView = firstSequence !== undefined;
  const label = (zh, en) => language === 'zh' ? zh : en;
  const [weatherSheetOpen, setWeatherSheetOpen] = useState(false);
  const {
    status,
    messages,
    error,
    sendStatus,
    sendError,
    sendMessage,
    dismissSendError,
    refetch,
    actorMap,
    currentActorId,
  } = useCloudMessages(conversationId, firstSequence);

  const postedWelcome = useRef(null);
  const welcomeId = !restoredView && status === 'ready' ? messages.find((message) =>
    message.clientIdempotencyKey === MIRA_WELCOME_MESSAGE_KEY &&
    message.senderActorId !== currentActorId &&
    message.status === 'accepted' && !message.deletedAt)?.id : null;

  // A committed welcome bubble, not opening the chat, triggers the receipt.
  useEffect(() => {
    if (!welcomeId || postedWelcome.current === welcomeId) return;
    postedWelcome.current = welcomeId;
    authedCloudFetch('/v1/onboarding/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId, messageId: welcomeId }),
    }).then((response) => {
      if (!response.ok) postedWelcome.current = null;
    }).catch(() => {
      // The timeline stays usable. Reopening retries an unpersisted receipt.
      postedWelcome.current = null;
    });
  }, [conversationId, welcomeId]);

  const handleSend = async (content) => {
    dismissSendError();
    return sendMessage(content);
  };

  const handleRetry = (message) => {
    // Retry resends the same content with a fresh idempotency key.
    handleSend(message.content);
  };

  if (status === 'loading') {
    return (
      <div className="flex flex-col h-full bg-[var(--color-bg-chat)] flex-1 items-center justify-center text-[var(--color-text-muted)]">
        {t('loading')}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        role="alert"
        data-testid="cloud-chat-error"
        className="flex flex-col h-full bg-[var(--color-bg-chat)] flex-1 items-center justify-center px-8 text-center"
      >
        <p className="text-[var(--color-text-main)] mb-4">{t('cloud_chat_load_error', { message: error })}</p>
        <button
          type="button"
          onClick={refetch}
          className="min-h-11 rounded-full bg-[var(--color-primary)] px-6 font-semibold text-white transition-opacity hover:opacity-90"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  if (restoredView) {
    const last = messages.at(-1)?.sequence;
    return (
      <div className="flex flex-col h-full bg-[var(--color-bg-chat)] flex-1">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          <h1>{label('已恢复消息（只读）', 'Restored messages (read-only)')}</h1>
          <Link to={`/chats/${conversationId}`}>{label('打开在线会话', 'Open live conversation')}</Link>
          {messages.length === 100 && last < 2147483647 &&
            <Link to={`?restoredFrom=${last + 1}`}>{label('下一页', 'Next page')}</Link>}
        </header>
        <CloudMessageTimeline messages={messages} actorMap={actorMap} currentActorId={currentActorId} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-chat)] flex-1">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]/50 bg-[var(--color-bg-white)]/40 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => navigate('/chats')}
          className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors"
          aria-label={t('back')}
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-[17px] font-bold text-[var(--color-text-main)]">{t('cloud_chat_title')}</h1>
        <button
          type="button"
          data-testid="weather-capability-button"
          onClick={() => setWeatherSheetOpen(true)}
          className="ml-auto p-2 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors"
          aria-label={t('weather_capability_title')}
        >
          <CloudSun size={20} />
        </button>
      </header>

      <WeatherCapabilitySheet
        open={weatherSheetOpen}
        onClose={() => setWeatherSheetOpen(false)}
      />

      <CloudMessageTimeline
        messages={messages}
        actorMap={actorMap}
        currentActorId={currentActorId}
        onRetry={handleRetry}
      />

      {sendError && (
        <div
          role="alert"
          data-testid="cloud-composer-error"
          className="mx-4 mb-2 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-bg-white)] px-4 py-2 text-sm text-[var(--color-text-main)] shadow-sm"
        >
          {sendError}
        </div>
      )}

      <CloudChatComposer
        conversationId={conversationId}
        onSend={handleSend}
        sendStatus={sendStatus}
      />
    </div>
  );
}
