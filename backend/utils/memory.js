const userMemories = {};

function getUserMemories(userId, role = 'assistant') {
  if (!userMemories[userId]) userMemories[userId] = {};
  if (!userMemories[userId][role]) userMemories[userId][role] = [];
  return userMemories[userId][role];
}

function addUserMemory(userId, role, text) {
  const memories = getUserMemories(userId, role);
  const memory = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    text,
    time: new Date().toISOString(),
  };
  memories.push(memory);
  return memory;
}

function updateUserMemory(userId, role, memoryId, text) {
  const memories = getUserMemories(userId, role);
  const memory = memories.find(m => m.id === memoryId);
  if (memory) {
    memory.text = text;
  }
  return memory;
}

function deleteUserMemory(userId, role, memoryId) {
  const memories = getUserMemories(userId, role);
  const index = memories.findIndex(m => m.id === memoryId);
  if (index !== -1) {
    memories.splice(index, 1);
    return true;
  }
  return false;
}

module.exports = {
  getUserMemories,
  addUserMemory,
  updateUserMemory,
  deleteUserMemory,
};
