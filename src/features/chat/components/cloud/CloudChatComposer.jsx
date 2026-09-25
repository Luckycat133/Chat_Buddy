import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useLanguage } from '../../../../context/LanguageContext';
import { useDraft } from '../../hooks/useDraft';

export default function CloudChatComposer({ conversationId, onSend, sendStatus }) {
  const { t } = useLanguage();
  const { draftContent, updateDraftContent, clearDraft } = useDraft(conversationId);
  const [inputValue, setInputValue] = useState(() => draftContent || '');
  const inputRef = useRef(null);
  const draftSyncFrameRef = useRef(null);
  const prevDraftContentRef = useRef(draftContent);

  useEffect(() => {
    if (draftContent !== prevDraftContentRef.current) {
      prevDraftContentRef.current = draftContent;
      draftSyncFrameRef.current = requestAnimationFrame(() => {
        setInputValue(draftContent || '');
        draftSyncFrameRef.current = null;
      });
    }
    return () => {
      if (draftSyncFrameRef.current !== null) {
        cancelAnimationFrame(draftSyncFrameRef.current);
      }
    };
  }, [draftContent]);

  const handleChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    updateDraftContent(value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    const result = await onSend(trimmed);
    if (result?.success !== false) {
      setInputValue('');
      clearDraft();
      if (inputRef.current) inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const sending = sendStatus === 'sending';

  return (
    <div className="composer-wrap">
      <div className="composer-box glass-crystal">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="composer-input-wrap flex-1">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              aria-label={t('type_message')}
              placeholder={t('type_message')}
              className="composer-input resize-none overflow-y-auto"
              rows={1}
              // Composer never disabled: the cloud contract allows burst
              // input, and failures are surfaced as retryable alerts instead
              // of locking the input.
            />
          </div>
          <button
            type="submit"
            className="composer-send-btn"
            aria-label={t('send')}
            disabled={!inputValue.trim()}
          >
            {sending ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={22} className="ml-0.5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
