const assert = require("assert");
const { normalizeJobs } = require("./record-presenter");

const jobs = normalizeJobs([
  {
    id: "a",
    status: "ready",
    scene: "聚会",
    displayRecordTitle: "短西装 + 酒红半裙",
    imageUrl: "http://x/a.jpg?v=1",
    usedClosetItemLabels: ["短西装", "酒红半裙"],
    sourceMode: "wardrobe_first",
    stylePreference: "知性",
    updatedAt: "2026-06-12T10:00:00.000Z"
  },
  {
    id: "b",
    status: "ready",
    scene: "聚会",
    outfitTitle: "利落外套 + 亮点配饰",
    imageUrl: "http://x/a.jpg?v=2",
    sourceMode: "free"
  }
]);

assert.equal(jobs[0].displayTitle, "短西装 + 酒红半裙");
assert.equal(jobs[0].modeText, "优先衣橱");
assert.equal(jobs[0].styleText, "知性");
assert.equal(jobs[0].previewCta, "查看大图");
assert.equal(jobs[0].repeatedImage, false);
assert.equal(jobs[1].modeText, "自由搭配");
assert.equal(jobs[1].repeatedImage, true);

console.log("record presenter checks passed");
