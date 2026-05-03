/**
 * ChatDeduplicator — 聊天去重与合并
 * 处理同一个人多条直聊记录的合并逻辑。
 */

import { normalizeMessage, getDirectPeerId, getChatActivityTimestamp, isTaskParticipant } from './ChatNormalizer';

function _mergeDirectChatCluster(cluster, currentUserId = 'user-me') {
  const sorted = [...cluster].sort(
    (a, b) => new Date(getChatActivityTimestamp(b)) - new Date(getChatActivityTimestamp(a))
  );
  const canonical = sorted[0];

  const messageMap = new Map();
  sorted.forEach((chat) => {
    (chat.messages || []).forEach((message) => {
      const normalized = normalizeMessage(message);
      if (!normalized) return;
      if (!messageMap.has(normalized.id)) {
        messageMap.set(normalized.id, normalized);
      }
    });
  });

  const messages = Array.from(messageMap.values()).sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  const mergedPollsMap = new Map();
  sorted.forEach((chat) => {
    (chat.polls || []).forEach((poll) => {
      if (poll?.id && !mergedPollsMap.has(poll.id)) {
        mergedPollsMap.set(poll.id, poll);
      }
    });
  });

  const mergedPinnedMessages = Array.from(
    new Set(sorted.flatMap(chat => Array.isArray(chat.pinnedMessages) ? chat.pinnedMessages : []))
  );

  const mergedMuteValues = {};
  sorted.forEach((chat) => {
    Object.assign(mergedMuteValues, chat?.settings?.muteValues || {});
  });

  const createdAt = sorted.reduce((earliest, chat) => {
    const value = chat?.createdAt || chat?.updatedAt;
    if (!value) return earliest;
    if (!earliest) return value;
    return new Date(value) < new Date(earliest) ? value : earliest;
  }, null) || canonical.createdAt || new Date().toISOString();

  const lastMessage = messages[messages.length - 1] || canonical.lastMessage || null;
  const updatedAt = lastMessage?.timestamp || canonical.updatedAt || createdAt;
  const name = canonical.name || sorted.find(chat => chat.name)?.name || 'New Chat';
  const avatar = canonical.avatar || sorted.find(chat => chat.avatar)?.avatar || null;
  const admins = Array.from(
    new Set(sorted.flatMap(chat => Array.isArray(chat.admins) ? chat.admins : []))
  ).filter(Boolean);
  if (!admins.includes(currentUserId)) {
    admins.unshift(currentUserId);
  }

  return {
    ...canonical,
    name,
    avatar,
    participants: [currentUserId, getDirectPeerId(canonical, currentUserId)].filter(Boolean),
    admins,
    messages,
    lastMessage,
    createdAt,
    updatedAt,
    isPinned: sorted.some(chat => chat.isPinned),
    isUnread: sorted.some(chat => chat.isUnread),
    pinnedMessages: mergedPinnedMessages,
    polls: Array.from(mergedPollsMap.values()),
    settings: {
      ...(canonical.settings || {}),
      muteValues: mergedMuteValues,
    },
  };
}

export function dedupeDirectSocialChats(chats = [], personas = [], currentUserId = 'user-me') {
  if (!Array.isArray(chats) || chats.length === 0) {
    return { chats: [], changed: false };
  }

  const socialDirectGroups = new Map();
  const passthrough = [];
  let changed = false;

  chats.forEach((chat) => {
    const peerId = getDirectPeerId(chat, currentUserId);
    if (!peerId || isTaskParticipant(peerId, personas, currentUserId)) {
      passthrough.push(chat);
      return;
    }

    if (!socialDirectGroups.has(peerId)) {
      socialDirectGroups.set(peerId, []);
    }
    socialDirectGroups.get(peerId).push(chat);
  });

  const mergedSocialDirectChats = [];
  socialDirectGroups.forEach((cluster) => {
    if (cluster.length <= 1) {
      mergedSocialDirectChats.push(cluster[0]);
      return;
    }
    changed = true;
    mergedSocialDirectChats.push(_mergeDirectChatCluster(cluster, currentUserId));
  });

  const nextChats = [...passthrough, ...mergedSocialDirectChats].sort(
    (a, b) => new Date(getChatActivityTimestamp(b)) - new Date(getChatActivityTimestamp(a))
  );

  return { chats: nextChats, changed };
}
