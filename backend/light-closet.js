const tags = require("./light-closet-tags");

const sceneMap = {
  "上班": "office",
  "约会": "dating",
  "聚会": "party",
  "出游": "travel",
  "逛街": "shopping",
  "日常": "daily"
};

function sceneKey(scene) {
  return sceneMap[scene] || scene || "daily";
}

function ensureArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function stableItemId(item = {}) {
  return item.itemId || item.id || `closet-${item.name || "item"}`;
}

function normalizeClosetItem(item = {}) {
  const category = item.category || "top";
  const sceneTags = ensureArray(item.sceneTags);
  const styleTags = ensureArray(item.styleTags || item.tags);
  const bodyStrategyTags = ensureArray(item.bodyStrategyTags);
  const riskTags = ensureArray(item.riskTags);
  const color = item.colorKey || item.color || "";
  const itemId = stableItemId(item);

  return {
    ...item,
    itemId,
    id: item.id || itemId,
    category,
    categoryLabel: item.categoryLabel || tags.labelFor("category", category),
    subCategory: item.subCategory || item.sub_category || "",
    subCategoryLabel: item.subCategoryLabel || item.name || "",
    color,
    colorLabel: item.colorLabel || tags.labelFor("color", color) || item.color || "",
    sceneTags,
    sceneLabels: item.sceneLabels || tags.labelsFor("scene", sceneTags),
    styleTags,
    styleLabels: item.styleLabels || tags.labelsFor("style", styleTags),
    bodyStrategyTags,
    bodyStrategyLabels: item.bodyStrategyLabels || tags.labelsFor("bodyStrategy", bodyStrategyTags),
    riskTags,
    riskLabels: item.riskLabels || tags.labelsFor("risk", riskTags),
    usageCount: Number(item.usageCount || 0)
  };
}

function normalizeCloset(items = []) {
  return ensureArray(items).map(normalizeClosetItem);
}

function scoreItem(item, context = {}) {
  const targetScene = sceneKey(context.scene);
  const bodyStrategies = ensureArray(context.bodyStrategies);
  const favoriteColors = ensureArray(context.favoriteColors);
  const rejectedStyleTags = ensureArray(context.rejectedStyleTags);

  let score = 0;
  if (item.sceneTags.includes(targetScene)) score += 4;
  if (favoriteColors.includes(item.color) || favoriteColors.includes(item.colorLabel)) score += 2;
  score += item.bodyStrategyTags.filter((tag) => bodyStrategies.includes(tag)).length * 3;
  score -= item.styleTags.filter((tag) => rejectedStyleTags.includes(tag)).length * 4;
  score -= item.riskTags.length * 2;
  score += Math.max(0, 2 - item.usageCount) * 0.5;
  return score;
}

function inferTrendFillSlots(items = []) {
  const categories = new Set(items.map((item) => item.category));
  const missing = [];
  if (!categories.has("top")) missing.push("内搭");
  if (!categories.has("bottom") && !categories.has("dress")) missing.push("下装");
  if (!categories.has("shoes")) missing.push("鞋");
  return missing.slice(0, 2);
}

function pickClosetItems(items = [], context = {}) {
  const ranked = normalizeCloset(items)
    .map((item) => ({ item, score: scoreItem(item, context) }))
    .sort((left, right) => right.score - left.score);
  const required = ranked.filter((entry) => entry.score > 0).slice(0, 2).map((entry) => entry.item);
  const fallback = ranked.slice(0, 1).map((entry) => entry.item);
  const picked = required.length ? required : fallback;

  return {
    usedClosetItems: picked,
    usedClosetItemIds: picked.map((item) => item.itemId),
    usedClosetItemLabels: picked.map((item) => item.name || item.subCategoryLabel || item.categoryLabel),
    trendFillSlots: inferTrendFillSlots(picked),
    sourceMix: picked.length ? ["wardrobe", "trend_library"] : ["trend_library"]
  };
}

function updatePreferenceFromRating(user = {}, rating = {}) {
  const scores = rating.scores || {};
  const rejectedStyleTags = new Set(user.rejectedStyleTags || []);
  if (Number(scores.fashion || 0) <= 2 || Number(scores.wearable || 0) <= 2) {
    ensureArray(rating.styleTags).forEach((tag) => rejectedStyleTags.add(tag));
  }
  return {
    ...user,
    rejectedStyleTags: Array.from(rejectedStyleTags)
  };
}

module.exports = {
  sceneKey,
  normalizeClosetItem,
  normalizeCloset,
  pickClosetItems,
  updatePreferenceFromRating
};
