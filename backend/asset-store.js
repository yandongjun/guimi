const fs = require("fs");
const os = require("os");
const path = require("path");
const sharedAssets = require("../data/assets");

const workspaceRoot = path.resolve(__dirname, "..");
const runtimeRoot = path.join(process.env.GUIMI_RUNTIME_DIR || process.env.LOCALAPPDATA || os.tmpdir(), "guimi-runtime");
const runtimePrefix = "/__runtime__";
const storageDir = path.join(runtimeRoot, "storage");
const uploadsDir = path.join(storageDir, "uploads");
const dynamicAssetFile = path.join(storageDir, "assets.json");

function isInsideRoot(root, target) {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function ensureStorage() {
  fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(dynamicAssetFile)) {
    fs.writeFileSync(dynamicAssetFile, "[]\n", "utf8");
  }
}

function readDynamicAssets() {
  ensureStorage();
  try {
    const parsed = JSON.parse(fs.readFileSync(dynamicAssetFile, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeDynamicAssets(items) {
  ensureStorage();
  fs.writeFileSync(dynamicAssetFile, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

function normalizeLocalPath(localPath) {
  const value = String(localPath || "").replace(/\\/g, "/");
  return value.startsWith("/") ? value : `/${value}`;
}

function trimSlash(value) {
  return String(value || "").replace(/\/$/, "");
}

function requestBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return trimSlash(process.env.PUBLIC_BASE_URL);
  const host = req && req.headers && req.headers.host ? req.headers.host : `127.0.0.1:${process.env.PORT || 8787}`;
  const proto = req && req.headers && req.headers["x-forwarded-proto"] ? req.headers["x-forwarded-proto"] : "http";
  return `${proto}://${host}`;
}

function repoBaseUrl() {
  return trimSlash(process.env.GITHUB_IMAGE_BASE_URL || process.env.ASSET_PUBLIC_BASE_URL || "");
}

function buildUrl(localPath, req, asset = {}) {
  if (asset.remoteUrl) return asset.remoteUrl;
  const normalized = normalizeLocalPath(localPath);
  const githubBase = repoBaseUrl();
  if (githubBase && asset.storage === "repo") {
    return `${githubBase}${normalized}`;
  }
  return `${requestBaseUrl(req)}/assets/local${normalized}`;
}

function toPublicAsset(asset, req) {
  const normalized = {
    ...asset,
    localPath: normalizeLocalPath(asset.localPath || asset.path || "")
  };
  const previewPath = normalized.previewPath ? normalizeLocalPath(normalized.previewPath) : normalized.localPath;
  return {
    ...normalized,
    url: buildUrl(normalized.localPath, req, normalized),
    previewUrl: buildUrl(previewPath, req, {
      ...normalized,
      remoteUrl: normalized.previewRemoteUrl || ""
    })
  };
}

function listAssets(filter = {}, req) {
  const dynamicAssets = readDynamicAssets();
  const all = [...sharedAssets.staticAssets, ...dynamicAssets];
  return all
    .filter((asset) => {
      if (filter.group && asset.group !== filter.group) return false;
      if (filter.type && asset.type !== filter.type) return false;
      if (filter.slot && asset.slot !== filter.slot) return false;
      return true;
    })
    .map((asset) => toPublicAsset(asset, req));
}

function getAsset(id, req) {
  const asset = sharedAssets.getAssetById(id) || readDynamicAssets().find((item) => item.id === id);
  return asset ? toPublicAsset(asset, req) : null;
}

function getAssetByLocalPath(localPath, req) {
  const normalized = normalizeLocalPath(localPath);
  const asset = sharedAssets.getAssetByLocalPath(normalized)
    || readDynamicAssets().find((item) => normalizeLocalPath(item.localPath) === normalized);
  return asset ? toPublicAsset(asset, req) : null;
}

function upsertAsset(asset) {
  const dynamicAssets = readDynamicAssets();
  const index = dynamicAssets.findIndex((item) => item.id === asset.id);
  const next = {
    ...asset,
    localPath: normalizeLocalPath(asset.localPath),
    createdAt: asset.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (index >= 0) {
    dynamicAssets[index] = { ...dynamicAssets[index], ...next };
  } else {
    dynamicAssets.push(next);
  }
  writeDynamicAssets(dynamicAssets);
  return next;
}

function registerUploadedAsset(payload, req) {
  const asset = upsertAsset({
    id: payload.id || `asset-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type: payload.type || "upload",
    group: payload.group || "user_uploads",
    slot: payload.slot || "",
    localPath: payload.localPath,
    remoteUrl: payload.remoteUrl || "",
    previewRemoteUrl: payload.previewRemoteUrl || "",
    mimeType: payload.mimeType || "application/octet-stream",
    storage: "backend",
    source: payload.source || "upload",
    originalName: payload.originalName || "",
    meta: payload.meta || {}
  });
  return toPublicAsset(asset, req);
}

function registerGeneratedAsset(job, req) {
  if (!job || !job.imageUrl) return null;
  const asset = upsertAsset({
    id: `generated-${job.id}`,
    type: "generated_tryon",
    group: "daily_tryon",
    localPath: job.imageUrl,
    remoteUrl: job.remoteImageUrl || "",
    mimeType: job.imageUrl.endsWith(".png") ? "image/png" : "image/jpeg",
    storage: job.remoteImageUrl ? "remote" : "backend",
    source: "image_job",
    meta: {
      imageJobId: job.id,
      userId: job.userId,
      scene: job.scene,
      model: job.model
    }
  });
  return toPublicAsset(asset, req);
}

function resolveLocalFile(localPath) {
  const normalized = normalizeLocalPath(localPath);
  if (normalized.startsWith(`${runtimePrefix}/`)) {
    const runtimeRelative = normalized.slice(runtimePrefix.length).replace(/^\/+/, "").replaceAll("/", path.sep);
    const resolvedRuntime = path.resolve(runtimeRoot, runtimeRelative);
    if (!isInsideRoot(runtimeRoot, resolvedRuntime)) {
      return null;
    }
    return resolvedRuntime;
  }
  const workspaceRelative = normalized.replace(/^\/+/, "").replaceAll("/", path.sep);
  const resolvedWorkspace = path.resolve(workspaceRoot, workspaceRelative);
  if (!isInsideRoot(workspaceRoot, resolvedWorkspace)) {
    return null;
  }
  return resolvedWorkspace;
}

function publicLocalPathForAbsolute(filePath) {
  const resolved = path.resolve(filePath);
  if (isInsideRoot(runtimeRoot, resolved)) {
    const relative = path.relative(runtimeRoot, resolved).replace(/\\/g, "/");
    return normalizeLocalPath(`${runtimePrefix}/${relative}`);
  }
  if (isInsideRoot(workspaceRoot, resolved)) {
    return normalizeLocalPath(path.relative(workspaceRoot, resolved).replace(/\\/g, "/"));
  }
  return null;
}

function mimeTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

module.exports = {
  workspaceRoot,
  runtimeRoot,
  runtimePrefix,
  uploadsDir,
  normalizeLocalPath,
  requestBaseUrl,
  toPublicAsset,
  listAssets,
  getAsset,
  getAssetByLocalPath,
  publicLocalPathForAbsolute,
  registerUploadedAsset,
  registerGeneratedAsset,
  resolveLocalFile,
  mimeTypeFor
};
