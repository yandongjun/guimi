const fs = require("fs");
const os = require("os");
const path = require("path");

const runtimeRoot = path.join(process.env.GUIMI_RUNTIME_DIR || process.env.LOCALAPPDATA || os.tmpdir(), "guimi-runtime");
const storePath = path.join(runtimeRoot, "storage", "user-state.json");

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureStore() {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function normalizeUsers(seedUsers = [], savedUsers = []) {
  const savedMap = new Map((savedUsers || []).filter(Boolean).map((item) => [item.id, item]));
  return seedUsers.map((seedUser) => {
    const savedUser = savedMap.get(seedUser.id);
    return savedUser ? { ...cloneJson(seedUser), ...cloneJson(savedUser) } : cloneJson(seedUser);
  });
}

function normalizeState(seedState = {}, savedState = {}) {
  const users = normalizeUsers(seedState.users || [], savedState.users || []);
  const validUserIds = new Set(users.map((item) => item.id));
  const activeUserId = validUserIds.has(savedState.activeUserId)
    ? savedState.activeUserId
    : (seedState.activeUserId || (users[0] && users[0].id) || "");

  // 按天重置逻辑
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const savedDate = savedState.lastResetDate;
  const isNewDay = savedDate !== today;

  return {
    activeUserId,
    generationUsed: isNewDay ? 0 : (Number.isFinite(savedState.generationUsed) ? savedState.generationUsed : (seedState.generationUsed || 0)),
    adUnlocks: isNewDay ? 0 : (Number.isFinite(savedState.adUnlocks) ? savedState.adUnlocks : (seedState.adUnlocks || 0)),
    lastResetDate: today,
    users,
    closetItems: cloneJson(Array.isArray(savedState.closetItems) ? savedState.closetItems : (seedState.closetItems || []))
  };
}

function readSavedState() {
  ensureStore();
  if (!fs.existsSync(storePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(storePath, "utf8"));
  } catch (error) {
    return null;
  }
}

function writeState(state) {
  ensureStore();
  fs.writeFileSync(storePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function loadState(seedState = {}) {
  const normalized = normalizeState(seedState, readSavedState() || {});
  writeState(normalized);
  return normalized;
}

function saveState(state = {}) {
  const normalized = normalizeState(state, state);
  writeState(normalized);
  return normalized;
}

module.exports = {
  loadState,
  saveState
};
