const assert = require("assert");
const { buildStylingNotes } = require("./styling-notes");

const notes = buildStylingNotes({
  displayTitle: "短外套 + 柔软裙感",
  usedClosetItemLabels: ["短款奶油白西装"],
  outfitBrief: {
    usedClosetItems: [{ bodyStrategyLabels: ["提高腰线"] }]
  }
});

assert.deepEqual(notes.map((item) => item.name), ["单品逻辑", "色彩逻辑", "修饰重点"]);
assert.ok(notes[0].copy.includes("短款奶油白西装"));
assert.ok(notes.every((item) => item.copy.length <= 18));

console.log("styling notes checks passed");
