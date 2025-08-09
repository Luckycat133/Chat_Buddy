const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = path.join(__dirname, '..', 'prompts');

function loadDir(dir) {
  const result = {};
  if (!fs.existsSync(dir)) return result;
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isFile()) {
      const key = path.basename(file, path.extname(file));
      result[key] = fs.readFileSync(filePath, 'utf8');
    }
  }
  return result;
}

function loadPrompts() {
  const system = loadDir(path.join(PROMPTS_DIR, 'system'));
  const roles = loadDir(path.join(PROMPTS_DIR, 'roles'));
  return { system, roles };
}

function getSystemPrompt(role = 'assistant') {
  const { system, roles } = loadPrompts();
  const systemPrompt = Object.values(system).join('\n');
  const rolePrompt = roles[role] || '';
  return [systemPrompt, rolePrompt].filter(Boolean).join('\n');
}

function listRoles() {
  const { roles } = loadPrompts();
  return Object.keys(roles);
}

module.exports = {
  getSystemPrompt,
  listRoles,
};
