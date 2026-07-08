const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const runtimeDir = path.join(os.tmpdir(), `guimi-recommendations-${Date.now()}`);
process.env.GUIMI_RUNTIME_DIR = runtimeDir;

const recommendationStore = require("./recommendation-store");

try {
  const recommendation = recommendationStore.createRecommendation({
    userId: "user-a",
    scene: "约会",
    stylePreference: "知性",
    sourceMode: "wardrobe_first",
    selectedItems: [{ itemId: "closet-a", name: "短西装", source: "wardrobe", slot: "外套", why: "稳住主线" }],
    selectedItemIds: ["closet-a"],
    stylingNotes: [
      { name: "单品逻辑", copy: "短西装稳住主线" },
      { name: "色彩逻辑", copy: "奶油白提亮气色" },
      { name: "修饰重点", copy: "短上身抬高重心" }
    ],
    imagePrompt: "prompt text"
  });

  assert.ok(recommendation.id.startsWith("rec-"));
  assert.equal(recommendation.scene, "约会");
  assert.equal(recommendation.status, "created");
  assert.equal(recommendation.stylingNotes.length, 3);

  const bound = recommendationStore.bindImageJob(recommendation.id, {
    imageJobId: "img-1",
    generatedImageUrl: "http://example.com/a.jpg"
  });
  assert.equal(bound.imageJobId, "img-1");
  assert.equal(bound.generatedImageUrl, "http://example.com/a.jpg");

  const rated = recommendationStore.saveFeedback(recommendation.id, {
    rating: "like"
  });
  assert.equal(rated.feedback.rating, "like");

  const listed = recommendationStore.listRecommendations({ userId: "user-a" });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, recommendation.id);

  console.log("recommendation store checks passed");
} finally {
  fs.rmSync(runtimeDir, { recursive: true, force: true });
}
