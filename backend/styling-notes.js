function firstText(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => String(item || "").trim())
    .find(Boolean) || "";
}

function shorten(text = "", max = 18) {
  const clean = String(text || "").replace(/\s+/g, "");
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function buildClothingChoiceCopy(snapshot = {}, outfit = {}) {
  const labels = Array.isArray(snapshot.usedClosetItemLabels)
    ? snapshot.usedClosetItemLabels.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  if (labels.length) return shorten(`用${labels[0]}稳住主线`);
  const title = snapshot.displayTitle || outfit.displayTitle || outfit.title || "";
  if (title) return shorten(`${title.replace(/\s*\+\s*/g, "配")}定主线`);
  return "先定主单品";
}

function buildColorRelationCopy(snapshot = {}, outfit = {}) {
  const aura = outfit.luckyColor || outfit.luckyColorPart || snapshot.luckyColor || "";
  const colorReason = firstText(outfit.colorReasons || outfit.colorNotes);
  if (colorReason) return shorten(colorReason);
  if (aura) return shorten(`${aura}点亮气色`);
  return "浅色提亮气色";
}

function buildBodyShapeCopy(snapshot = {}, outfit = {}) {
  const brief = snapshot.outfitBrief || {};
  const usedItems = Array.isArray(brief.usedClosetItems) ? brief.usedClosetItems : [];
  const strategy = firstText([
    ...(outfit.bodyStrategyLabels || []),
    ...(outfit.bodyStrategies || []),
    ...(outfit.strategyLabels || []),
    ...usedItems.flatMap((item) => item.bodyStrategyLabels || [])
  ]);
  if (strategy) return shorten(`${strategy}更利落`);
  const notes = Array.isArray(snapshot.visualNotes) ? snapshot.visualNotes : [];
  const noteText = firstText(notes.map((item) => {
    if (!item) return "";
    if (typeof item === "string") return item;
    return item.text || item.copy || item.reason || "";
  }));
  if (noteText) return shorten(noteText);
  return "短上身抬高重心";
}

function buildStylingNotes(snapshot = {}, outfit = {}) {
  return [
    { name: "单品逻辑", copy: buildClothingChoiceCopy(snapshot, outfit) },
    { name: "色彩逻辑", copy: buildColorRelationCopy(snapshot, outfit) },
    { name: "修饰重点", copy: buildBodyShapeCopy(snapshot, outfit) }
  ];
}

module.exports = {
  buildStylingNotes
};
