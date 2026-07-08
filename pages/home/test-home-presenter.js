const assert = require("assert");
const { stylingLogicSummary } = require("./home-presenter");

const summary = stylingLogicSummary({
  displayTitle: "短外套 + 柔软裙感",
  usedClosetItemLabels: ["短款奶油白西装", "黑色玛丽珍鞋"],
  visualNotes: [{ text: "短外套收上身，裙摆弱化腿部线条" }]
});

assert.deepEqual(summary.map((item) => item.name), ["单品逻辑", "色彩逻辑", "修饰重点"]);
assert.ok(summary[0].copy.includes("短款奶油白西装"));
assert.ok(!summary.some((item) => item.name === "衣橱引用"));
assert.ok(!summary.some((item) => item.name === "场景"));
assert.ok(!summary.some((item) => item.name === "比例"));
assert.ok(summary.every((item) => item.copy.length <= 18));

const freeSummary = stylingLogicSummary({
  displayTitle: "利落外套 + 亮点配饰",
  usedClosetItemLabels: []
});
assert.equal(freeSummary[0].name, "单品逻辑");
assert.ok(freeSummary[0].copy.includes("利落外套"));

const serverSummary = stylingLogicSummary({
  recommendationSnapshot: {
    stylingNotes: [
      { name: "单品逻辑", copy: "后端短评" },
      { name: "色彩逻辑", copy: "后端色彩" },
      { name: "修饰重点", copy: "后端修饰" }
    ]
  },
  usedClosetItemLabels: ["不应展示"]
});
assert.deepEqual(serverSummary.map((item) => item.copy), ["后端短评", "后端色彩", "后端修饰"]);

console.log("home presenter checks passed");
