const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const filePath = path.join(dataDir, 'guildConfigs.json');

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
}

function readAll() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    console.error('Error reading guildConfigs.json:', e);
    return {};
  }
}

function writeAll(obj) {
  ensureDataFile();
  try {
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
    return true;
  } catch (e) {
    console.error('Error writing guildConfigs.json:', e);
    return false;
  }
}

function getDefaultConfig() {
  return {
    prefix: '!',
    ticketsEnabled: true,
    ticketCategory: 'TICKETS',
    staffRoleName: 'Staff',
    welcome: {
      enabled: true,
      channelId: null,
      message: '¡Bienvenido/a, {member}! 🎉\n\nPasa por los canales y lee las reglas. Si necesitas ayuda, abre un ticket con {prefix}ticket.',
      roleId: null
    }
  };
}

function getGuildConfig(guildId) {
  const all = readAll();
  const cfg = all[guildId];
  if (!cfg) return getDefaultConfig();
  // merge defaults
  const def = getDefaultConfig();
  return deepMerge(def, cfg);
}

function setGuildConfig(guildId, newCfg) {
  const all = readAll();
  all[guildId] = newCfg;
  return writeAll(all);
}

function updateGuildConfig(guildId, patch) {
  const all = readAll();
  const current = all[guildId] || getDefaultConfig();
  const merged = deepMerge(current, patch);
  all[guildId] = merged;
  return writeAll(all);
}

function resetGuildConfig(guildId) {
  const all = readAll();
  delete all[guildId];
  return writeAll(all);
}

function deepMerge(a, b) {
  if (Array.isArray(b)) return b;
  if (typeof a !== 'object' || a === null) return b;
  const out = Object.assign({}, a);
  for (const k of Object.keys(b)) {
    if (typeof b[k] === 'object' && b[k] !== null && !Array.isArray(b[k])) {
      out[k] = deepMerge(a[k] || {}, b[k]);
    } else {
      out[k] = b[k];
    }
  }
  return out;
}

module.exports = {
  getGuildConfig,
  setGuildConfig,
  updateGuildConfig,
  resetGuildConfig,
  getDefaultConfig,
};
