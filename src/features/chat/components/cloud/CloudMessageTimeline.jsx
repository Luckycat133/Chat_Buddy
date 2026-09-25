import React, { useEffect, useRef, useMemo } from 'react';
import { cn } from '../../../../utils/cn';
import { useLanguage } from '../../../../context/LanguageContext';
import { formatTimeSeparator, shouldShowTimeSeparator } from '../../../../utils/formatTime';

function CloudMessageBubble({ message, isMe, senderName, onRetry }) {
  const { t } = useLanguage();
  const failed = message.status === 'failed';

  if (failed) {
    return (
      <div
        role="alert"
        data-testid="cloud-message-error"
        className="mx-auto my-3 flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-bg-white)] px-4 py-3 text-sm text-[var(--color-text-main)] shadow-sm"
      >
        <span className="flex-1">{t('cloud_message_send_failed')}</span>
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 shrink-0 rounded-full bg-[var(--color-primary)] px-4 font-semibold text-white transition-opacity hover:opacity-90"
          aria-label={t('retry')}
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  const pending = message.status === 'pending';

  return (
    <div
      data-testid="cloud-message-bubble"
      data-message-id={message.id}
      className={cn(
        'flex mb-2 bubble-enter',
        isMe ? 'justify-end' : 'justify-start',
      )}
    >
      <div className={cn(
        'flex max-w-[92%] sm:max-w-[80%] gap-2.5 min-w-0',
        isMe ? 'flex-row-reverse' : 'flex-row',
      )}>
        {!isMe && (
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 shadow-sm bg-[var(--color-primary)] flex items-center justify-center text-white text-xs font-bold">
            {senderName?.charAt(0)}
          </div>
        )}
        <div className="relative min-w-0 overflow-visible">
          {!isMe && (
            <p className="text-xs text-[var(--color-text-muted)] mb-1 ml-1">{senderName}</p>
          )}
          <div
            className={cn(
              'px-3.5 py-2.5 rounded-[var(--radius-bubble)] shadow-sm border',
              isMe
                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-tr-sm border-transparent'
                : 'bg-[var(--color-bg-white)] text-[var(--color-text-main)] rounded-tl-sm border-[var(--color-border)]',
              pending && 'opacity-70',
            )}
          >
            <p className="whitespace-pre-wrap break-words text-[16px] leading-relaxed">{message.content}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CloudMessageTimeline({ messages, actorMap, currentActorId, onRetry }) {
  const { language, t } = useLanguage();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  const items = useMemo(() => {
    return messages.map((msg, index) => {
      const prev = index > 0 ? messages[index - 1] : null;
      const showTimeSeparator = shouldShowTimeSeparator(
        prev?.createdAt,
        msg.createdAt,
        5,
      );
      const isMe = msg.senderActorId === currentActorId;
      const sender = isMe
        ? { publicName: t('you') }
        : actorMap.get(msg.senderActorId);
      return {
        key: `${msg.id}-${msg.clientIdempotencyKey || ''}`,
        showTimeSeparator,
        time: msg.createdAt,
        message: msg,
        isMe,
        senderName: sender?.publicName || t('unknown_chat'),
      };
    });
  }, [messages, actorMap, currentActorId, t]);

  return (
    <div
      data-testid="cloud-message-timeline"
      className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4 custom-scrollbar"
    >
      {items.length === 0 && (
        <div className="h-full min-h-[40vh] flex flex-col items-center justify-center text-center px-8">
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {t('cloud_chat_empty_hint')}
          </p>
        </div>
      )}
      {items.map((item) => (
        <React.Fragment key={item.key}>
          {item.showTimeSeparator && (
            <div className="flex justify-center my-6">
              <span className="px-3 py-1 bg-[var(--color-bg-active)] text-[var(--color-text-muted)] text-[11px] font-medium rounded-full shadow-sm">
                {formatTimeSeparator(item.time, language)}
              </span>
            </div>
          )}
          <CloudMessageBubble
            message={item.message}
            isMe={item.isMe}
            senderName={item.senderName}
            onRetry={() => onRetry?.(item.message)}
          />
        </React.Fragment>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
