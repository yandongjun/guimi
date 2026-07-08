const fs = require("fs");
const os = require("os");
const path = require("path");

const runtimeRoot = path.join(process.env.GUIMI_RUNTIME_DIR || process.env.LOCALAPPDATA || os.tmpdir(), "guimi-runtime");
const storePath = path.join(runtimeRoot, "storage", "recommendations.json");

function ensureStore() {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, "[]\n", "utf8");
  }
}

function readRecommendations() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(storePath, "utf8"));
  } catch (error) {
    return [];
  }
}

function writeRecommendations(items) {
  ensureStore();
  fs.writeFileSync(storePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

function createRecommendation(payload = {}) {
  const items = readRecommendations();
  const now = new Date().toISOString();
  const id = payload.id || `rec-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const recommendation = {
    id,
    status: payload.status || "created",
    userId: payload.userId || "",
    scene: payload.scene || "",
    stylePreference: payload.stylePreference || "",
    sourceMode: payload.sourceMode || "wardrobe_first",
    inputSnapshot: payload.inputSnapshot || {},
    selectedItems: payload.selectedItems || [],
    selectedItemIds: payload.selectedItemIds || [],
    missingSlots: payload.missingSlots || [],
    appliedRuleIds: payload.appliedRuleIds || [],
    stylingNotes: payload.stylingNotes || [],
    imagePrompt: payload.imagePrompt || "",
    imageJobId: payload.imageJobId || "",
    generatedImageUrl: payload.generatedImageUrl || "",
    feedback: payload.feedback || null,
    aiMeta: payload.aiMeta || null,
    createdAt: now,
    updatedAt: now
  };
  items.unshift(recommendation);
  writeRecommendations(items);
  return recommendation;
}

function updateRecommendation(id, patch = {}) {
  const items = readRecommendations();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  items[index] = {
    ...items[index],
    ...patch,
    updatedAt: new Date().toISOString()
  };
  writeRecommendations(items);
  return items[index];
}

function bindImageJob(id, payload = {}) {
  return updateRecommendation(id, {
    imageJobId: payload.imageJobId || "",
    generatedImageUrl: payload.generatedImageUrl || "",
    status: payload.generatedImageUrl ? "image_ready" : "image_job_created"
  });
}

function saveFeedback(id, feedback = {}) {
  return updateRecommendation(id, {
    feedback: {
      ...feedback,
      createdAt: feedback.createdAt || new Date().toISOString()
    }
  });
}

function listRecommendations(filter = {}) {
  return readRecommendations()
    .filter((item) => !filter.userId || item.userId === filter.userId)
    .filter((item) => !filter.scene || item.scene === filter.scene);
}

module.exports = {
  bindImageJob,
  createRecommendation,
  listRecommendations,
  saveFeedback,
  updateRecommendation
};
