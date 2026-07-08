const assetStore = require("./asset-store");

function withCacheBust(url, version) {
  if (!url || !version) return url || "";
  const separator = String(url).includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(String(version))}`;
}

function localPreviewUrl(asset = {}, req) {
  if (!asset || !asset.localPath) return "";
  return `${assetStore.requestBaseUrl(req)}/assets/local${assetStore.normalizeLocalPath(asset.localPath)}`;
}

function publicGeneratedImageUrl(job = {}, asset = null, req) {
  const version = job.updatedAt || job.createdAt || "";
  const localUrl = localPreviewUrl(asset, req);
  if (localUrl) return withCacheBust(localUrl, version);
  if (asset && (asset.previewUrl || asset.url)) return withCacheBust(asset.previewUrl || asset.url, version);
  return withCacheBust(job.imageUrl || "", version);
}

function recordTitleFor(job = {}) {
  const closetLabels = Array.isArray(job.usedClosetItemLabels)
    ? job.usedClosetItemLabels.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  if (closetLabels.length >= 2) return closetLabels.slice(0, 2).join(" + ");
  if (closetLabels.length === 1) return closetLabels[0];
  return job.outfitTitle || "穿搭生成记录";
}

function sceneSlug(scene = "") {
  const value = String(scene || "").trim();
  const map = {
    "\u4e0a\u73ed": "office",
    "\u7ea6\u4f1a": "dating",
    "\u805a\u4f1a": "party",
    "\u51fa\u6e38": "travel",
    "\u901b\u8857": "shopping"
  };
  return map[value] || value.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "") || "scene";
}

function generatedTargetPathForJob(userId = "", scene = "", jobId = "") {
  const safeUserId = String(userId || "user").replace(/[^\w-]/g, "-");
  const safeJobId = String(jobId || Date.now()).replace(/[^\w-]/g, "-");
  return `/__runtime__/generated/users/${safeUserId}-${sceneSlug(scene)}-${safeJobId}.jpg`;
}

module.exports = {
  generatedTargetPathForJob,
  publicGeneratedImageUrl,
  recordTitleFor,
  withCacheBust
};
