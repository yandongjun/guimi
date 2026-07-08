const providerChain = require("./provider-chain");
const lightCloset = require("./light-closet");
const stylingNotes = require("./styling-notes");

const RECOMMENDATION_STYLIST_PROMPT = "你是一位专业时尚穿搭顾问，了解最新时尚趋势。请基于用户画像、身材策略、天气、场景、用户衣橱和平台衣服库，生成一套现实可穿的结构化穿搭方案。优先使用用户衣橱；只有用户衣橱无法满足场景、天气或审美目标时，才从平台衣服库或者互联网信息补位。";

function ensureArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function compactTextList(items = []) {
  return ensureArray(items)
    .map((item) => {
      if (!item) return "";
      if (typeof item === "string") return item.trim();
      if (typeof item === "object") {
        if (item.name && item.copy) return `${item.name}：${item.copy}`;
        if (item.text) return String(item.text).trim();
        if (item.copy) return String(item.copy).trim();
        if (item.reason) return String(item.reason).trim();
      }
      return String(item || "").trim();
    })
    .filter((item) => item && item !== "[object Object]");
}

function buildOutfitBrief(input = {}) {
  const user = input.user || {};
  const profile = input.profile || {};
  const scene = input.scene || "";
  const outfit = input.outfit || {};
  const sourceMode = input.sourceMode || "wardrobe_first";
  const stylePreference = input.stylePreference || "";
  const closetPick = lightCloset.pickClosetItems(input.closetItems || [], {
    scene,
    sourceMode,
    stylePreference,
    bodyStrategies: profile.strategyTags || profile.stylingStrategies || [],
    favoriteColors: user.favoriteColors || [],
    rejectedStyleTags: user.rejectedStyleTags || []
  });

  return {
    scene,
    sourceMode,
    stylePreference,
    mood: outfit.displayMood || outfit.mood || "",
    title: outfit.displayTitle || outfit.title || "",
    usedClosetItems: closetPick.usedClosetItems,
    usedClosetItemIds: closetPick.usedClosetItemIds,
    usedClosetItemLabels: closetPick.usedClosetItemLabels,
    trendFillSlots: closetPick.trendFillSlots,
    sourceMix: closetPick.sourceMix,
    closetUsageCopy: closetPick.usedClosetItemLabels.length
      ? `今天用了你衣橱里的${closetPick.usedClosetItemLabels.join("、")}。`
      : "今天先用趋势库搭一版，上传常穿衣服后会更像你的日常。"
  };
}

function buildRecommendationSnapshot(input = {}, brief) {
  const outfit = input.outfit || {};
  const summaryReasons = compactTextList(outfit.summaryReasons || outfit.reasons || []).slice(0, 3);
  const reasons = compactTextList(outfit.reasons || summaryReasons).slice(0, 3);
  const visualNotes = compactTextList(outfit.visualNotes || summaryReasons || reasons).slice(0, 3);
  const displayTitle = outfit.displayTitle || outfit.title || brief.title || "";
  const displayMood = outfit.displayMood || outfit.mood || brief.mood || "";
  const snapshot = {
    recommendationId: input.recommendationId || "",
    scene: input.scene || "",
    sourceMode: input.sourceMode || brief.sourceMode || "wardrobe_first",
    stylePreference: input.stylePreference || brief.stylePreference || "",
    stylistPrompt: RECOMMENDATION_STYLIST_PROMPT,
    displayTitle,
    title: displayTitle,
    displayMood,
    mood: displayMood,
    summaryReasons,
    reasons,
    visualNotes,
    outfitBrief: brief,
    usedClosetItems: brief.usedClosetItems,
    usedClosetItemIds: brief.usedClosetItemIds,
    usedClosetItemLabels: brief.usedClosetItemLabels,
    trendFillSlots: brief.trendFillSlots,
    sourceMix: brief.sourceMix,
    closetUsageCopy: brief.closetUsageCopy,
    closetSourceText: brief.usedClosetItemLabels.join(" / ")
  };
  return {
    ...snapshot,
    stylingNotes: stylingNotes.buildStylingNotes(snapshot, outfit)
  };
}

function selectedItemsFromBrief(brief = {}) {
  return (brief.usedClosetItems || []).map((item) => ({
    itemId: item.itemId || item.id || "",
    name: item.name || item.subCategoryLabel || item.categoryLabel || "",
    source: item.sourceType || "wardrobe",
    slot: item.categoryLabel || item.category || "",
    why: (item.bodyStrategyLabels || item.styleLabels || []).slice(0, 2).join("、")
  }));
}

async function localRecommendationProvider({ input }) {
  const brief = buildOutfitBrief(input);
  const recommendationSnapshot = buildRecommendationSnapshot(input, brief);
  return {
    recommendationSnapshot,
    outfitBrief: brief,
    selectedItems: selectedItemsFromBrief(brief),
    selectedItemIds: brief.usedClosetItemIds || [],
    missingSlots: brief.trendFillSlots || [],
    stylingNotes: recommendationSnapshot.stylingNotes || [],
    confidence: 0.72,
    reasoningSummary: brief.closetUsageCopy || ""
  };
}

function defaultProviders() {
  return [
    {
      name: "local_recommendation",
      run: localRecommendationProvider
    }
  ];
}

async function recommendOutfit(input = {}, options = {}) {
  const chainResult = await providerChain.runProviderChain({
    operation: "recommend_outfit",
    input,
    providers: options.providers || defaultProviders()
  });
  const result = chainResult.result || {};
  return {
    ...result,
    provider: chainResult.provider,
    providerAttempts: chainResult.attempts
  };
}

module.exports = {
  RECOMMENDATION_STYLIST_PROMPT,
  buildOutfitBrief,
  buildRecommendationSnapshot,
  defaultProviders,
  recommendOutfit
};
