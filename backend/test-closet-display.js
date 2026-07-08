const assert = require("assert");

const closetDisplay = require("./closet-display");

const cn = {
  colorPending: "\u989c\u8272\u5f85\u786e\u8ba4",
  neutral: "\u4e2d\u6027\u8272",
  skirt: "\u534a\u8eab\u88d9",
  clean: "\u5e72\u51c0\u5229\u843d",
  extendLeg: "\u62c9\u957f\u817f\u90e8\u6bd4\u4f8b",
  office: "\u4e0a\u73ed",
  travel: "\u51fa\u6e38",
  party: "\u805a\u4f1a",
  cloudDone: "\u4e91\u8bc6\u522b\u5b8c\u6210",
  denimBlue: "\u725b\u4ed4\u84dd",
  tee: "\u77ed\u8896T\u6064",
  casual: "\u65e5\u5e38\u4f11\u95f2",
  summer: "\u590f\u5b63\u8f7b\u8584",
  upperFocus: "\u4e0a\u534a\u8eab\u505a\u91cd\u70b9",
  black: "\u9ed1\u8272",
  shoes: "\u978b",
  commute: "\u901a\u52e4",
  failed: "\u4e91\u8bc6\u522b\u5931\u8d25\uff0c\u5df2\u4f7f\u7528\u672c\u5730\u89c4\u5219\u6807\u7b7e"
};

function main() {
  const neutralSkirt = closetDisplay.decorateClosetItem({
    name: `${cn.neutral}${cn.skirt}`,
    color: "neutral",
    colorLabel: cn.neutral,
    subCategoryLabel: cn.skirt,
    styleLabels: [cn.clean],
    bodyStrategyLabels: [cn.extendLeg],
    sceneLabels: [cn.office, cn.travel, cn.party],
    analysisStatus: "success",
    analysisMessage: cn.cloudDone
  });

  assert.equal(neutralSkirt.displayMeta, `${cn.colorPending} · ${cn.skirt} · ${cn.office}/${cn.travel}/${cn.party}`);
  assert.deepEqual(neutralSkirt.displayMetaParts, [
    { label: "\u989c\u8272", value: cn.colorPending },
    { label: "\u54c1\u7c7b", value: cn.skirt },
    { label: "\u573a\u666f", value: `${cn.office}/${cn.travel}/${cn.party}` }
  ]);
  assert.deepEqual(neutralSkirt.displayTags, [cn.clean, cn.extendLeg]);
  assert.equal(neutralSkirt.displayAnalysisMessage, "");

  const casualTee = closetDisplay.decorateClosetItem({
    color: "denim_blue",
    colorLabel: cn.denimBlue,
    subCategoryLabel: cn.tee,
    styleLabels: [cn.clean, cn.casual, cn.summer],
    bodyStrategyLabels: [cn.upperFocus],
    sceneLabels: [cn.office, cn.travel],
    analysisStatus: "success"
  });

  assert.equal(casualTee.displayMeta, `${cn.denimBlue} · ${cn.tee} · ${cn.casual}`);
  assert.deepEqual(casualTee.displayTags, [cn.clean, cn.casual, cn.summer, cn.upperFocus]);

  const failedItem = closetDisplay.decorateClosetItem({
    colorLabel: cn.black,
    subCategoryLabel: cn.shoes,
    sceneLabels: [cn.office],
    styleLabels: [cn.commute],
    analysisStatus: "failed",
    analysisMessage: cn.failed
  });
  assert.equal(failedItem.displayAnalysisMessage, cn.failed);
}

main();
console.log("closet display checks passed");
