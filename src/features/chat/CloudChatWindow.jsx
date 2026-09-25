import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CloudSun } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useCloudMessages } from './hooks/useCloudMessages';
import CloudMessageTimeline from './components/cloud/CloudMessageTimeline';
import CloudChatComposer from './components/cloud/CloudChatComposer';
import WeatherCapabilitySheet from './components/cloud/WeatherCapabilitySheet';

export default function CloudChatWindowRoute() {
  const { conversationId } = useParams();
  // Remount per conversation: message/sending state can never bleed from
  // one cloud conversation into the next.
  return <CloudChatWindow key={conversationId ?? 'none'} conversationId={conversationId} />;
}

function CloudChatWindow({ conversationId }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
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
  } = useCloudMessages(conversationId);

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
