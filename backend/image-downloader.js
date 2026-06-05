const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const assetStore = require("./asset-store");

const maxLocalImageBytes = 600 * 1024;
const maxLocalPngBytes = 1600 * 1024;

function resolveProjectPath(targetPath) {
  if (!targetPath || typeof targetPath !== "string") {
    throw new Error("targetPath is required");
  }
  const resolved = assetStore.resolveLocalFile(targetPath);
  if (!resolved) {
    throw new Error("targetPath must stay inside workspace or runtime root");
  }
  return resolved;
}

function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[2], "base64");
}

async function imageBytesFromUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error("imageUrl is required");
  }

  if (imageUrl.startsWith("data:")) {
    const bytes = parseDataUrl(imageUrl);
    if (!bytes) throw new Error("invalid data image url");
    return bytes;
  }

  if (/^[A-Za-z0-9+/=]+$/.test(imageUrl) && imageUrl.length > 200) {
    return Buffer.from(imageUrl, "base64");
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`image download failed: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function tryOptimizeJpeg(bytes) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const input = path.join(os.tmpdir(), `guimi-source-${suffix}`);
  const output = path.join(os.tmpdir(), `guimi-output-${suffix}.jpg`);
  try {
    fs.writeFileSync(input, bytes);
    const result = spawnSync("ffmpeg", [
      "-y",
      "-i",
      input,
      "-vf",
      "scale=768:-2",
      "-q:v",
      "7",
      output
    ], {
      encoding: "utf8",
      windowsHide: true
    });
    if (result.status !== 0 || !fs.existsSync(output)) return bytes;
    const optimized = fs.readFileSync(output);
    return optimized.length > 0 && optimized.length < bytes.length ? optimized : bytes;
  } catch (error) {
    return bytes;
  } finally {
    fs.rmSync(input, { force: true });
    fs.rmSync(output, { force: true });
  }
}

function optimizeForTarget(bytes, targetPath) {
  const ext = path.extname(targetPath || "").toLowerCase();
  if ((ext === ".jpg" || ext === ".jpeg") && bytes.length > maxLocalImageBytes) {
    return tryOptimizeJpeg(bytes);
  }
  return bytes;
}

async function downloadImageToTarget(imageUrl, targetPath) {
  const resolved = resolveProjectPath(targetPath);
  const bytes = optimizeForTarget(await imageBytesFromUrl(imageUrl), targetPath);
  if (path.extname(targetPath || "").toLowerCase() === ".png" && bytes.length > maxLocalPngBytes) {
    throw new Error(`transparent PNG is too large for local mini program asset: ${bytes.length} bytes`);
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, bytes);
  return {
    localPath: targetPath,
    absolutePath: resolved,
    bytes: bytes.length
  };
}

module.exports = {
  downloadImageToTarget,
  resolveProjectPath
};
