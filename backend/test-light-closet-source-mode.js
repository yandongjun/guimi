const assert = require("assert");
const lightCloset = require("./light-closet");

const item = {
  id: "closet-a",
  name: "\u5976\u6cb9\u767d\u897f\u88c5",
  category: "outerwear",
  sceneTags: ["office"],
  bodyStrategyTags: ["define_shoulder"],
  styleTags: ["clean_fit"]
};

{
  const picked = lightCloset.pickClosetItems([item], {
    scene: "\u4e0a\u73ed",
    sourceMode: "wardrobe_first",
    bodyStrategies: ["define_shoulder"]
  });
  assert.deepEqual(picked.usedClosetItemLabels, ["\u5976\u6cb9\u767d\u897f\u88c5"]);
  assert.ok(picked.sourceMix.includes("wardrobe"));
}

{
  const picked = lightCloset.pickClosetItems([item], {
    scene: "\u4e0a\u73ed",
    sourceMode: "free",
    bodyStrategies: ["define_shoulder"]
  });
  assert.deepEqual(picked.usedClosetItemLabels, []);
  assert.deepEqual(picked.usedClosetItemIds, []);
  assert.deepEqual(picked.sourceMix, ["trend_library"]);
}

console.log("light closet source mode checks passed");
