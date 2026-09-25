export function chatSearchText(chat, meta, personas = [], friendMeta = {}) {
  const participantIds = (chat.participants || []).filter((id) => id !== 'user-me');
  const personaNames = participantIds.flatMap((id) => {
    const persona = personas.find((candidate) => candidate.id === id);
    return persona ? [persona.name, persona.name_zh, persona.nickname] : [];
  });
  const friendNames = participantIds.map((id) => friendMeta[id]?.remark || '');
  return [chat.name, meta?.name, ...personaNames, ...friendNames]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
}

export function matchesChatListSearch(chat, meta, query, personas = [], friendMeta = {}) {
  const normalized = query.trim().toLocaleLowerCase();
  return normalized.length === 0 || chatSearchText(chat, meta, personas, friendMeta).includes(normalized);
}

export function filterChatListEntries(entries, query, activeTab = 'all', isSocial = () => true) {
  const normalized = query.trim().toLocaleLowerCase();
  return entries
    .filter(({ chat, meta, searchText }) => {
      const tabMatch = activeTab === 'all' || meta.type === activeTab;
      const searchMatch = !normalized || String(searchText || '').toLocaleLowerCase().includes(normalized);
      return isSocial({ chat, meta }) && tabMatch && searchMatch;
    })
    .sort((a, b) => {
      if (a.chat.isPinned && !b.chat.isPinned) return -1;
      if (!a.chat.isPinned && b.chat.isPinned) return 1;
      const aTime = a.chat.lastMessage?.timestamp || a.chat.createdAt;
      const bTime = b.chat.lastMessage?.timestamp || b.chat.createdAt;
      return new Date(bTime) - new Date(aTime);
    });
}
