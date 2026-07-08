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

function buildClothingChoiceCopy(outfit = {}) {
  const labels = Array.isArray(outfit.usedClosetItemLabels)
    ? outfit.usedClosetItemLabels.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  if (labels.length) {
    return shorten(`用${labels[0]}稳住主线`);
  }
  const title = outfit.displayTitle || outfit.title || "";
  if (title) return shorten(`${title.replace(/\s*\+\s*/g, "配")}定主线`);
  return "先定主单品";
}

function buildColorRelationCopy(outfit = {}) {
  const aura = outfit.luckyColor || outfit.luckyColorPart || "";
  const colorReason = firstText(outfit.colorReasons || outfit.colorNotes);
  if (colorReason) return shorten(colorReason);
  if (aura) return shorten(`${aura}点亮气色`);
  return "浅色提亮气色";
}

function buildBodyShapeCopy(outfit = {}) {
  const strategy = firstText(outfit.bodyStrategyLabels || outfit.bodyStrategies || outfit.strategyLabels);
  if (strategy) return shorten(`${strategy}更利落`);
  const notes = Array.isArray(outfit.visualNotes) ? outfit.visualNotes : [];
  const noteText = firstText(notes.map((item) => {
    if (!item) return "";
    if (typeof item === "string") return item;
    return item.text || item.copy || item.reason || "";
  }));
  if (noteText) return shorten(noteText);
  return "短上身抬高重心";
}

function stylingLogicSummary(outfit = {}) {
  const snapshotNotes = outfit.recommendationSnapshot && Array.isArray(outfit.recommendationSnapshot.stylingNotes)
    ? outfit.recommendationSnapshot.stylingNotes
    : [];
  const cleanSnapshotNotes = snapshotNotes
    .map((item) => ({
      name: String((item && item.name) || "").trim(),
      copy: String((item && item.copy) || "").trim()
    }))
    .filter((item) => item.name && item.copy)
    .slice(0, 3);
  if (cleanSnapshotNotes.length === 3) {
    return cleanSnapshotNotes;
  }
  return [
    { name: "单品逻辑", copy: buildClothingChoiceCopy(outfit) },
    { name: "色彩逻辑", copy: buildColorRelationCopy(outfit) },
    { name: "修饰重点", copy: buildBodyShapeCopy(outfit) }
  ];
}

module.exports = {
  stylingLogicSummary
};
