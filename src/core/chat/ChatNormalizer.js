/**
 * ChatNormalizer — 聊天数据规范化与去重
 * 从 ChatEngine.js 提取，负责消息/聊天数据的标准化。
 */

export function normalizeMessage(message) {
  if (!message || typeof message !== 'object') return null;
  if (!message.id || !message.senderId || typeof message.content !== 'string') return null;

  return {
    ...message,
    timestamp: message.timestamp || new Date().toISOString(),
    status: message.status || 'sent',
    readBy: Array.isArray(message.readBy) ? message.readBy : [],
  };
}

export function normalizeChat(chat) {
  if (!chat || typeof chat !== 'object' || !chat.id) return null;

  const messages = Array.isArray(chat.messages)
    ? chat.messages.map(msg => normalizeMessage(msg)).filter(Boolean)
    : [];

  const lastMessage = chat.lastMessage && typeof chat.lastMessage === 'object'
    ? normalizeMessage(chat.lastMessage)
    : messages[messages.length - 1] || null;

  const createdAt = chat.createdAt || chat.updatedAt || new Date().toISOString();
  const updatedAt = chat.updatedAt || lastMessage?.timestamp || createdAt;
  const participants = Array.isArray(chat.participants)
    ? chat.participants
    : ['user-me'];

  return {
    ...chat,
    name: chat.name || 'New Chat',
    participants,
    messages,
    lastMessage,
    createdAt,
    updatedAt,
    polls: Array.isArray(chat.polls) ? chat.polls : [],
    pinnedMessages: Array.isArray(chat.pinnedMessages) ? chat.pinnedMessages : [],
    settings: chat.settings || { muteValues: {} },
  };
}

export function getDirectPeerId(chat, currentUserId = 'user-me') {
  if (!chat || !Array.isArray(chat.participants)) return null;
  const uniqueParticipants = [...new Set(chat.participants.filter(Boolean))];
  if (uniqueParticipants.length !== 2) return null;
  if (!uniqueParticipants.includes(currentUserId)) return null;
  return uniqueParticipants.find(id => id !== currentUserId) || null;
}

export function getChatActivityTimestamp(chat) {
  return chat?.lastMessage?.timestamp || chat?.updatedAt || chat?.createdAt || new Date(0).toISOString();
}

export function isTaskParticipant(participantId, personas = [], currentUserId = 'user-me') {
  if (!participantId || participantId === currentUserId) return false;
  const persona = personas.find(p => p.id === participantId);
  if (persona?.agentType === 'task-specialist') return true;
  return String(participantId).startsWith('agent-');
}
