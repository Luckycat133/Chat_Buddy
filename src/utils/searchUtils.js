/**
 * Search utilities for AI content access
 * Provides functions to search through accessible content for AI context
 */

import { INITIAL_PERSONAS } from '../data/personas';

/**
 * Get group chats that an AI is a member of
 * @param {string} aiId - The AI persona ID
 * @param {Array} chats - All chats from ChatContext
 * @returns {Array} Chats the AI participates in
 */
export function getGroupChatsForAI(aiId, chats) {
    if (!chats || !aiId) return [];

    return chats.filter(chat =>
        chat.participants &&
        chat.participants.includes(aiId) &&
        chat.participants.length > 2 // Group chats only
    ).map(chat => ({
        id: chat.id,
        name: chat.name,
        participants: chat.participants,
        messageCount: chat.messages?.length || 0,
        recentMessages: (chat.messages || []).slice(-5).map(m => ({
            sender: m.senderId === 'user-me' ? 'User' : getPersonaName(m.senderId),
            content: m.content.substring(0, 100),
            timestamp: m.timestamp
        }))
    }));
}

/**
 * Get AI's own moments history
 * @param {string} aiId - The AI persona ID
 * @param {Array} posts - All posts from MomentsContext
 * @returns {Object} AI's moments activity
 */
export function getAIMomentHistory(aiId, posts) {
    if (!posts || !aiId) return { ownPosts: [], interactions: [] };

    const ownPosts = posts
        .filter(p => p.authorId === aiId)
        .slice(0, 5)
        .map(p => ({
            content: p.content.substring(0, 100),
            likes: p.likes.length,
            comments: p.comments.length,
            createdAt: p.createdAt
        }));

    const interactions = posts
        .filter(p =>
            p.authorId !== aiId && (
                p.likes.includes(aiId) ||
                p.comments.some(c => c.authorId === aiId)
            )
        )
        .slice(0, 5)
        .map(p => ({
            author: getPersonaName(p.authorId),
            content: p.content.substring(0, 50),
            interacted: p.likes.includes(aiId) ? 'liked' : 'commented'
        }));

    return { ownPosts, interactions };
}

/**
 * Search content for relevant context
 * @param {string} query - Search query
 * @param {Array} chats - All chats
 * @param {Array} posts - All posts
 * @returns {Object} Search results
 */
export function searchContent(query, chats, posts) {
    if (!query) return { chatResults: [], postResults: [] };

    const lowerQuery = query.toLowerCase();

    const chatResults = [];
    (chats || []).forEach(chat => {
        const matchingMessages = (chat.messages || []).filter(m =>
            m.content.toLowerCase().includes(lowerQuery)
        ).slice(0, 3);

        if (matchingMessages.length > 0) {
            chatResults.push({
                chatId: chat.id,
                chatName: chat.name,
                matches: matchingMessages.map(m => ({
                    sender: m.senderId === 'user-me' ? 'User' : getPersonaName(m.senderId),
                    content: m.content.substring(0, 100),
                    timestamp: m.timestamp
                }))
            });
        }
    });

    const postResults = (posts || [])
        .filter(p => p.content.toLowerCase().includes(lowerQuery))
        .slice(0, 5)
        .map(p => ({
            postId: p.id,
            author: p.authorId === 'user-me' ? 'User' : getPersonaName(p.authorId),
            content: p.content.substring(0, 100),
            createdAt: p.createdAt
        }));

    return { chatResults, postResults };
}

/**
 * Format context summary for AI prompt
 * @param {string} aiId - The AI persona ID
 * @param {Array} chats - All chats
 * @param {Array} posts - All posts
 * @returns {string} Formatted context summary
 */
export function formatContextForAI(aiId, chats, posts) {
    const groupChats = getGroupChatsForAI(aiId, chats);
    const momentHistory = getAIMomentHistory(aiId, posts);

    const lines = [];

    // Group chat summary
    if (groupChats.length > 0) {
        lines.push(`[Group Chats You're In: ${groupChats.length}]`);
        groupChats.slice(0, 2).forEach(gc => {
            lines.push(`- "${gc.name}": ${gc.messageCount} messages`);
            if (gc.recentMessages.length > 0) {
                const last = gc.recentMessages[gc.recentMessages.length - 1];
                lines.push(`  Last: ${last.sender}: "${last.content.substring(0, 50)}..."`);
            }
        });
    }

    // Moments activity
    if (momentHistory.ownPosts.length > 0) {
        lines.push(`[Your Recent Posts: ${momentHistory.ownPosts.length}]`);
        momentHistory.ownPosts.slice(0, 2).forEach(p => {
            lines.push(`- "${p.content.substring(0, 40)}..." (${p.likes} likes, ${p.comments} comments)`);
        });
    }

    if (momentHistory.interactions.length > 0) {
        lines.push(`[Your Interactions: ${momentHistory.interactions.length}]`);
        momentHistory.interactions.slice(0, 2).forEach(i => {
            lines.push(`- ${i.interacted} ${i.author}'s post: "${i.content}..."`);
        });
    }

    return lines.length > 0 ? lines.join('\n') : '[No recent activity]';
}

/**
 * Get persona display name by ID
 */
function getPersonaName(personaId) {
    if (personaId === 'user-me') return 'User';
    const persona = INITIAL_PERSONAS.find(p => p.id === personaId);
    return persona?.name || 'Unknown';
}

/**
 * Get user posts for AI context
 * @param {Array} posts - All posts
 * @returns {Array} Recent user posts
 */
export function getUserRecentPosts(posts) {
    return (posts || [])
        .filter(p => p.authorId === 'user-me')
        .slice(0, 5)
        .map(p => ({
            content: p.content,
            location: p.location,
            likes: p.likes.length,
            comments: p.comments.length,
            createdAt: p.createdAt
        }));
}
