/**
 * Bookmark Service - Manages message bookmarks
 * T07: Message Feature Enhancement
 */
import { storage } from '../../../services/storage/StorageService';

const BOOKMARKS_KEY = 'message-bookmarks';

/**
 * Get all bookmarked messages
 * @returns {Array} Array of bookmarked messages
 */
export function getBookmarks() {
    return storage.get(BOOKMARKS_KEY, []);
}

/**
 * Add a message to bookmarks
 * @param {Object} bookmarkData - Bookmark data
 * @param {string} bookmarkData.messageId - Message ID
 * @param {string} bookmarkData.chatId - Chat ID
 * @param {string} bookmarkData.content - Message content
 * @param {string} bookmarkData.senderId - Sender ID
 * @param {string} bookmarkData.senderName - Sender name
 * @param {string} bookmarkData.chatName - Chat name
 * @returns {boolean} Success status
 */
export function addBookmark(bookmarkData) {
    const bookmarks = getBookmarks();

    // Check if already bookmarked
    if (bookmarks.some(b => b.messageId === bookmarkData.messageId)) {
        return false;
    }

    const newBookmark = {
        ...bookmarkData,
        bookmarkedAt: new Date().toISOString()
    };

    storage.set(BOOKMARKS_KEY, [newBookmark, ...bookmarks]);
    return true;
}

/**
 * Remove a message from bookmarks
 * @param {string} messageId - Message ID to remove
 * @returns {boolean} Success status
 */
export function removeBookmark(messageId) {
    const bookmarks = getBookmarks();
    const filtered = bookmarks.filter(b => b.messageId !== messageId);

    if (filtered.length === bookmarks.length) {
        return false; // Not found
    }

    storage.set(BOOKMARKS_KEY, filtered);
    return true;
}

/**
 * Check if a message is bookmarked
 * @param {string} messageId - Message ID to check
 * @returns {boolean} Is bookmarked
 */
export function isBookmarked(messageId) {
    const bookmarks = getBookmarks();
    return bookmarks.some(b => b.messageId === messageId);
}

/**
 * Toggle bookmark status for a message
 * @param {Object} bookmarkData - Bookmark data
 * @returns {boolean} New bookmark status (true = bookmarked, false = removed)
 */
export function toggleBookmark(bookmarkData) {
    if (isBookmarked(bookmarkData.messageId)) {
        removeBookmark(bookmarkData.messageId);
        return false;
    } else {
        addBookmark(bookmarkData);
        return true;
    }
}

/**
 * Clear all bookmarks
 */
export function clearAllBookmarks() {
    storage.set(BOOKMARKS_KEY, []);
}
