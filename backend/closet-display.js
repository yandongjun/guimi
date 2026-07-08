function uniqueLabels(labels = []) {
  const seen = new Set();
  return (Array.isArray(labels) ? labels : [])
    .map((label) => String(label || "").trim())
    .filter((label) => {
      if (!label || seen.has(label)) return false;
      seen.add(label);
      return true;
    });
}

function fitScopeFor(item = {}) {
  const styleLabels = uniqueLabels(item.styleLabels);
  const sceneLabels = uniqueLabels(item.sceneLabels);
  if (styleLabels.includes("日常休闲")) return "日常休闲";
  if (sceneLabels.length > 3) return `${sceneLabels.slice(0, 2).join("/")}等`;
  if (sceneLabels.length >= 2) return sceneLabels.join("/");
  if (sceneLabels.length === 1) return sceneLabels[0];
  return "百搭基础";
}

function visibleColorLabel(item = {}) {
  const color = String(item.color || "");
  const label = String(item.colorLabel || "").trim();
  if (!label || color === "neutral" || label === "中性色") return "颜色待确认";
  return label;
}

function displayMetaFor(item = {}) {
  return displayMetaPartsFor(item).map((part) => part.value).filter(Boolean).join(" · ");
}

function displayMetaPartsFor(item = {}) {
  return [
    { label: "颜色", value: visibleColorLabel(item) },
    { label: "品类", value: item.subCategoryLabel || item.categoryLabel || "单品" },
    { label: "场景", value: fitScopeFor(item) }
  ].filter((part) => part.value);
}

function displayTagsFor(item = {}) {
  return uniqueLabels([
    ...(item.styleLabels || []),
    ...(item.bodyStrategyLabels || [])
  ]).slice(0, 4);
}

function displayAnalysisMessageFor(item = {}) {
  if (item.analysisStatus === "success") return "";
  return item.analysisMessage || item.analyzerError || "";
}

function decorateClosetItem(item = {}) {
  return {
    ...item,
    displayMeta: displayMetaFor(item),
    displayMetaParts: displayMetaPartsFor(item),
    displayTags: displayTagsFor(item),
    displayAnalysisMessage: displayAnalysisMessageFor(item)
  };
}

module.exports = {
  decorateClosetItem,
  displayAnalysisMessageFor,
  displayMetaFor,
  displayMetaPartsFor,
  displayTagsFor,
  fitScopeFor,
  visibleColorLabel
};
