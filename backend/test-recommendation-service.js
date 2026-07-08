const assert = require("assert");

const recommendationService = require("./recommendation-service");

const closetItems = [
  {
    id: "top-1",
    name: "奶油白短外套",
    category: "outerwear",
    categoryLabel: "外套",
    color: "cream",
    colorLabel: "奶油白",
    sceneTags: ["上班", "office"],
    styleTags: ["commute"],
    bodyStrategyTags: ["raise_waist"]
  },
  {
    id: "bottom-1",
    name: "深靛蓝牛仔裤",
    category: "bottom",
    categoryLabel: "下装",
    color: "indigo",
    colorLabel: "深靛蓝",
    sceneTags: ["上班", "office"],
    styleTags: ["casual"],
    bodyStrategyTags: ["lengthen_legs"]
  }
];

const baseInput = {
  user: { id: "u1", favoriteColors: ["奶油白"] },
  profile: { strategyTags: ["raise_waist", "lengthen_legs"] },
  scene: "上班",
  outfit: {
    displayTitle: "短外套 + 牛仔裤",
    displayMood: "轻松但不幼态",
    summaryReasons: ["短外套提高重心", "深色下装压住比例"]
  },
  closetItems
};

async function testLocalRecommendationUsesWardrobe() {
  const result = await recommendationService.recommendOutfit(baseInput);

  assert.strictEqual(result.provider, "local_recommendation");
  assert.ok(result.selectedItemIds.length > 0);
  assert.ok(result.recommendationSnapshot);
  assert.strictEqual(result.recommendationSnapshot.sourceMode, "wardrobe_first");
  assert.strictEqual(result.stylingNotes.length, 3);
  assert.ok(result.outfitBrief.usedClosetItemLabels.length > 0);
}

async function testFreeModeDoesNotForceWardrobe() {
  const result = await recommendationService.recommendOutfit({
    ...baseInput,
    sourceMode: "free"
  });

  assert.deepStrictEqual(result.selectedItemIds, []);
  assert.deepStrictEqual(result.outfitBrief.sourceMix, ["trend_library"]);
  assert.strictEqual(result.recommendationSnapshot.sourceMode, "free");
}

async function testRecommendationProviderFallback() {
  const result = await recommendationService.recommendOutfit(baseInput, {
    providers: [
      {
        name: "broken_llm",
        run: async () => {
          throw new Error("llm timeout");
        }
      },
      {
        name: "backup_llm",
        run: async () => ({
          recommendationSnapshot: { scene: "上班", sourceMode: "wardrobe_first" },
          outfitBrief: { usedClosetItemIds: ["backup"], usedClosetItems: [], usedClosetItemLabels: ["备用单品"], trendFillSlots: [], sourceMix: ["wardrobe"] },
          selectedItems: [],
          selectedItemIds: ["backup"],
          missingSlots: [],
          stylingNotes: [{ name: "单品逻辑", copy: "备用模型输出" }],
          confidence: 0.6,
          reasoningSummary: "backup"
        })
      }
    ]
  });

  assert.strictEqual(result.provider, "backup_llm");
  assert.strictEqual(result.providerAttempts.length, 2);
  assert.strictEqual(result.providerAttempts[0].status, "failed");
  assert.deepStrictEqual(result.selectedItemIds, ["backup"]);
}

async function main() {
  await testLocalRecommendationUsesWardrobe();
  await testFreeModeDoesNotForceWardrobe();
  await testRecommendationProviderFallback();
  console.log("recommendation service tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
