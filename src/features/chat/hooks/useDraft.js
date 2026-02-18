import { useState, useEffect, useCallback, useRef } from 'react';
import { storage } from '../../../services/storage/StorageService';

const DRAFTS_KEY = 'message-drafts';

/**
 * Load draft from storage
 */
function loadDraftFromStorage(chatId) {
    if (!chatId) return { content: '', quotedMessageId: null };

    const drafts = storage.get(DRAFTS_KEY, {});
    const chatDraft = drafts[chatId];

    if (chatDraft) {
        // Check if draft is not too old (7 days)
        const draftAge = Date.now() - new Date(chatDraft.savedAt).getTime();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

        if (draftAge < maxAge) {
            return {
                content: chatDraft.content || '',
                quotedMessageId: chatDraft.quotedMessageId || null
            };
        } else {
            // Remove expired draft
            delete drafts[chatId];
            storage.set(DRAFTS_KEY, drafts);
        }
    }
    return { content: '', quotedMessageId: null };
}

/**
 * Hook for managing message drafts with auto-save
 * T07: Draft Auto-Save feature
 *
 * @param {string} chatId - Current chat ID
 * @returns {Object} Draft state and controls
 */
export function useDraft(chatId) {
    const [draft, setDraft] = useState(() => loadDraftFromStorage(chatId));
    const [isRestored, setIsRestored] = useState(false);
    const saveTimeoutRef = useRef(null);
    const prevChatIdRef = useRef(chatId);

    // Load draft when chat changes
    useEffect(() => {
        if (!chatId) return;

        // Only reload if chatId actually changed
        if (chatId !== prevChatIdRef.current) {
            prevChatIdRef.current = chatId;
            const loadedDraft = loadDraftFromStorage(chatId);
            // Defer setState to avoid cascading renders
            requestAnimationFrame(() => {
                setDraft(loadedDraft);
                setIsRestored(!!loadedDraft.content);
            });
        }

        return () => {
            // Clear any pending save on unmount
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [chatId]);

    // Auto-save draft (debounced)
    const saveDraft = useCallback((content, quotedMessageId = null) => {
        if (!chatId) return;

        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Set new timeout for debounced save
        saveTimeoutRef.current = setTimeout(() => {
            const drafts = storage.get(DRAFTS_KEY, {});

            // Only save if there's content
            if (content.trim() || quotedMessageId) {
                drafts[chatId] = {
                    content: content.trim(),
                    quotedMessageId,
                    savedAt: new Date().toISOString()
                };
            } else {
                // Remove empty draft
                delete drafts[chatId];
            }

            storage.set(DRAFTS_KEY, drafts);
        }, 500); // 500ms debounce
    }, [chatId]);

    // Clear draft (call when message is sent)
    const clearDraft = useCallback(() => {
        if (!chatId) return;

        // Clear pending save
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        const drafts = storage.get(DRAFTS_KEY, {});
        delete drafts[chatId];
        storage.set(DRAFTS_KEY, drafts);

        setDraft({ content: '', quotedMessageId: null });
        setIsRestored(false);
    }, [chatId]);

    // Update draft content immediately (for controlled input)
    const updateDraftContent = useCallback((content, quotedMessageId) => {
        setDraft({ content, quotedMessageId });
        saveDraft(content, quotedMessageId);
    }, [saveDraft]);

    return {
        draftContent: draft.content,
        draftQuotedMessageId: draft.quotedMessageId,
        isRestored,
        updateDraftContent,
        clearDraft,
        saveDraft
    };
}
