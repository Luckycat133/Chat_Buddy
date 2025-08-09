const fs = require('fs');
const path = require('path');

const systemDir = path.join(__dirname, '../prompts/system');
const rolesDir = path.join(__dirname, '../prompts/roles');

function readFiles(dir) {
  let contents = {};
  if (!fs.existsSync(dir)) return contents;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isFile()) {
      const key = path.basename(file, path.extname(file));
      contents[key] = fs.readFileSync(full, 'utf8');
    }
  });
  return contents;
}

function loadSystemPrompt() {
  const files = readFiles(systemDir);
  return Object.values(files).join('\n');
}

function loadRolePrompts() {
  return readFiles(rolesDir);
}

function getRoleList() {
  return Object.keys(loadRolePrompts());
}

function getPromptForRole(role) {
  const system = loadSystemPrompt();
  const roles = loadRolePrompts();
  const rolePrompt = roles[role] || '';
  return `${system}\n${rolePrompt}`.trim();
}

module.exports = {
  getRoleList,
  getPromptForRole,
};
