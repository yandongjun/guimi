const fs = require("fs");
const http = require("http");
const path = require("path");
const mock = require("../data/mock");
const imageTaskStore = require("./image-task-store");
const moxingImage = require("./providers/moxing-image");
const imageDownloader = require("./image-downloader");
const imageVariants = require("./image-variants");
const imageJobPresenter = require("./image-job-presenter");
const assetStore = require("./asset-store");
const userStateStore = require("./user-state-store");
const recommendationStore = require("./recommendation-store");
const recommendationService = require("./recommendation-service");
const imageGenerationService = require("./image-generation-service");
const stylingNotes = require("./styling-notes");
const backgroundRemoval = require("./providers/background-removal");
const publicImageService = require("./public-image-service");
const fileServerUploader = require("./file-server-uploader");
const aliyunOssUploader = require("./aliyun-oss-uploader");
const lightCloset = require("./light-closet");
const closetAssets = require("./closet-assets");
const closetDisplay = require("./closet-display");
const closetUploadPresenter = require("./closet-upload-presenter");
const clothingAnalysis = require("./clothing-analysis-service");
const clothingSegmentation = require("./clothing-segmentation-service");
const mvpDebugService = require("./mvp-debug-service");
const { luckyColorForZodiac } = require("../data/zodiac-lucky-colors");

const persistedState = userStateStore.loadState({
  activeUserId: "user-a",
  generationUsed: 0,
  adUnlocks: 0,
  users: mock.testUsers,
  closetItems: mock.closet
});

const state = {
  activeUserId: persistedState.activeUserId,
  generationUsed: persistedState.generationUsed,
  adUnlocks: persistedState.adUnlocks,
  lastResetDate: persistedState.lastResetDate,
  users: persistedState.users,
  closetItems: persistedState.closetItems || mock.closet,
  generations: {},
  ratings: []
};

const ACTIVE_IMAGE_JOB_STATUS = ["pending", "submitted", "queued", "running", "processing"];
const RECOMMENDATION_STYLIST_PROMPT = "你是一位专业时尚穿搭顾问，了解最新时尚趋势。请基于用户画像、身材策略、天气、场景、用户衣橱和平台衣服库，生成一套现实可穿的结构化穿搭方案。优先使用用户衣橱；只有用户衣橱无法满足场景、天气或审美目标时，才从平台衣服库或者互联网信息补位。";

function checkDailyReset() {
  const today = new Date().toISOString().split("T")[0];
  if (state.lastResetDate !== today) {
    state.generationUsed = 0;
    state.adUnlocks = 0;
    state.lastResetDate = today;
    userStateStore.saveState({
      activeUserId: state.activeUserId,
      generationUsed: state.generationUsed,
      adUnlocks: state.adUnlocks,
      lastResetDate: state.lastResetDate,
      users: state.users,
      closetItems: state.closetItems
    });
  }
}

function quota() {
  checkDailyReset();
  const currentUser = activeUser();
  const baseLimit = currentUser.membership === "paid" ? 10 : (currentUser.dailyGenerationLimit || 2);
  const limit = baseLimit + (currentUser.membership === "paid" ? 0 : state.adUnlocks);
  return {
    membership: currentUser.membership,
    baseLimit,
    limit,
    used: state.generationUsed,
    remaining: Math.max(limit - state.generationUsed, 0),
    adUnlocks: state.adUnlocks,
    maxAdUnlocks: 3
  };
}

function consumeGenerationQuotaOnce(job) {
  if (!job || job.quotaConsumed) return job;
  state.generationUsed += 1;
  persistRuntimeState();
  return imageTaskStore.updateJob(job.id, { quotaConsumed: true }) || job;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        resolve({});
      }
    });
  });
}

function readRawBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function splitBuffer(buffer, separator) {
  const parts = [];
  let start = 0;
  let index = buffer.indexOf(separator, start);
  while (index !== -1) {
    parts.push(buffer.slice(start, index));
    start = index + separator.length;
    index = buffer.indexOf(separator, start);
  }
  parts.push(buffer.slice(start));
  return parts;
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = /boundary=([^;]+)/i.exec(contentType || "");
  if (!boundaryMatch) return { fields: {}, files: [] };
  const boundary = Buffer.from(`--${boundaryMatch[1].replace(/^"|"$/g, "")}`);
  const fields = {};
  const files = [];
  splitBuffer(buffer, boundary).forEach((part) => {
    let chunk = part;
    if (chunk.slice(0, 2).toString() === "\r\n") chunk = chunk.slice(2);
    if (chunk.slice(-2).toString() === "\r\n") chunk = chunk.slice(0, -2);
    if (chunk.toString("ascii", 0, 2) === "--") return;
    const headerEnd = chunk.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd < 0) return;
    const headerText = chunk.slice(0, headerEnd).toString("utf8");
    const body = chunk.slice(headerEnd + 4);
    const nameMatch = /name="([^"]+)"/.exec(headerText);
    if (!nameMatch) return;
    const filenameMatch = /filename="([^"]*)"/.exec(headerText);
    const contentTypeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headerText);
    const name = nameMatch[1];
    if (filenameMatch) {
      files.push({
        fieldName: name,
        filename: filenameMatch[1],
        contentType: contentTypeMatch ? contentTypeMatch[1].trim() : "application/octet-stream",
        buffer: body
      });
      return;
    }
    fields[name] = body.toString("utf8");
  });
  return { fields, files };
}

function ok(data) {
  return { code: 0, data };
}

function fail(message) {
  return { code: 1, message };
}

function withCacheBust(url, version) {
  if (!url || !version) return url || "";
  const separator = String(url).includes("?") ? "&" : "?";
  const stamp = encodeURIComponent(String(version));
  return `${url}${separator}v=${stamp}`;
}

function versionPublicAsset(asset, version) {
  if (!asset) return null;
  return {
    ...asset,
    url: withCacheBust(asset.url, version),
    previewUrl: withCacheBust(asset.previewUrl || asset.url, version)
  };
}

function rehydratePublicAsset(asset, req) {
  if (!asset || !asset.id) return asset || null;
  return assetStore.getAsset(asset.id, req) || asset;
}

function weatherForUser(user) {
  return {
    ...mock.weather,
    city: user && user.city ? user.city : mock.weather.city
  };
}

function luckyColorForUser(user) {
  return luckyColorForZodiac(user && user.zodiac ? user.zodiac : mock.dailyAura.zodiac);
}

function sceneSlug(scene) {
  const slugMap = {
    "上班": "office",
    "逛街": "shopping",
    "约会": "dating",
    "聚会": "party",
    "出游": "travel",
    "更多": "more"
  };
  return slugMap[scene] || encodeURIComponent(String(scene || "scene")).replace(/%/g, "").toLowerCase();
}

function pickReferenceSlots(photos = {}, photoAssets = {}) {
  const slots = ["front", "side", "back"];
  return slots
    .map((slot) => {
      const asset = photoAssets[slot] || null;
      return {
        slot,
        assetId: asset && asset.id ? asset.id : "",
        localPath: asset && asset.localPath ? asset.localPath : "",
        remoteUrl: asset && asset.remoteUrl ? asset.remoteUrl : "",
        url: asset && (asset.url || asset.previewUrl) ? (asset.url || asset.previewUrl) : (photos[slot] || ""),
        previewUrl: asset && (asset.previewUrl || asset.url) ? (asset.previewUrl || asset.url) : (photos[slot] || ""),
        mimeType: asset && asset.mimeType ? asset.mimeType : ""
      };
    })
    .filter((item) => item.url || item.localPath);
}

function mergeReferenceImagesBySlot(referenceImages = [], nextImage) {
  if (!nextImage || !nextImage.slot) {
    return referenceImages.filter(Boolean);
  }
  const nextList = referenceImages
    .filter((item) => item && item.slot && item.slot !== nextImage.slot)
    .concat(nextImage);
  const order = { front: 1, side: 2, back: 3 };
  return nextList.sort((left, right) => (order[left.slot] || 99) - (order[right.slot] || 99));
}

function bodyScanVariantMetaFromAbsolute(filePath, req, size) {
  const localPath = assetStore.publicLocalPathForAbsolute(filePath);
  if (!localPath) return null;
  return {
    width: size && size.width ? size.width : 0,
    height: size && size.height ? size.height : 0,
    localPath,
    url: `${assetStore.requestBaseUrl(req)}/assets/local${localPath}`,
    previewUrl: `${assetStore.requestBaseUrl(req)}/assets/local${localPath}`,
    mimeType: assetStore.mimeTypeFor(filePath)
  };
}

/**
 * 功能：把本地产出的图片上传到文件服务器，并返回前端可直接消费的资源描述。
 * 参数：filePath 产物绝对路径，req 请求对象，size 目标尺寸，options 上传选项。
 * 返回：包含本地路径与公网地址的资源描述。
 * 异常：当本地路径无效时抛出异常；上传失败时默认回退本地地址。
 */
async function bodyScanVariantMetaWithRemote(filePath, req, size, options = {}) {
  const published = await publicImageService.publishLocalImage(filePath, req, {
    id: options.id,
    type: options.type || "body_scan_variant",
    group: options.group || "body_scan_variants",
    slot: options.slot || "",
    originalName: options.originalName || path.basename(filePath),
    source: options.source || "body_scan_variant",
    size,
    meta: options.meta || {}
  });
  if (published.fileServerError) {
    console.log("[FILE-SERVER-UPLOAD] derived asset fallback", {
      label: options.label || "",
      filePath,
      message: published.fileServerError
    });
  }
  return {
    width: size && size.width ? size.width : 0,
    height: size && size.height ? size.height : 0,
    localPath: published.localPath,
    url: published.url,
    previewUrl: published.previewUrl,
    remoteUrl: published.remoteUrl,
    mimeType: published.mimeType,
    fileServerError: published.fileServerError
  };
}

function buildBodyScanVariantMeta(variants, req) {
  if (!variants) return {};
  return {
    portrait: bodyScanVariantMetaFromAbsolute(variants.portrait, req, imageVariants.BODY_SCAN_TARGETS.portrait),
    square: bodyScanVariantMetaFromAbsolute(variants.square, req, imageVariants.BODY_SCAN_TARGETS.square)
  };
}

/**
 * 功能：为一组裁剪/合成产物生成带公网地址的资源描述。
 * 参数：variants 产物绝对路径集合，req 请求对象，options 上传选项。
 * 返回：包含 portrait 与 square 的资源对象。
 * 异常：无。
 */
async function buildBodyScanVariantMetaWithRemote(variants, req, options = {}) {
  if (!variants) return {};
  const [portrait, square] = await Promise.all([
    variants.portrait
      ? bodyScanVariantMetaWithRemote(variants.portrait, req, imageVariants.BODY_SCAN_TARGETS.portrait, {
        originalName: options.portraitName || path.basename(variants.portrait),
        label: `${options.label || "body-scan"}:portrait`
      })
      : Promise.resolve(null),
    variants.square
      ? bodyScanVariantMetaWithRemote(variants.square, req, imageVariants.BODY_SCAN_TARGETS.square, {
        originalName: options.squareName || path.basename(variants.square),
        label: `${options.label || "body-scan"}:square`
      })
      : Promise.resolve(null)
  ]);
  return {
    portrait,
    square
  };
}

function sourcePathsBySlot(referenceImages = []) {
  const ordered = ["front", "side", "back"];
  const map = new Map(referenceImages.map((item) => [item.slot, item]));
  return ordered.map((slot) => {
    const image = map.get(slot);
    return image && image.localPath ? assetStore.resolveLocalFile(image.localPath) : "";
  });
}

/**
 * 功能：把抠图输出文件注册成前端可访问的三视图槽位资源。
 * 参数：sourcePathsBySlotMap 按 front/side/back 顺序的抠图绝对路径，req 请求对象。
 * 返回：按 front/side/back 排序的前端可用资源数组。
 * 异常：无。
 */
function buildCutoutImagesMeta(sourcePathsBySlotMap = [], req) {
  const ordered = ["front", "side", "back"];
  return ordered
    .map((slot, index) => {
      const filePath = sourcePathsBySlotMap[index];
      if (!filePath) return null;
      return {
        slot,
        assetId: "",
        ...bodyScanVariantMetaFromAbsolute(filePath, req, null)
      };
    })
    .filter(Boolean);
}

/**
 * 功能：把抠图输出注册为带公网地址的三视图槽位资源。
 * 参数：sourcePathsBySlotMap 按 front/side/back 顺序的抠图绝对路径，req 请求对象，options 上传选项。
 * 返回：按 front/side/back 排序的前端可用资源数组。
 * 异常：无。
 */
async function buildCutoutImagesMetaWithRemote(sourcePathsBySlotMap = [], req, options = {}) {
  const ordered = ["front", "side", "back"];
  const uploaded = await Promise.all(
    ordered.map(async (slot, index) => {
      const filePath = sourcePathsBySlotMap[index];
      if (!filePath) return null;
      const meta = await bodyScanVariantMetaWithRemote(filePath, req, null, {
        originalName: `${options.userId || "user"}-${slot}-cutout${path.extname(filePath) || ".png"}`,
        label: `${options.label || "cutout"}:${slot}`
      });
      return {
        slot,
        assetId: "",
        ...meta
      };
    })
  );
  return uploaded.filter(Boolean);
}

/**
 * 功能：判断是否命中了抠图服务的并发额度限制。
 * 参数：error 任意异常对象。
 * 返回：布尔值，true 表示需要退避重试。
 * 异常：无。
 */
function isBackgroundRemovalConcurrencyError(error) {
  const message = String((error && error.message) || "");
  return /concurrency limit/i.test(message);
}

/**
 * 功能：简单等待指定毫秒数，用于串行重试时给远端释放并发额度留时间。
 * 参数：ms 等待毫秒数。
 * 返回：Promise。
 * 异常：无。
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 功能：对正侧背三张原图执行人物抠图，输出透明 PNG。
 * 参数：referenceImages 三视图资源数组，userId 用户 ID，req 请求对象。
 * 返回：按 front/side/back 排序的透明抠图资源数组。
 * 异常：抠图失败时抛出异常。
 */
async function createReferenceCutoutImages(referenceImages = [], userId, req) {
  const ordered = ["front", "side", "back"];
  const imageMap = new Map(referenceImages.map((item) => [item.slot, item]));
  const cutoutPaths = [];
  for (const slot of ordered) {
    const image = imageMap.get(slot);
    if (!image || !image.localPath) {
      cutoutPaths.push("");
      continue;
    }
    const sourcePath = assetStore.resolveLocalFile(image.localPath);
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      throw new Error(`缺少 ${slot} 视图原图，无法执行人物抠图`);
    }
    const rawOutputPath = require("path").join(assetStore.uploadsDir, "body_scan", "cutouts", `${userId}-${slot}-raw.png`);
    const outputPath = require("path").join(assetStore.uploadsDir, "body_scan", "cutouts", `${userId}-${slot}.png`);
    const optionPayload = {
      mimeType: image.mimeType || assetStore.mimeTypeFor(sourcePath),
      fileName: `${slot}${require("path").extname(sourcePath) || ".png"}`,
      crop: true,
      size: "full",
      sourceUrl: image.remoteUrl || ""
    };
    let success = false;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      console.log("[DEBUG-bgrm] slot:start", { userId, slot, attempt, sourcePath });
      try {
        await backgroundRemoval.removeBackground(sourcePath, rawOutputPath, optionPayload);
        imageVariants.trimTransparentImage(rawOutputPath, outputPath);
        console.log("[DEBUG-bgrm] slot:ok", { userId, slot, attempt, rawOutputPath, outputPath });
        success = true;
        break;
      } catch (error) {
        const retryable = isBackgroundRemovalConcurrencyError(error) && attempt < 3;
        console.log("[DEBUG-bgrm] slot:fail", {
          userId,
          slot,
          attempt,
          retryable,
          message: error.message || "unknown background removal error"
        });
        if (!retryable) {
          throw error;
        }
        await delay(attempt * 2500);
      }
    }
    if (!success) {
      throw new Error(`${slot} 视图抠图失败`);
    }
    await delay(1200);
    cutoutPaths.push(outputPath);
  }
  if (!cutoutPaths.every(Boolean)) {
    return [];
  }
  return buildCutoutImagesMetaWithRemote(cutoutPaths, req, {
    userId,
    label: "body-scan-cutout"
  });
}

async function createReferenceCompositeImages(referenceImages = [], userId, req) {
  const compositeSourcePaths = sourcePathsBySlot(referenceImages);
  if (!compositeSourcePaths.every(Boolean)) {
    return null;
  }
  const compositeBasePath = require("path").join(assetStore.uploadsDir, "body_scan", "composites", `${userId}-three-view-reference`);
  return buildBodyScanVariantMetaWithRemote(
    imageVariants.createThreeViewComposites(compositeSourcePaths, compositeBasePath),
    req,
    {
      label: "body-scan-composite-reference",
      portraitName: `${userId}-three-view-reference-1024x1536.jpg`,
      squareName: `${userId}-three-view-reference-1024x1024.jpg`
    }
  );
}

/**
 * 功能：把抠图后的三视图输出为透明预览合图。
 * 参数：referenceImages 三视图透明抠图资源数组，userId 用户 ID，req 请求对象。
 * 返回：包含 portrait 和 square 的透明预览资源。
 * 异常：ffmpeg 失败时抛出异常。
 */
async function createReferenceCompositePreviewImages(referenceImages = [], userId, req) {
  const compositeSourcePaths = sourcePathsBySlot(referenceImages);
  if (!compositeSourcePaths.every(Boolean)) {
    return null;
  }
  const compositeBasePath = require("path").join(assetStore.uploadsDir, "body_scan", "composites", `${userId}-three-view-preview`);
  return buildBodyScanVariantMetaWithRemote(
    imageVariants.createThreeViewTransparentComposites(compositeSourcePaths, compositeBasePath),
    req,
    {
      label: "body-scan-composite-preview",
      portraitName: `${userId}-three-view-preview-1024x1536.png`,
      squareName: `${userId}-three-view-preview-1024x1024.png`
    }
  );
}

function variantToReferenceImage(selected, slot = "composite") {
  if (!selected || !selected.localPath) {
    return null;
  }
  return {
    slot,
    assetId: "",
    localPath: selected.localPath,
    url: selected.url || "",
    previewUrl: selected.previewUrl || selected.url || "",
    mimeType: selected.mimeType || "image/jpeg"
  };
}

function preferredCompositeReferenceImages(profile = {}, size = { width: 1024, height: 1536 }) {
  const preferredKey = size.width === size.height ? "square" : "portrait";
  const referenceComposites = profile.referenceCompositeImages || {};
  const previewComposites = profile.referenceCompositePreviewImages || {};
  const primary = variantToReferenceImage(
    referenceComposites[preferredKey] || referenceComposites.portrait || referenceComposites.square || null,
    "composite"
  );
  const secondary = variantToReferenceImage(
    previewComposites[preferredKey] || previewComposites.portrait || previewComposites.square || null,
    "composite_preview"
  );
  const seen = new Set();
  return [primary, secondary].filter((item) => {
    if (!item) return false;
    const key = item.localPath || item.url || item.previewUrl;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function preferredCompositeReferenceImage(profile = {}, size = { width: 1024, height: 1536 }) {
  return preferredCompositeReferenceImages(profile, size)[0] || null;
}

function toPublicReferenceImage(referenceImage, req) {
  if (!referenceImage) return null;
  if (referenceImage.assetId) {
    const asset = assetStore.getAsset(referenceImage.assetId, req);
    if (asset) {
      return {
        slot: referenceImage.slot || "",
        assetId: asset.id,
        localPath: asset.localPath,
        remoteUrl: asset.remoteUrl || "",
        url: asset.url,
        previewUrl: asset.previewUrl || asset.url,
        mimeType: asset.mimeType || referenceImage.mimeType || ""
      };
    }
  }
  if (referenceImage.localPath) {
    const asset = assetStore.getAssetByLocalPath(referenceImage.localPath, req);
    if (asset) {
      return {
        slot: referenceImage.slot || "",
        assetId: asset.id,
        localPath: asset.localPath,
        remoteUrl: asset.remoteUrl || "",
        url: asset.url,
        previewUrl: asset.previewUrl || asset.url,
        mimeType: asset.mimeType || referenceImage.mimeType || ""
      };
    }
  }
  return {
    slot: referenceImage.slot || "",
    assetId: referenceImage.assetId || "",
    localPath: referenceImage.localPath || "",
    remoteUrl: referenceImage.remoteUrl || "",
    url: referenceImage.url || "",
    previewUrl: referenceImage.previewUrl || referenceImage.url || "",
    mimeType: referenceImage.mimeType || ""
  };
}

function publicReferenceImages(referenceImages = [], req) {
  return (referenceImages || [])
    .map((item) => toPublicReferenceImage(item, req))
    .filter(Boolean);
}

function encodeReferenceImage(referenceImage, req) {
  if (!referenceImage) return "";
  const publicRef = toPublicReferenceImage(referenceImage, req) || referenceImage;
  if (publicRef.localPath) {
    const filePath = assetStore.resolveLocalFile(publicRef.localPath);
    if (filePath && fs.existsSync(filePath)) {
      const mimeType = publicRef.mimeType || assetStore.mimeTypeFor(filePath);
      return `data:${mimeType};base64,${fs.readFileSync(filePath).toString("base64")}`;
    }
  }
  return publicRef.url || publicRef.previewUrl || "";
}

function referenceImageInputs(referenceImages = [], req) {
  return (referenceImages || [])
    .map((item) => encodeReferenceImage(item, req))
    .filter(Boolean)
    .slice(0, 3);
}

function closetReferenceImages(items = [], req) {
  return (items || [])
    .map((item) => {
      if (!item) return null;
      const image = item.publicImageUrl || item.remoteImageUrl || item.sourceImageUrl || item.imageUrl || item.image || item.previewUrl || item.remoteUrl || item.localPath || "";
      if (!image && !item.assetId) return null;
      const referenceImage = {
        slot: item.category || "",
        assetId: item.assetId || "",
        localPath: /^https?:\/\//i.test(image) ? "" : image,
        remoteUrl: item.remoteUrl || "",
        url: /^https?:\/\//i.test(image) ? image : "",
        previewUrl: item.previewUrl || (/^https?:\/\//i.test(image) ? image : ""),
        mimeType: item.mimeType || ""
      };
      const publicReference = toPublicReferenceImage(referenceImage, req);
      if (!publicReference) return null;
      return {
        ...publicReference,
        closetItemId: item.itemId || item.id || "",
        closetItemLabel: item.name || item.subCategoryLabel || item.categoryLabel || ""
      };
    })
    .filter(Boolean);
}

function mergeBodyProfile(profile = {}, patch = {}) {
  return {
    ...profile,
    ...patch,
    referenceImages: patch.referenceImages || profile.referenceImages || [],
    photoSlots: patch.photoSlots || profile.photoSlots || []
  };
}

function persistRuntimeState() {
  userStateStore.saveState({
    activeUserId: state.activeUserId,
    generationUsed: state.generationUsed,
    adUnlocks: state.adUnlocks,
    lastResetDate: state.lastResetDate,
    users: state.users,
    closetItems: state.closetItems
  });
}

function activeUser() {
  return state.users.find((item) => item.id === state.activeUserId) || state.users[0] || mock.user;
}

function activeBodyProfile() {
  return mergeBodyProfile(activeUser().bodyProfile || mock.bodyProfile, {});
}

function activeAura() {
  const currentUser = activeUser();
  const luckyColor = luckyColorForUser(currentUser);
  return {
    ...mock.dailyAura,
    zodiac: currentUser.zodiac || mock.dailyAura.zodiac,
    luckyColor: luckyColor.color,
    luckyColorHex: luckyColor.hex,
    luckyColorPart: luckyColor.part,
    stylingHint: luckyColor.stylingHint,
    luckyColorSource: luckyColor.source
  };
}

function activeWeather() {
  return weatherForUser(activeUser());
}

function sortJobsByUpdatedDesc(jobs) {
  return jobs.sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
}

function sortJobsByCreatedDesc(jobs) {
  return jobs.sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
}

function userSceneImageJobs(userId, scene = "") {
  return imageTaskStore
    .listJobs()
    .filter((item) =>
      item.userId === userId
      && item.scene
      && (!scene || item.scene === scene)
    );
}

function latestActiveImageJob(userId, scene = "") {
  return sortJobsByUpdatedDesc(
    userSceneImageJobs(userId, scene).filter((item) => ACTIVE_IMAGE_JOB_STATUS.includes(item.status))
  )[0] || null;
}

function latestReadyImageJob(userId, scene = "") {
  return sortJobsByCreatedDesc(
    userSceneImageJobs(userId, scene).filter((item) => item.status === "ready" && item.imageUrl)
  )[0] || null;
}

function isRemoteImageUrl(imageUrl = "") {
  return /^https?:\/\//i.test(String(imageUrl || ""));
}

function outfitWithAsset(scene, req, userId = activeUser().id) {
  const currentUser = state.users.find((item) => item.id === userId) || activeUser();
  const base = mock.outfitByScene[scene]
    || mock.outfitByScene[(currentUser.scenes || [])[0]]
    || mock.outfitByScene["上班"];
  const activeJob = latestActiveImageJob(currentUser.id, scene);
  if (activeJob) {
    return {
      ...base,
      scene: activeJob.scene || scene,
      id: activeJob.id,
      title: activeJob.outfitTitle || base.title,
      displayTitle: activeJob.outfitTitle || base.displayTitle || base.title,
      targetUserId: currentUser.id,
      targetUserName: currentUser.nickname,
      expectedImagePath: activeJob.targetPath || activeJob.imageUrl || "",
      imageJob: publicImageJob(activeJob, req)
    };
  }
  const generatedJob = latestReadyImageJob(currentUser.id, scene);
  if (generatedJob) {
    const generatedAsset = versionPublicAsset(
      generatedJob.imageAsset || assetStore.getAssetByLocalPath(generatedJob.imageUrl, req),
      generatedJob.updatedAt
    );
    return {
      ...base,
      scene: generatedJob.scene || scene,
      id: generatedJob.id,
      title: generatedJob.outfitTitle || base.title,
      displayTitle: generatedJob.outfitTitle || base.displayTitle || base.title,
      targetUserId: currentUser.id,
      targetUserName: currentUser.nickname,
      expectedImagePath: generatedJob.targetPath || generatedJob.imageUrl || "",
      tryOnAsset: generatedAsset,
      tryOnImage: imageJobPresenter.publicGeneratedImageUrl(generatedJob, generatedAsset, req),
      imageJob: publicImageJob(generatedJob, req)
    };
  }
  const job = mock.manualImageJobs.find((item) => item.userId === currentUser.id && item.scene === scene);
  if (!job) {
    return {
      ...base,
      targetUserId: currentUser.id,
      targetUserName: currentUser.nickname
    };
  }
  const assetId = require("../data/assets").getOutfitAssetId(job.id);
  const asset = assetId ? assetStore.getAsset(assetId, req) : assetStore.getAssetByLocalPath(job.imagePath, req);
  return {
    ...base,
    scene: job.scene || scene,
    id: job.id,
    title: job.outfitTitle,
    displayTitle: job.outfitTitle,
    targetUserId: currentUser.id,
    targetUserName: currentUser.nickname,
    expectedImagePath: job.imagePath,
    tryOnAsset: asset,
    tryOnImage: asset ? asset.previewUrl : base.tryOnImage
  };
}

function preferredHomeScene(userId = activeUser().id) {
  const currentUser = state.users.find((item) => item.id === userId) || activeUser();
  const fallbackScene = (currentUser.scenes || [])[0] || "上班";
  const latestJob = latestActiveImageJob(currentUser.id) || latestReadyImageJob(currentUser.id);
  return latestJob && latestJob.scene ? latestJob.scene : fallbackScene;
}

function generationPayload(scene, req, userId = activeUser().id, options = {}) {
  const outfit = outfitWithAsset(scene, req, userId);
  const currentUser = state.users.find((item) => item.id === userId) || activeUser();
  const profile = mergeBodyProfile(currentUser.bodyProfile || mock.bodyProfile, {});
  const recommendationSnapshot = recommendationSnapshotFor(currentUser, profile, scene, outfit, options);
  const brief = recommendationSnapshot.outfitBrief;
  const generationId = `${outfit.id}-${Date.now()}`;
  const payload = {
    generationId,
    recommendationId: options.recommendationId || recommendationSnapshot.recommendationId || "",
    status: "success",
    scene,
    stylePreference: options.stylePreference || "",
    sourceMode: options.sourceMode || "wardrobe_first",
    ...outfit,
    recommendationSnapshot,
    outfitBrief: brief,
    usedClosetItems: brief.usedClosetItems,
    usedClosetItemIds: brief.usedClosetItemIds,
    usedClosetItemLabels: brief.usedClosetItemLabels,
    trendFillSlots: brief.trendFillSlots,
    sourceMix: brief.sourceMix,
    styleTags: Array.from(new Set(brief.usedClosetItems.flatMap((item) => item.styleTags || []))),
    closetUsageCopy: brief.closetUsageCopy,
    quota: quota()
  };
  state.generations[generationId] = payload;
  return payload;
}

function outfitBriefFor(user, profile, scene, outfit, options = {}) {
  return recommendationService.buildOutfitBrief({
    user,
    profile,
    scene,
    outfit,
    closetItems: state.closetItems || mock.closet,
    sourceMode: options.sourceMode || "wardrobe_first",
    stylePreference: options.stylePreference || "",
    recommendationId: options.recommendationId || ""
  });
}

function compactTextList(items = []) {
  return (items || [])
    .map((item) => {
      if (!item) return "";
      if (typeof item === "string") return item.trim();
      if (typeof item === "object") {
        if (item.name && item.copy) return `${item.name}：${item.copy}`;
        if (item.text) return String(item.text).trim();
        if (item.copy) return String(item.copy).trim();
        if (item.reason) return String(item.reason).trim();
      }
      return String(item || "").trim();
    })
    .filter((item) => item && item !== "[object Object]")
    .filter(Boolean);
}

function recommendationSnapshotFor(user, profile, scene, outfit = {}, options = {}) {
  const brief = outfitBriefFor(user, profile, scene, outfit || {}, options);
  return recommendationService.buildRecommendationSnapshot({
    user,
    profile,
    scene,
    outfit,
    closetItems: state.closetItems || mock.closet,
    sourceMode: options.sourceMode || brief.sourceMode || "wardrobe_first",
    stylePreference: options.stylePreference || brief.stylePreference || "",
    recommendationId: options.recommendationId || ""
  }, brief);
}

function attachOutfitBrief(outfit, user, profile, scene, options = {}) {
  const recommendationSnapshot = recommendationSnapshotFor(user, profile, scene, outfit || {}, options);
  const brief = recommendationSnapshot.outfitBrief;
  return {
    ...(outfit || {}),
    recommendationSnapshot,
    outfitBrief: brief,
    usedClosetItems: brief.usedClosetItems,
    usedClosetItemIds: brief.usedClosetItemIds,
    usedClosetItemLabels: brief.usedClosetItemLabels,
    trendFillSlots: brief.trendFillSlots,
    sourceMix: brief.sourceMix,
    closetUsageCopy: brief.closetUsageCopy
  };
}

function buildImagePrompt({ user, profile, scene, outfit, weather, luckyColor, recommendationSnapshot, sourceMode = "wardrobe_first", stylePreference = "" }) {
  const favoriteColors = (user.favoriteColors || []).slice(0, 3).join("、") || "无特别偏好";
  const weatherText = `${weather.nightTemp || 0}-${weather.dayTemp || 0}摄氏度，${weather.text || "天气未知"}`;
  const snapshot = recommendationSnapshot || recommendationSnapshotFor(user, profile, scene, outfit);
  const brief = snapshot.outfitBrief;
  const closetText = sourceMode === "free"
    ? "本次用户选择自由搭配，不强制引用用户衣橱；请根据场景、天气、身材策略和审美目标完成现实可穿搭配。"
    : brief.usedClosetItemLabels.length
    ? `本次必须参考并使用用户衣橱里的这些单品：${brief.usedClosetItemLabels.join("、")}。`
    : "用户衣橱暂无可用单品，本次使用趋势库生成参考穿搭。";
  const styleText = stylePreference ? `本次风格偏好是${stylePreference}。` : "";
  return [
    `请生成一张穿搭图，不改变参考图中人物的身高比例和胖瘦、面部特征。`,
    `参考图为同一人物的正面、侧面、背面三视图合成参考图，请严格保持同一人物身份一致。`,
    `人物信息：${user.nickname}，${user.ageRange || "年龄未知"}，${user.city || "城市未知"}，${user.height || 0}cm/${user.weight || 0}kg，体型${profile.bodyType || "未知"}。`,
    `天气情况：${weatherText}。`,
    `请结合用户喜欢颜色${favoriteColors}，以及幸运色${luckyColor || "未提供"}，生成一张${scene}场景下的穿搭图。`,
    styleText,
    `本次穿搭主题是${outfit.displayTitle || outfit.title || "今日推荐穿搭"}。`,
    closetText,
    `Only generate a clean full-body studio fashion try-on photo of the person wearing the outfit.`,
    `This is a plain photography output, not a poster, not a magazine layout, not an infographic, not a UI mockup, and not a recommendation card.`,
    `The image must contain only the person and the outfit. Do not put any text, Chinese characters, English words, title, caption, label, arrow, number, bullet, button, UI element, infographic, annotation, callout line, or styling note inside the image.`,
    `如果参考图里包含衣橱单品图片，请把这些上衣、外套、裤子、鞋包作为真实服装来源，穿到同一位人物身上，不要只作为背景素材。`,
    `要求图片为完整的时尚棚拍全身照片，画面中只有一位人物，使用干净暖白纯色摄影棚背景和柔和自然光。`,
    `不要透明背景，不要 alpha 透明，不要灰白棋盘格，不要透明预览格，不要素材软件预览底，不要截图 UI、水印、边框或网格。`,
    `Outfit reasons are shown by the app UI outside the image. Never render explanation text, styling notes, numbered reasons, or layout copy inside the generated image.`,
    `人物需要自然真实、适合日常分享，服装材质和比例可信，不要出现多人、背景、道具、地面、墙面或额外装饰。`
  ].join(" ");
}

function buildPromptContract({ user, profile, scene, outfit, weather, luckyColor, recommendationSnapshot, referenceImageCount, closetReferenceImageCount, sourceMode = "wardrobe_first", stylePreference = "" }) {
  const preferredReferences = preferredCompositeReferenceImages(profile);
  const snapshot = recommendationSnapshot || recommendationSnapshotFor(user, profile, scene, outfit);
  const brief = snapshot.outfitBrief;
  return {
    ageRange: user.ageRange || "",
    city: user.city || "",
    heightCm: user.height || profile.heightCm || 0,
    weightKg: user.weight || 0,
    bodyType: profile.bodyType || "",
    strategies: profile.strategies || [],
    avoid: profile.avoid || [],
    scene,
    sourceMode,
    stylePreference,
    outfitTitle: outfit.displayTitle || outfit.title || "",
    favoriteColors: user.favoriteColors || [],
    luckyColor: luckyColor || "",
    weatherText: weather && weather.text ? weather.text : "",
    weatherTempRange: weather ? `${weather.nightTemp || 0}-${weather.dayTemp || 0}` : "",
    referenceImageCount: Number.isFinite(referenceImageCount)
      ? referenceImageCount
      : (preferredReferences.length || (profile.referenceImages || []).length),
    closetReferenceImageCount: Number.isFinite(closetReferenceImageCount)
      ? closetReferenceImageCount
      : closetReferenceImages(brief.usedClosetItems, null).length,
    usedClosetItemIds: brief.usedClosetItemIds,
    usedClosetItemLabels: brief.usedClosetItemLabels,
    trendFillSlots: brief.trendFillSlots,
    sourceMix: brief.sourceMix
  };
}

function hasContractValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return Boolean(String(value || "").trim());
}

function validateImagePromptContract(job) {
  const contract = job.promptContract || {};
  const checks = [
    ["ageRange", hasContractValue(contract.ageRange)],
    ["city", hasContractValue(contract.city)],
    ["heightCm", hasContractValue(contract.heightCm)],
    ["weightKg", hasContractValue(contract.weightKg)],
    ["bodyType", hasContractValue(contract.bodyType)],
    ["strategies", hasContractValue(contract.strategies)],
    ["avoid", hasContractValue(contract.avoid)],
    ["scene", hasContractValue(contract.scene)],
    ["outfitTitle", hasContractValue(contract.outfitTitle)],
    ["favoriteColors", hasContractValue(contract.favoriteColors)],
    ["luckyColor", hasContractValue(contract.luckyColor)],
    ["weatherText", hasContractValue(contract.weatherText)],
    ["weatherTempRange", hasContractValue(contract.weatherTempRange)],
    ["referenceImageCount", hasContractValue(contract.referenceImageCount)]
  ];
  const missing = checks.filter((item) => !item[1]).map((item) => item[0]);
  const criticalMissing = missing.filter(k => k === "scene" || k === "outfitTitle");
  
  return {
    valid: criticalMissing.length === 0,
    missing
  };
}

async function recommendationForImageJob(user, profile, scene, outfit, options = {}) {
  return recommendationService.recommendOutfit({
    user,
    profile,
    scene,
    outfit,
    closetItems: state.closetItems || mock.closet,
    weather: weatherForUser(user),
    luckyColor: luckyColorForUser(user).color,
    recommendationId: options.recommendationId || "",
    sourceMode: options.sourceMode || "wardrobe_first",
    stylePreference: options.stylePreference || ""
  }, options.recommendationProviders ? { providers: options.recommendationProviders } : {});
}

async function imageJobPayload(userId, scene, options = {}) {
  const user = state.users.find((item) => item.id === userId) || state.users[0] || mock.user;
  const sourceMode = options.sourceMode || "wardrobe_first";
  const stylePreference = options.stylePreference || "";
  const profile = activeUser().id === user.id ? activeBodyProfile() : mergeBodyProfile(user.bodyProfile || mock.bodyProfile, {});
  const outfit = mock.outfitByScene[scene] || mock.outfitByScene[user.scenes && user.scenes[0]] || mock.outfitByScene["上班"];
  const job = mock.manualImageJobs.find((item) => item.userId === user.id && item.scene === scene);
  const weather = weatherForUser(user);
  const luckyColorInfo = luckyColorForUser(user);
  const luckyColor = luckyColorInfo.color;
  const recommendation = await recommendationForImageJob(user, profile, scene, outfit, {
    recommendationId: options.recommendationId || "",
    sourceMode,
    stylePreference
  });
  const recommendationSnapshot = recommendation.recommendationSnapshot || recommendationSnapshotFor(user, profile, scene, outfit, {
    recommendationId: options.recommendationId || "",
    sourceMode,
    stylePreference
  });
  const brief = recommendationSnapshot.outfitBrief;
  const compositeReferenceImages = preferredCompositeReferenceImages(profile, { width: 1024, height: 1536 });
  const bodyReferenceImages = compositeReferenceImages.length
    ? compositeReferenceImages
    : publicReferenceImages(profile.referenceImages || [], null);
  const closetReferences = closetReferenceImages(brief.usedClosetItems, null);
  const selectedBodyReferences = bodyReferenceImages.slice(0, closetReferences.length ? 1 : 3);
  const selectedClosetReferences = closetReferences.slice(0, Math.max(0, 3 - selectedBodyReferences.length));
  const referenceImages = [
    ...selectedBodyReferences,
    ...selectedClosetReferences
  ];
  const referenceImageInputsList = referenceImageInputs(referenceImages, null);
  const targetPath = `${assetStore.runtimePrefix}/generated/users/${user.id}-${sceneSlug(scene)}.jpg`;
  const prompt = buildImagePrompt({ user, profile, scene, outfit, weather, luckyColor, recommendationSnapshot, sourceMode, stylePreference });
  const promptContract = buildPromptContract({
    user,
    profile,
    scene,
    outfit,
    weather,
    luckyColor,
    recommendationSnapshot,
    referenceImageCount: referenceImageInputsList.length,
    closetReferenceImageCount: closetReferences.length,
    sourceMode,
    stylePreference
  });
  const negativePrompt = [
    "不要改变参考人物五官",
    "不要改变身高比例",
    "不要改变胖瘦",
    "不要多人",
    "不要背景",
    "不要地面和墙面",
    "不要道具",
    "不要截断头部",
    "不要截断脚部",
    "不要畸形手脚",
    "no text",
    "no Chinese characters",
    "no English words",
    "no typography",
    "no captions",
    "no labels",
    "no arrows",
    "no numbers",
    "no bullets",
    "no callout lines",
    "no styling notes",
    "no UI elements",
    "no infographic",
    "no poster layout",
    "no magazine layout",
    "no recommendation card"
  ].join(", ");
  return {
    userId: user.id,
    userName: user.nickname,
    scene,
    sourceMode,
    stylePreference,
    recommendationId: options.recommendationId || "",
    outfitTitle: job ? job.outfitTitle : outfit.displayTitle,
    recommendationSnapshot,
    recommendationProvider: recommendation.provider || "local_recommendation",
    recommendationProviderAttempts: recommendation.providerAttempts || [],
    recommendationConfidence: recommendation.confidence,
    recommendationReasoningSummary: recommendation.reasoningSummary || "",
    outfitBrief: brief,
    usedClosetItemIds: brief.usedClosetItemIds,
    usedClosetItemLabels: brief.usedClosetItemLabels,
    trendFillSlots: brief.trendFillSlots,
    sourceMix: brief.sourceMix,
    targetPath,
    prompt,
    negativePrompt,
    promptContract,
    promptContractStatus: "valid",
    size: { width: 1024, height: 1536 },
    referenceImages,
    providerRequest: {
      model: "gpt-image-2",
      prompt,
      reference_images: referenceImageInputsList,
      input_mode: referenceImageInputsList.length > 1 ? "multi_image" : "",
      quality: "medium",
      response_format: "url",
      size: "1024x1536"
    }
  };
}

async function ensureImageJob(userId, scene, options = {}) {
  const payload = await imageJobPayload(userId, scene, options);
  if (!options.forceNew) {
    const existing = imageTaskStore.listJobs().find((item) => item.id === payload.targetPath.split("/").pop().replace(/\.(png|jpg|jpeg)$/i, "") || item.id === `${userId}-${scene}`);
    if (existing) return existing;
  }
  const manual = mock.manualImageJobs.find((item) => item.userId === userId && item.scene === scene);
  const jobId = options.forceNew || !manual
    ? `img-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    : manual.id;
  return imageTaskStore.createJob({
    ...payload,
    id: jobId,
    recommendationId: options.recommendationId || payload.recommendationId || "",
    targetPath: imageJobPresenter.generatedTargetPathForJob(userId, scene, jobId),
    source: options.forceNew ? "outfit_regenerate" : "outfit_generate"
  });
}

function selectedRecommendationItemsFromBrief(brief = {}) {
  return (brief.usedClosetItems || []).map((item) => ({
    itemId: item.itemId || item.id || "",
    name: item.name || item.subCategoryLabel || item.categoryLabel || "",
    source: item.sourceType || "wardrobe",
    slot: item.categoryLabel || item.category || "",
    why: (item.bodyStrategyLabels || item.styleLabels || []).slice(0, 2).join("、")
  }));
}

function createRecommendationFromPayload(payload = {}, options = {}) {
  const snapshot = payload.recommendationSnapshot || {};
  const brief = snapshot.outfitBrief || payload.outfitBrief || {};
  return recommendationStore.createRecommendation({
    userId: payload.userId || "",
    scene: payload.scene || "",
    stylePreference: payload.stylePreference || options.stylePreference || "",
    sourceMode: payload.sourceMode || options.sourceMode || "wardrobe_first",
    inputSnapshot: {
      weather: payload.weather || null,
      bodyStrategies: (payload.bodyProfile && (payload.bodyProfile.strategyTags || payload.bodyProfile.stylingStrategies)) || [],
      favoriteColors: payload.favoriteColors || [],
      rejectedStyleTags: []
    },
    selectedItems: selectedRecommendationItemsFromBrief(brief),
    selectedItemIds: brief.usedClosetItemIds || payload.usedClosetItemIds || [],
    missingSlots: brief.trendFillSlots || payload.trendFillSlots || [],
    appliedRuleIds: [],
    stylingNotes: snapshot.stylingNotes || [],
    imagePrompt: payload.prompt || payload.renderPrompt || "",
    aiMeta: {
      model: payload.recommendationProvider || "local_recommendation",
      provider: payload.recommendationProvider || "local_recommendation",
      providerAttempts: payload.recommendationProviderAttempts || [],
      confidence: typeof payload.recommendationConfidence === "number" ? payload.recommendationConfidence : 0.72,
      reasoningSummary: payload.recommendationReasoningSummary || brief.closetUsageCopy || payload.closetUsageCopy || ""
    }
  });
}

function publicImageJob(job, req) {
  if (!job) return null;
  let imageAsset = rehydratePublicAsset(job.imageAsset || null, req);
  if (!imageAsset && job.imageUrl) {
    imageAsset = assetStore.getAssetByLocalPath(job.imageUrl, req);
  }
  const cacheVersion = job.updatedAt || job.createdAt || "";
  const versionedAsset = versionPublicAsset(imageAsset, cacheVersion);
  const publicImageUrl = imageJobPresenter.publicGeneratedImageUrl(job, versionedAsset, req);
  const recommendationId = job.recommendationId || (job.recommendationSnapshot && job.recommendationSnapshot.recommendationId) || "";
  if (recommendationId && publicImageUrl && job.status === "ready") {
    recommendationStore.bindImageJob(recommendationId, {
      imageJobId: job.id,
      generatedImageUrl: publicImageUrl
    });
  }
  return {
    id: job.id,
    recommendationId,
    scene: job.scene || "",
    sourceMode: job.sourceMode || "wardrobe_first",
    stylePreference: job.stylePreference || "",
    userId: job.userId || "",
    userName: job.userName || "",
    outfitTitle: job.outfitTitle || "",
    displayRecordTitle: imageJobPresenter.recordTitleFor(job),
    status: job.status,
    imageUrl: publicImageUrl,
    imageAsset: versionedAsset,
    remoteImageUrl: job.remoteImageUrl || "",
    providerImageUrl: job.providerImageUrl || "",
    provider: job.provider || "",
    providerAttempts: job.providerAttempts || [],
    localizeStatus: job.localizeStatus || "",
    localizeError: job.localizeError || "",
    recommendationSnapshot: job.recommendationSnapshot || null,
    outfitBrief: job.outfitBrief || null,
    usedClosetItemIds: job.usedClosetItemIds || [],
    usedClosetItemLabels: job.usedClosetItemLabels || [],
    trendFillSlots: job.trendFillSlots || [],
    sourceMix: job.sourceMix || [],
    errorMessage: job.errorMessage || "",
    createdAt: job.createdAt || "",
    updatedAt: job.updatedAt || ""
  };
}

function summarizeProviderRequest(job) {
  if (!job) return null;
  const providerRequest = job.providerRequest || {};
  const referenceImages = Array.isArray(providerRequest.reference_images)
    ? providerRequest.reference_images
    : Array.isArray(providerRequest.image_urls)
      ? providerRequest.image_urls
      : [];
  return {
    endpoint: moxingImage.getDebugConfig().endpoint,
    hasApiKey: Boolean(process.env.MOXING_API_KEY),
    model: providerRequest.model || "gpt-image-2",
    capability: providerRequest.capability || "",
    input_mode: providerRequest.input_mode || "",
    reference_image_count: referenceImages.filter(Boolean).length,
    size: providerRequest.size || "",
    quality: providerRequest.quality || "",
    response_format: providerRequest.response_format || "",
    prompt_length: String(job.prompt || "").length
  };
}

async function createClosetItemFromPublishedImage(published, file = {}, req, analysisHints = {}) {
  const itemId = `c${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  const analysis = await clothingAnalysis.analyzeClothingImage({
    originalName: file.filename || "",
    imageUrl: published.remoteUrl || published.localUrl,
    localPath: published.localPath,
    mimeType: published.mimeType,
    ...analysisHints
  });
  const item = {
    id: itemId,
    itemId,
    ...analysis,
    usageCount: 0,
    image: published.localUrl,
    localImagePath: published.localPath,
    publicImageUrl: published.remoteUrl || "",
    imageAssetId: published.assetId,
    imageSourceUrl: published.remoteUrl || published.localUrl,
    imageLicense: "user_upload",
    imageConfidence: analysis.analyzer,
    analysisStatus: analysis.analysisStatus || "",
    analysisMessage: analysis.analysisMessage || "",
    analysisTimeoutMs: analysis.analysisTimeoutMs || 0,
    analyzerError: analysis.analyzerError || "",
    rawTags: analysis.rawTags || [],
    rawColors: analysis.rawColors || [],
    imageDownloadStatus: "local_ready",
    fileServerError: published.fileServerError || ""
  };
  state.closetItems = [item, ...(state.closetItems || mock.closet)];
  persistRuntimeState();
  const publicItems = await closetAssets.publicClosetItems([item], req);
  return {
    item: closetDisplay.decorateClosetItem(publicItems[0] || item),
    analysis
  };
}

function closetAnalysisMessage(item = {}) {
  if (item.analysisMessage) return item.analysisMessage;
  const error = item.analyzerError || "";
  if (/InvalidApi\.NotPurchase|not purchased|NotPurchase/i.test(error)) {
    return "阿里云图像识别 API 未开通，已使用本地规则标签";
  }
  if (/timed out|timeout/i.test(error)) {
    return "阿里云图像识别超时，已使用本地规则标签";
  }
  if (item.imageConfidence === "local_keyword_mvp") return "云识别未完成，已使用本地规则标签";
  return "";
}

function withClosetAnalysisStatus(item = {}) {
  const analysisMessage = closetAnalysisMessage(item);
  let analysisStatus = item.analysisStatus || "";
  if (!analysisStatus && item.imageConfidence === "aliyun_imagerecog") analysisStatus = "success";
  if (!analysisStatus && analysisMessage) analysisStatus = "failed";
  return {
    ...item,
    analysisStatus,
    analysisMessage
  };
}

async function createClosetItemsFromSegmentation(segmentation, parentPublished, req) {
  if (!segmentation || segmentation.status !== "success" || !Array.isArray(segmentation.items)) {
    return [];
  }

  const createdItems = [];
  for (let index = 0; index < segmentation.items.length; index += 1) {
    const segment = segmentation.items[index];
    const sourceUrl = segment.imageUrl || segment.maskUrl || "";
    if (!sourceUrl) continue;

    const segmentId = `segmented-closet-${Date.now()}-${index}`;
    const targetPath = `${assetStore.runtimePrefix}/storage/uploads/closet_segmented/${segmentId}.png`;
    const downloaded = await imageDownloader.downloadImageToTarget(sourceUrl, targetPath);
    const published = await publicImageService.publishLocalImage(downloaded.absolutePath, req, {
      id: segmentId,
      type: "closet_item",
      group: "user_closet",
      slot: segment.category || "unknown",
      originalName: `${segment.aliyunClass || segment.category || "cloth"}-${index}.png`,
      source: "closet_person_segmentation",
      meta: {
        parentAssetId: parentPublished.assetId,
        parentImageUrl: parentPublished.remoteUrl || parentPublished.localUrl,
        aliyunClass: segment.aliyunClass || "",
        segmentCategory: segment.category || "",
        segmentMaskUrl: segment.maskUrl || "",
        segmentSourceUrl: sourceUrl
      }
    });
    const created = await createClosetItemFromPublishedImage(published, {
      filename: `${segment.aliyunClass || segment.category || "cloth"}-${index}.png`
    }, req, {
      categoryHint: segment.category || "",
      segmentCategory: segment.category || "",
      aliyunClass: segment.aliyunClass || ""
    });
    createdItems.push({
      ...created,
      segment
    });
  }
  return createdItems;
}

async function submitPendingImageJob(job, req) {
  if (!job || job.status !== "pending") return job;
  if (!process.env.MOXING_API_KEY) {
    const providerConfig = moxingImage.getDebugConfig();
    console.log("[GEN-CONFIG] skip provider submit", providerConfig);
    return job;
  }
  const validation = validateImagePromptContract(job);
  if (!validation.valid) {
    console.log("[GEN-CONFIG] block provider submit due to missing contract:", validation.missing);
    return markPromptContractFailure(job, validation);
  } else if (validation.missing && validation.missing.length) {
    console.log("[GEN-CONFIG] proceeding with missing contract fields:", validation.missing);
  }
  console.log("[GEN-CONFIG] submit provider request", moxingImage.getDebugConfig());
  imageTaskStore.updateJob(job.id, { status: "submitted", promptContractStatus: "valid", promptContractMissing: [], errorMessage: "" });
  const result = await imageGenerationService.submitImage(job);
  const localized = await localizeImageResult(job, result, req);
  return imageTaskStore.updateJob(job.id, {
    status: localized.status,
    provider: result.provider || job.provider || "moxing",
    imageUrl: localized.imageUrl || job.imageUrl || "",
    imageAsset: localized.imageAsset || job.imageAsset || null,
    remoteImageUrl: localized.remoteImageUrl || job.remoteImageUrl || "",
    providerImageUrl: localized.providerImageUrl || job.providerImageUrl || "",
    localImageBytes: localized.localImageBytes || job.localImageBytes || 0,
    localizeStatus: localized.localizeStatus || job.localizeStatus || "",
    localizeError: localized.localizeError || "",
    providerTaskId: result.taskId || "",
    providerAttempts: result.providerAttempts || [],
    providerRequest: result.providerRequest,
    providerResponse: result.providerResponse,
    errorMessage: ""
  });
}

function markPromptContractFailure(job, validation) {
  return imageTaskStore.updateJob(job.id, {
    status: "incomplete",
    promptContractStatus: "invalid",
    promptContractMissing: validation.missing,
    errorMessage: `image prompt contract missing: ${validation.missing.join(", ")}`
  });
}

// 统一打印请求访问日志，便于确认前端点击后是否真的到达后端。
function attachAccessLog(req, res) {
  const startedAt = Date.now();
  res.on("finish", () => {
    const elapsedMs = Date.now() - startedAt;
    console.log(`[HTTP] ${req.method} ${req.url} -> ${res.statusCode} ${elapsedMs}ms`);
  });
}

async function localizeImageResult(job, result, req) {
  const resolvedImageUrl = result.imageUrl
    || moxingImage.extractImageUrl(result.providerResponse)
    || moxingImage.extractImageUrl(job.providerResponse);

  if (!resolvedImageUrl) {
    return {
      status: result.status || "submitted",
      imageUrl: job.imageUrl || "",
      remoteImageUrl: job.remoteImageUrl || "",
      localImageBytes: job.localImageBytes || 0
    };
  }

  if (resolvedImageUrl.startsWith("/") && !resolvedImageUrl.startsWith("//")) {
    const localAsset = assetStore.getAssetByLocalPath(resolvedImageUrl, req) || assetStore.registerUploadedAsset({
      id: `generated-${job.id}`,
      type: "generated_tryon",
      group: "daily_tryon",
      localPath: resolvedImageUrl,
      mimeType: resolvedImageUrl.endsWith(".png") ? "image/png" : "image/jpeg",
      source: "image_job",
      meta: { imageJobId: job.id, userId: job.userId, scene: job.scene }
    }, req);
    return {
      status: "ready",
      imageUrl: localAsset.previewUrl || localAsset.url,
      imageAsset: localAsset,
      remoteImageUrl: job.remoteImageUrl || "",
      localImageBytes: job.localImageBytes || 0
    };
  }

  try {
    const downloaded = await imageDownloader.downloadImageToTarget(resolvedImageUrl, job.targetPath);
    const published = await publicImageService.publishLocalImage(downloaded.absolutePath, req, {
      id: `generated-${job.id}`,
      type: "generated_tryon",
      group: "daily_tryon",
      originalName: path.basename(downloaded.absolutePath),
      source: "image_job",
      meta: {
        imageJobId: job.id,
        userId: job.userId,
        scene: job.scene,
        providerImageUrl: resolvedImageUrl
      }
    });
    return {
      status: "ready",
      imageUrl: published.previewUrl || published.url,
      imageAsset: published.asset,
      remoteImageUrl: published.remoteUrl || resolvedImageUrl,
      providerImageUrl: resolvedImageUrl,
      localImageBytes: downloaded.bytes,
      localizeStatus: published.remoteUrl ? "file_server_ready" : "local_ready",
      localizeError: published.fileServerError || ""
    };
  } catch (error) {
    if (!isRemoteImageUrl(resolvedImageUrl)) {
      throw error;
    }
    console.log("[IMAGE-LOCALIZE] fallback to remote image", {
      jobId: job.id,
      remoteImageUrl: resolvedImageUrl,
      errorMessage: error.message || "image localize failed"
    });
    return {
      status: "ready",
      imageUrl: resolvedImageUrl,
      imageAsset: null,
      remoteImageUrl: resolvedImageUrl,
      localImageBytes: job.localImageBytes || 0,
      localizeStatus: "remote_fallback",
      localizeError: error.message || "image localize failed"
    };
  }
}

function extractRemoteImageUrlFromJob(job) {
  if (!job) return "";
  if (isRemoteImageUrl(job.remoteImageUrl)) return job.remoteImageUrl;
  if (isRemoteImageUrl(job.imageUrl)) return job.imageUrl;
  return moxingImage.extractImageUrl(job.providerResponse);
}

function shouldRecoverRemoteOnlyJob(job) {
  if (!job) return false;
  if (job.status === "ready" && job.imageUrl) return false;
  const errorMessage = String(job.errorMessage || "");
  return (
    ["failed", "incomplete"].includes(job.status)
    || errorMessage.includes("transparent PNG is too large")
    || errorMessage.includes("image download failed")
  );
}

async function recoverRemoteImageJobs(req, options = {}) {
  const pollProvider = Boolean(options.pollProvider);
  const jobs = imageTaskStore.listJobs();
  const results = [];
  for (const job of jobs) {
    const directRemoteUrl = extractRemoteImageUrlFromJob(job);
    if (directRemoteUrl && shouldRecoverRemoteOnlyJob(job)) {
      const recovered = imageTaskStore.updateJob(job.id, {
        status: "ready",
        imageUrl: directRemoteUrl,
        remoteImageUrl: directRemoteUrl,
        imageAsset: null,
        localizeStatus: "remote_recovered",
        localizeError: job.errorMessage || "",
        errorMessage: ""
      });
      results.push(publicImageJob(recovered, req));
      continue;
    }

    const taskId = job.providerTaskId || job.providerResponse?.task_id || job.providerResponse?.id || "";
    if (!pollProvider || !taskId || job.status === "ready") {
      continue;
    }

    try {
      const result = await moxingImage.pollImage(taskId);
      const localized = await localizeImageResult(job, result, req);
      let updated = imageTaskStore.updateJob(job.id, {
        status: localized.status,
        imageUrl: localized.imageUrl || job.imageUrl || "",
        imageAsset: localized.imageAsset || job.imageAsset || null,
        remoteImageUrl: localized.remoteImageUrl || job.remoteImageUrl || "",
        providerImageUrl: localized.providerImageUrl || job.providerImageUrl || "",
        localImageBytes: localized.localImageBytes || job.localImageBytes || 0,
        localizeStatus: localized.localizeStatus || job.localizeStatus || "",
        localizeError: localized.localizeError || "",
        providerPollUrl: result.pollUrl || job.providerPollUrl,
        providerResponse: result.providerResponse || job.providerResponse,
        errorMessage: localized.status === "ready" ? "" : (job.errorMessage || "")
      });
      if (updated && updated.status === "ready") {
        updated = consumeGenerationQuotaOnce(updated);
      }
      results.push(publicImageJob(updated, req));
    } catch (error) {
      const updated = imageTaskStore.updateJob(job.id, {
        localizeError: error.message || "remote image recovery failed",
        providerResponse: error.providerResponse || job.providerResponse
      });
      results.push(publicImageJob(updated, req));
    }
  }
  return results;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:8787");
  attachAccessLog(req, res);

  if (req.method === "OPTIONS") {
    sendJson(res, 200, ok({}));
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/assets/local/")) {
    const localPath = decodeURIComponent(url.pathname.replace("/assets/local", ""));
    const filePath = assetStore.resolveLocalFile(localPath);
    if (!filePath || !require("fs").existsSync(filePath)) {
      sendJson(res, 404, { code: 404, message: "Asset not found" });
      return;
    }
    res.writeHead(200, {
      "Content-Type": assetStore.mimeTypeFor(filePath),
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300"
    });
    require("fs").createReadStream(filePath).pipe(res);
    return;
  }

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/api/health")) {
    sendJson(res, 200, ok({
      service: "guimi-mock-api",
      status: "ok",
      imageProvider: "moxing",
      backgroundRemovalProvider: backgroundRemoval.getDebugConfig().provider,
      imageModel: "gpt-image-2",
      hasMoxingApiKey: Boolean(process.env.MOXING_API_KEY),
      hasAliyunAccessKeyId: Boolean(process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID),
      hasAliyunAccessKeySecret: Boolean(process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET),
      hasFileServerUploadUrl: Boolean(fileServerUploader.getFileServerConfig().uploadUrl),
      hasFileServerUserName: Boolean(fileServerUploader.getFileServerConfig().userName),
      hasFileServerUserKey: Boolean(fileServerUploader.getFileServerConfig().userKey),
      hasAliyunOss: aliyunOssUploader.isAliyunOssConfigured(),
      aliyunOssBucket: aliyunOssUploader.getAliyunOssConfig().bucket,
      aliyunOssRegion: aliyunOssUploader.getAliyunOssConfig().region,
      hasWaveSpeedApiKey: Boolean(process.env.WAVESPEED_API_KEY),
      hasPhotoRoomApiKey: Boolean(process.env.PHOTOROOM_API_KEY),
      endpoints: [
        "GET /api/home",
        "GET /api/assets",
        "GET /api/closet",
        "GET /api/recommendations",
        "GET /api/debug/mvp-readiness",
        "GET /api/test-users",
        "POST /api/assets/upload",
        "POST /api/closet/items/upload",
        "POST /api/closet/person-image/upload",
        "POST /api/test-users/active",
        "POST /api/generation/ad-unlock",
        "POST /api/subscription/plus",
        "GET /api/image-jobs",
        "POST /api/image-jobs/seed-test-users",
        "POST /api/image-jobs/:id/submit",
        "POST /api/image-jobs/run-pending"
      ]
    }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/assets") {
    sendJson(res, 200, ok({
      items: assetStore.listAssets({
        group: url.searchParams.get("group") || "",
        type: url.searchParams.get("type") || "",
        slot: url.searchParams.get("slot") || ""
      }, req)
    }));
    return;
  }

  if (req.method === "GET" && url.pathname.match(/^\/api\/assets\/[^/]+$/)) {
    const id = decodeURIComponent(url.pathname.split("/")[3]);
    const asset = assetStore.getAsset(id, req);
    sendJson(res, asset ? 200 : 404, asset ? ok(asset) : fail("asset not found"));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/assets/register") {
    const body = await readBody(req);
    if (!body.localPath && !body.remoteUrl) {
      sendJson(res, 200, fail("localPath or remoteUrl is required"));
      return;
    }
    const asset = assetStore.registerUploadedAsset({
      id: body.id,
      type: body.type || "external",
      group: body.group || "external_assets",
      slot: body.slot || "",
      localPath: body.localPath || body.remoteUrl,
      remoteUrl: body.remoteUrl || "",
      previewRemoteUrl: body.previewRemoteUrl || "",
      mimeType: body.mimeType || "image/jpeg",
      source: body.source || "manual",
      originalName: body.originalName || "",
      meta: body.meta || {}
    }, req);
    sendJson(res, 200, ok(asset));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/assets/upload") {
    const raw = await readRawBody(req);
    const parsed = parseMultipart(raw, req.headers["content-type"] || "");
    const file = parsed.files[0];
    if (!file || !file.buffer.length) {
      sendJson(res, 200, fail("upload file is required"));
      return;
    }
    const type = parsed.fields.type || parsed.fields.kind || "user_upload";
    const group = parsed.fields.group || (type === "body_scan" ? "body_scan_uploads" : "user_uploads");
    const slot = parsed.fields.slot || "";
    const ext = require("path").extname(file.filename || "") || (file.contentType === "image/png" ? ".png" : ".jpg");
    const safeId = `upload-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const uploadDir = require("path").join(assetStore.uploadsDir, type);
    require("fs").mkdirSync(uploadDir, { recursive: true });
    const filePath = require("path").join(uploadDir, `${safeId}${ext}`);
    require("fs").writeFileSync(filePath, file.buffer);
    const published = await publicImageService.publishLocalImage(filePath, req, {
      id: safeId,
      type,
      group,
      slot,
      originalName: file.filename || `${safeId}${ext}`,
      source: "upload",
      meta: { size: file.buffer.length }
    });
    if (published.fileServerError) {
      console.log("[FILE-SERVER-UPLOAD] failed", {
        type,
        slot,
        safeId,
        message: published.fileServerError
      });
    }
    if (type === "body_scan" && !published.remoteUrl) {
      sendJson(res, 200, fail(`三视图上传失败，未能生成公网地址: ${published.fileServerError || "文件服务器未配置"}`));
      return;
    }
    let bodyScanVariants = {};
    let bodyScanVariantError = "";
    if (type === "body_scan") {
      try {
        const variantBasePath = require("path").join(uploadDir, "variants", safeId);
        bodyScanVariants = buildBodyScanVariantMeta(
          imageVariants.createBodyScanVariants(filePath, variantBasePath),
          req
        );
      } catch (error) {
        console.log("[BODY-SCAN-VARIANTS] create failed", {
          slot,
          safeId,
          message: error.message || "unknown variant error"
        });
        bodyScanVariantError = error.message || "body scan variants create failed";
      }
    }
    const asset = {
      ...published.asset,
      referenceUrl: published.remoteUrl || published.localUrl,
      meta: {
        ...(published.asset.meta || {}),
        fitted: bodyScanVariants,
        fittedError: bodyScanVariantError
      }
    };
    if (type === "body_scan" && slot) {
      const currentUser = activeUser();
      const currentProfile = mergeBodyProfile(currentUser.bodyProfile || mock.bodyProfile, {});
      const nextReferenceImages = mergeReferenceImagesBySlot(currentProfile.referenceImages || [], {
        slot,
        assetId: asset.id,
        localPath: asset.localPath,
        remoteUrl: asset.remoteUrl || "",
        url: asset.url,
        previewUrl: asset.previewUrl,
        mimeType: asset.mimeType || ""
      });
      currentUser.bodyProfile = mergeBodyProfile(currentProfile, {
        status: currentProfile.status || "uploading",
        referenceImages: nextReferenceImages,
        photoSlots: nextReferenceImages.map((item) => item.slot),
        referenceCutoutImages: [],
        referenceCompositePreviewImages: null,
        referenceCompositeImages: null,
        compositeError: ""
      });
      persistRuntimeState();
      sendJson(res, 200, ok({
        ...asset,
        processing: {
          fitted: bodyScanVariants,
          fittedError: bodyScanVariantError
        }
      }));
      return;
    }
    sendJson(res, 200, ok(asset));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/home") {
    const currentUser = activeUser();
    await recoverRemoteImageJobs(req, { pollProvider: true });
    const scene = preferredHomeScene(currentUser.id);
    const bodyProfile = activeBodyProfile();
    sendJson(res, 200, ok({
      user: currentUser,
      weather: activeWeather(),
      dailyAura: activeAura(),
      bodyProfile,
      dailyOutfit: attachOutfitBrief(outfitWithAsset(scene, req, currentUser.id), currentUser, bodyProfile, scene),
      closetCount: (state.closetItems || mock.closet).length,
      trends: mock.trendItems,
      sceneOptions: mock.sceneOptions,
      quota: quota()
    }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/outfits/daily") {
    const body = await readBody(req);
    const currentUser = activeUser();
    const scene = body.scene || (currentUser.scenes || [])[0] || "上班";
    const targetUser = state.users.find((item) => item.id === (body.userId || currentUser.id)) || currentUser;
    const bodyProfile = mergeBodyProfile(targetUser.bodyProfile || mock.bodyProfile, {});
    sendJson(res, 200, ok({
      weather: { ...activeWeather(), city: body.city || activeWeather().city },
      dailyAura: activeAura(),
      luckyColor: activeAura().luckyColor,
      favoriteColors: currentUser.favoriteColors,
      outfit: attachOutfitBrief(outfitWithAsset(scene, req, targetUser.id), targetUser, bodyProfile, scene),
      trendItems: mock.trendItems,
      quota: quota()
    }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/outfits/generate") {
    const body = await readBody(req);
    const currentUser = activeUser();
    const currentQuota = quota();
    if (currentQuota.remaining <= 0) {
      sendJson(res, 200, fail("今天的生成次数已经用完了，明天再来，或升级会员获得 10 次生成。"));
      return;
    }
    const targetUserId = body.userId || currentUser.id;
    const scene = body.scene || (currentUser.scenes || [])[0] || "上班";
    const sourceMode = body.sourceMode === "free" ? "free" : "wardrobe_first";
    const stylePreference = String(body.stylePreference || "").trim();
    const generationOptions = { sourceMode, stylePreference };
    const recommendationDraft = await imageJobPayload(targetUserId, scene, generationOptions);
    const recommendation = createRecommendationFromPayload(recommendationDraft, generationOptions);
    const generationOptionsWithRecommendation = {
      ...generationOptions,
      recommendationId: recommendation.id
    };
    const payload = generationPayload(scene, req, targetUserId, generationOptionsWithRecommendation);
    let job = await ensureImageJob(targetUserId, scene, { forceNew: Boolean(body.forceNew), ...generationOptionsWithRecommendation });
    
    // DEBUG: Force log the prompt and reference images before submission
    console.log("[DEBUG-FORCE] Preparing to submit job. Prompt:", job.prompt);
    console.log("[DEBUG-FORCE] Reference Images Count:", (job.referenceImages || []).length);
    console.log("[DEBUG-FORCE] Provider Request Mode:", job.providerRequest?.mode || job.providerRequest?.input_mode);

    try {
      job = await submitPendingImageJob(job, req);
    } catch (error) {
      job = imageTaskStore.updateJob(job.id, {
        status: "failed",
        errorMessage: error.message || "image generation submit failed",
        providerAttempts: error.attempts || job.providerAttempts || [],
        providerRequest: error.providerRequest || job.providerRequest,
        providerResponse: error.providerResponse || null
      });
    }
    const publicJob = publicImageJob(job, req);
    if (publicJob) {
      recommendationStore.bindImageJob(recommendation.id, {
        imageJobId: publicJob.id,
        generatedImageUrl: publicJob.imageUrl || ""
      });
    }
    if (job && job.status === "ready") {
      job = consumeGenerationQuotaOnce(job);
    }
    if (publicJob && publicJob.imageUrl) {
      payload.tryOnImage = publicJob.imageUrl;
      payload.tryOnAsset = publicJob.imageAsset || payload.tryOnAsset;
    } else if (publicJob && ACTIVE_IMAGE_JOB_STATUS.includes(publicJob.status)) {
      payload.tryOnImage = "";
      payload.tryOnAsset = null;
    }
    payload.debugProviderRequest = summarizeProviderRequest(job);
    console.log("[GEN] /api/outfits/generate", {
      scene,
      targetUserId,
      jobId: publicJob ? publicJob.id : "",
      imageJobStatus: publicJob ? publicJob.status : "",
      hasMoxingApiKey: Boolean(process.env.MOXING_API_KEY),
      providerEndpoint: moxingImage.getDebugConfig().endpoint,
      providerRequest: payload.debugProviderRequest,
      errorMessage: publicJob ? publicJob.errorMessage : ""
    });
    payload.imageJob = publicJob;
    payload.recommendationId = recommendation.id;
    payload.quota = quota();
    sendJson(res, 200, ok(payload));
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/outfits/")) {
    const id = decodeURIComponent(url.pathname.replace("/api/outfits/", ""));
    sendJson(res, 200, ok(state.generations[id] || generationPayload("上班", req, activeUser().id)));
    return;
  }

  if (req.method === "POST" && url.pathname.endsWith("/rating")) {
    const body = await readBody(req);
    const generation = state.generations[body.generationId] || null;
    const ratedJob = imageTaskStore.listJobs().find((item) => item.id === body.generationId);
    const recommendationId = body.recommendationId
      || (generation && (generation.recommendationId || (generation.recommendationSnapshot && generation.recommendationSnapshot.recommendationId)))
      || (ratedJob && ratedJob.recommendationId)
      || "";
    const rating = {
      id: `rating-${Date.now()}`,
      generationId: body.generationId || "",
      recommendationId,
      scores: body.scores || {},
      styleTags: body.styleTags || (generation && generation.styleTags) || [],
      createdAt: new Date().toISOString()
    };
    state.ratings.push(rating);
    if (recommendationId) {
      recommendationStore.saveFeedback(recommendationId, {
        rating: Number((rating.scores || {}).fashion || 0) >= 4 ? "like" : "dislike",
        scores: rating.scores,
        styleTags: rating.styleTags
      });
    }
    const currentUser = activeUser();
    Object.assign(currentUser, lightCloset.updatePreferenceFromRating(currentUser, rating));
    persistRuntimeState();
    sendJson(res, 200, ok({
      saved: true,
      rating,
      fashionProfileUpdate: {
        rejectedStyleTags: currentUser.rejectedStyleTags || []
      }
    }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/generation/quota") {
    sendJson(res, 200, ok(quota()));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/generation/ad-unlock") {
    const currentUser = activeUser();
    if (currentUser.membership === "paid") {
      sendJson(res, 200, ok({ quota: quota(), unlocked: false, reason: "paid_user" }));
      return;
    }
    if (state.adUnlocks >= 3) {
      sendJson(res, 200, fail("今天看广告解锁次数也用完了，可以明天再来或开通米粒 Plus。"));
      return;
    }
    state.adUnlocks += 1;
    persistRuntimeState();
    sendJson(res, 200, ok({
      unlocked: true,
      quota: quota(),
      message: "已解锁 1 张试穿图"
    }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/subscription/plus") {
    activeUser().membership = "paid";
    state.adUnlocks = 0;
    persistRuntimeState();
    sendJson(res, 200, ok({
      subscribed: true,
      quota: quota(),
      membership: "paid"
    }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/body-scan/analyze") {
    const body = await readBody(req);
    const photos = body.photos || {};
    const profile = body.profile || {};
    const referenceImages = pickReferenceSlots(photos, body.photoAssets || {});
    const currentUser = activeUser();
    let compositeError = "";
    currentUser.ageRange = profile.ageRange || currentUser.ageRange;
    currentUser.zodiac = profile.zodiac || currentUser.zodiac;
    currentUser.city = profile.city || currentUser.city;
    currentUser.height = Number(profile.height || currentUser.height || 0);
    currentUser.weight = Number(profile.weight || currentUser.weight || 0);
    if (Array.isArray(profile.scenes) && profile.scenes.length) {
      currentUser.scenes = profile.scenes;
    }
    currentUser.bodyProfile = mergeBodyProfile(currentUser.bodyProfile || mock.bodyProfile, {
      status: "ready",
      heightCm: currentUser.height || activeBodyProfile().heightCm || 0,
      referenceImages,
      photoSlots: referenceImages.map((item) => item.slot),
      referenceCutoutImages: [],
      referenceCompositePreviewImages: null,
      referenceCompositeImages: null,
      compositeError: ""
    });
    try {
      currentUser.bodyProfile.referenceCutoutImages = await createReferenceCutoutImages(referenceImages, currentUser.id, req);
      currentUser.bodyProfile.referenceCompositePreviewImages = await createReferenceCompositePreviewImages(
        currentUser.bodyProfile.referenceCutoutImages,
        currentUser.id,
        req
      );
      currentUser.bodyProfile.referenceCompositeImages = await createReferenceCompositeImages(
        currentUser.bodyProfile.referenceCutoutImages,
        currentUser.id,
        req
      );
    } catch (error) {
      compositeError = error.message || "body scan composite create failed";
      currentUser.bodyProfile.compositeError = compositeError;
      console.log("[BODY-SCAN-COMPOSITE] create failed", {
        userId: currentUser.id,
        backgroundRemoval: backgroundRemoval.getDebugConfig(),
        message: compositeError
      });
    }
    persistRuntimeState();
    sendJson(res, 200, ok({
      ...activeBodyProfile(),
      confidence: 0.82,
      confidencePercent: 82,
      referenceCutoutImages: currentUser.bodyProfile.referenceCutoutImages || [],
      referenceCompositePreviewImages: currentUser.bodyProfile.referenceCompositePreviewImages || null,
      referenceCompositeImages: currentUser.bodyProfile.referenceCompositeImages || null,
      compositeError,
      nextStep: "档案已建立，可以去首页选择场景生成今日试穿图。"
    }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/outfit/evaluate") {
    const body = await readBody(req);
    sendJson(res, 200, ok({
      ...mock.evaluation,
      image: body.image || "",
      savedToCloset: true
    }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/closet") {
    const closetItems = await closetAssets.publicClosetItems(
      (state.closetItems || mock.closet).map(withClosetAnalysisStatus),
      req
    );
    const displayItems = closetItems.map(closetDisplay.decorateClosetItem);
    sendJson(res, 200, ok({
      items: displayItems,
      gaps: [
        "缺少一件轻薄防风短外套，适合出游和早晚温差。",
        "缺少米灰色高腰半裙，约会场景可以更柔和。",
        "银色小配饰较少，聚会场景缺少轻亮点。"
      ],
      stats: {
        total: (state.closetItems || mock.closet).length,
        colors: ["奶油白", "鼠尾草绿", "深靛蓝", "黑色"],
        readiness: 68
      }
    }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/closet/items/upload") {
    const raw = await readRawBody(req);
    const parsed = parseMultipart(raw, req.headers["content-type"] || "");
    const file = parsed.files[0];
    if (!file || !file.buffer.length) {
      sendJson(res, 200, fail("upload file is required"));
      return;
    }
    const ext = path.extname(file.filename || "") || (file.contentType === "image/png" ? ".png" : ".jpg");
    const itemId = `c${Date.now()}`;
    const uploadDir = path.join(assetStore.uploadsDir, "closet");
    fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, `${itemId}${ext}`);
    fs.writeFileSync(filePath, file.buffer);
    const published = await publicImageService.publishLocalImage(filePath, req, {
      id: `closet-${itemId}`,
      type: "closet_item",
      group: "user_closet",
      originalName: file.filename || `${itemId}${ext}`,
      source: "closet_upload",
      meta: {
        closetItemId: itemId,
        size: file.buffer.length
      }
    });
    const created = await createClosetItemFromPublishedImage(published, file, req);
    sendJson(res, 200, ok({
      item: created.item,
      analysis: created.analysis,
      asset: published.asset,
      uploadStatus: closetUploadPresenter.presentClosetUpload({ published, created })
    }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/closet/person-image/upload") {
    const raw = await readRawBody(req);
    const parsed = parseMultipart(raw, req.headers["content-type"] || "");
    const file = parsed.files[0];
    if (!file || !file.buffer.length) {
      sendJson(res, 200, fail("upload file is required"));
      return;
    }
    const ext = path.extname(file.filename || "") || (file.contentType === "image/png" ? ".png" : ".jpg");
    const uploadId = `person-closet-${Date.now()}`;
    const uploadDir = path.join(assetStore.uploadsDir, "closet_person");
    fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, `${uploadId}${ext}`);
    fs.writeFileSync(filePath, file.buffer);
    const published = await publicImageService.publishLocalImage(filePath, req, {
      id: uploadId,
      type: "closet_person_image",
      group: "user_closet",
      originalName: file.filename || `${uploadId}${ext}`,
      source: "closet_person_upload",
      meta: { size: file.buffer.length }
    });
    const segmentation = await clothingSegmentation.segmentClothingFromPersonImage({
      imageUrl: published.remoteUrl || published.localUrl,
      localPath: published.localPath,
      mimeType: published.mimeType
    });
    const createdItems = await createClosetItemsFromSegmentation(segmentation, published, req);
    sendJson(res, 200, ok({
      status: segmentation.status,
      segmentation,
      createdItems,
      asset: published.asset,
      uploadStatus: {
        remoteReady: Boolean(published.remoteUrl),
        publicImageUrl: published.remoteUrl || published.localUrl || "",
        remoteProvider: published.remoteProvider || "",
        fileServerError: published.fileServerError || "",
        aliyunOssError: published.aliyunOssError || "",
        createdItemCount: createdItems.length,
        blockers: [
          ...(!published.remoteUrl ? ["public_image_url_missing"] : []),
          ...(segmentation.status !== "success" ? ["clothing_segmentation_not_ready"] : []),
          ...(!createdItems.length ? ["no_closet_items_created"] : [])
        ]
      }
    }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/closet/items") {
    const body = await readBody(req);
    sendJson(res, 200, ok({
      id: `c${Date.now()}`,
      name: body.name || "新衣物",
      category: body.category || "unknown",
      color: body.color || "待识别",
      tags: body.tags || ["待整理"]
    }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/products/similar") {
    sendJson(res, 200, ok({ items: mock.similarProducts }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/test-users") {
    sendJson(res, 200, ok({
      activeUserId: state.activeUserId,
      users: state.users,
      imageJobs: mock.manualImageJobs
    }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/test-users/active") {
    const body = await readBody(req);
    const exists = state.users.some((item) => item.id === body.userId);
    if (!exists) {
      sendJson(res, 200, fail("测试用户不存在"));
      return;
    }
    state.activeUserId = body.userId;
    state.generationUsed = 0;
    state.adUnlocks = 0;
    persistRuntimeState();
    sendJson(res, 200, ok({
      activeUserId: state.activeUserId,
      user: activeUser(),
      bodyProfile: activeBodyProfile(),
      quota: quota()
    }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/image-jobs/recover-remote") {
    const body = await readBody(req);
    const items = await recoverRemoteImageJobs(req, { pollProvider: body.pollProvider !== false });
    sendJson(res, 200, ok({ items }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/image-jobs") {
    await recoverRemoteImageJobs(req, { pollProvider: url.searchParams.get("pollProvider") !== "false" });
    sendJson(res, 200, ok({
      items: imageTaskStore
        .listJobs({ status: url.searchParams.get("status") || "" })
        .map((job) => publicImageJob(job, req))
    }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/recommendations") {
    sendJson(res, 200, ok({
      items: recommendationStore.listRecommendations({
        userId: url.searchParams.get("userId") || "",
        scene: url.searchParams.get("scene") || ""
      }).slice(0, Number(url.searchParams.get("pageSize") || 20))
    }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/debug/mvp-readiness") {
    const pollProvider = url.searchParams.get("pollProvider") !== "false";
    await recoverRemoteImageJobs(req, { pollProvider });
    const rawJobs = imageTaskStore.listJobs();
    const publicJobs = rawJobs.map((job) => publicImageJob(job, req));
    const closetItems = (state.closetItems || mock.closet).map(withClosetAnalysisStatus);
    sendJson(res, 200, ok(mvpDebugService.buildMvpReadinessReport({
      imageJobs: rawJobs,
      publicImageJobs: publicJobs,
      recommendations: recommendationStore.listRecommendations({}),
      closetItems
    })));
    return;
  }

  if (req.method === "GET" && url.pathname.match(/^\/api\/image-jobs\/[^/]+$/)) {
    const id = decodeURIComponent(url.pathname.split("/")[3]);
    const job = imageTaskStore.listJobs().find((item) => item.id === id);
    sendJson(res, job ? 200 : 404, job ? ok(publicImageJob(job, req)) : fail("图片任务不存在"));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/image-jobs") {
    const body = await readBody(req);
    const scene = body.scene || "上班";
    const job = imageTaskStore.createJob({
      ...(await imageJobPayload(body.userId || "user-a", scene)),
      source: body.source || "api"
    });
    sendJson(res, 200, ok(publicImageJob(job, req)));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/image-jobs/seed-test-users") {
    const created = await Promise.all(mock.manualImageJobs.map(async (item) =>
      imageTaskStore.createJob({
        ...(await imageJobPayload(item.userId, item.scene)),
        id: item.id,
        source: "seed"
      })
    ));
    sendJson(res, 200, ok({ items: created }));
    return;
  }

  if (req.method === "POST" && url.pathname.match(/^\/api\/image-jobs\/[^/]+\/complete$/)) {
    const body = await readBody(req);
    const id = decodeURIComponent(url.pathname.split("/")[3]);
    const patch = {
      status: "ready",
      imageUrl: body.imageUrl || body.localPath || "",
      errorMessage: ""
    };
    if (body.targetPath) {
      patch.targetPath = body.targetPath;
    }
    let job = imageTaskStore.updateJob(id, patch);
    if (job) {
      job = consumeGenerationQuotaOnce(job);
    }
    sendJson(res, job ? 200 : 404, job ? ok(publicImageJob(job, req)) : fail("图片任务不存在"));
    return;
  }

  if (req.method === "POST" && url.pathname.match(/^\/api\/image-jobs\/[^/]+\/submit$/)) {
    const id = decodeURIComponent(url.pathname.split("/")[3]);
    const job = imageTaskStore.listJobs().find((item) => item.id === id);
    if (!job) {
      sendJson(res, 404, fail("图片任务不存在"));
      return;
    }
    const validation = validateImagePromptContract(job);
    if (!validation.valid) {
      const incomplete = markPromptContractFailure(job, validation);
      sendJson(res, 200, fail(incomplete.errorMessage));
      return;
    }
    try {
      imageTaskStore.updateJob(id, { status: "submitted", promptContractStatus: "valid", promptContractMissing: [], errorMessage: "" });
      const result = await imageGenerationService.submitImage(job);
      const localized = await localizeImageResult(job, result, req);
      let updated = imageTaskStore.updateJob(id, {
        status: localized.status,
        provider: result.provider || job.provider || "moxing",
        imageUrl: localized.imageUrl,
        imageAsset: localized.imageAsset || null,
        remoteImageUrl: localized.remoteImageUrl,
        providerImageUrl: localized.providerImageUrl || "",
        localImageBytes: localized.localImageBytes,
        providerTaskId: result.taskId || "",
        providerAttempts: result.providerAttempts || [],
        providerRequest: result.providerRequest,
        providerResponse: result.providerResponse,
        errorMessage: ""
      });
      if (updated && updated.status === "ready") {
        updated = consumeGenerationQuotaOnce(updated);
      }
      sendJson(res, 200, ok(publicImageJob(updated, req)));
    } catch (error) {
      const failed = imageTaskStore.updateJob(id, {
        status: "failed",
        errorMessage: error.message || "moxing image generation failed",
        providerAttempts: error.attempts || job.providerAttempts || [],
        providerRequest: error.providerRequest || job.providerRequest,
        providerResponse: error.providerResponse || null
      });
      sendJson(res, 200, fail(failed.errorMessage));
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/image-jobs/run-pending") {
    const pending = imageTaskStore.listJobs({ status: "pending" });
    const results = [];
    for (const job of pending) {
      const validation = validateImagePromptContract(job);
      if (!validation.valid) {
        results.push(markPromptContractFailure(job, validation));
        continue;
      }
      try {
        imageTaskStore.updateJob(job.id, { status: "submitted", promptContractStatus: "valid", promptContractMissing: [], errorMessage: "" });
        const result = await imageGenerationService.submitImage(job);
        const localized = await localizeImageResult(job, result, req);
        let updated = imageTaskStore.updateJob(job.id, {
          status: localized.status,
          provider: result.provider || job.provider || "moxing",
          imageUrl: localized.imageUrl,
          imageAsset: localized.imageAsset || null,
          remoteImageUrl: localized.remoteImageUrl,
          providerImageUrl: localized.providerImageUrl || "",
          localImageBytes: localized.localImageBytes,
          localizeStatus: localized.localizeStatus || "",
          localizeError: localized.localizeError || "",
          providerTaskId: result.taskId || "",
          providerAttempts: result.providerAttempts || [],
          providerRequest: result.providerRequest,
          providerResponse: result.providerResponse,
          errorMessage: ""
        });
        if (updated && updated.status === "ready") {
          updated = consumeGenerationQuotaOnce(updated);
        }
        results.push(updated);
      } catch (error) {
        results.push(imageTaskStore.updateJob(job.id, {
          status: "failed",
          errorMessage: error.message || "moxing image generation failed",
          providerAttempts: error.attempts || job.providerAttempts || [],
          providerRequest: error.providerRequest || job.providerRequest,
          providerResponse: error.providerResponse || null
        }));
      }
    }
    sendJson(res, 200, ok({ items: results }));
    return;
  }

  if (req.method === "POST" && url.pathname.match(/^\/api\/image-jobs\/[^/]+\/poll$/)) {
    const id = decodeURIComponent(url.pathname.split("/")[3]);
    const body = await readBody(req);
    const job = imageTaskStore.listJobs().find((item) => item.id === id);
    if (!job) {
      sendJson(res, 404, fail("图片任务不存在"));
      return;
    }
    try {
      const cachedProviderImageUrl = job.providerResponse
        ? moxingImage.extractImageUrl(job.providerResponse)
        : "";
      // 只有缓存响应里已经带图时才走快路径；提交阶段的 queued 响应不能拦截真正轮询。
      if (cachedProviderImageUrl && !job.imageUrl) {
        const localized = await localizeImageResult(job, {
          status: job.status,
          providerResponse: job.providerResponse
        }, req);
        let updated = imageTaskStore.updateJob(id, {
          status: localized.status,
          imageUrl: localized.imageUrl || job.imageUrl || "",
          imageAsset: localized.imageAsset || job.imageAsset || null,
          remoteImageUrl: localized.remoteImageUrl || job.remoteImageUrl || "",
          providerImageUrl: localized.providerImageUrl || job.providerImageUrl || "",
          localImageBytes: localized.localImageBytes || job.localImageBytes || 0,
          localizeStatus: localized.localizeStatus || job.localizeStatus || "",
          localizeError: localized.localizeError || "",
          errorMessage: ""
        });
        if (updated && updated.status === "ready") {
          updated = consumeGenerationQuotaOnce(updated);
        }
        sendJson(res, 200, ok(publicImageJob(updated, req)));
        return;
      }
      const taskId = job.providerTaskId || job.providerResponse?.task_id;
      const result = body.pollUrl
        ? (body.method === "POST"
          ? await moxingImage.pollImageByPost(taskId, body.pollUrl, body.body || {})
          : await moxingImage.pollImageWithUrl(taskId, body.pollUrl))
        : await moxingImage.pollImage(taskId);
      const localized = await localizeImageResult(job, result, req);
      let updated = imageTaskStore.updateJob(id, {
        status: localized.status,
        imageUrl: localized.imageUrl || job.imageUrl || "",
        imageAsset: localized.imageAsset || job.imageAsset || null,
        remoteImageUrl: localized.remoteImageUrl || job.remoteImageUrl || "",
        providerImageUrl: localized.providerImageUrl || job.providerImageUrl || "",
        localImageBytes: localized.localImageBytes || job.localImageBytes || 0,
        localizeStatus: localized.localizeStatus || job.localizeStatus || "",
        localizeError: localized.localizeError || "",
        providerPollUrl: result.pollUrl || job.providerPollUrl,
        providerResponse: result.providerResponse,
        errorMessage: ""
      });
      if (updated && updated.status === "ready") {
        updated = consumeGenerationQuotaOnce(updated);
      }
      sendJson(res, 200, ok(publicImageJob(updated, req)));
    } catch (error) {
      const failed = imageTaskStore.updateJob(id, {
        status: "failed",
        errorMessage: error.message || "moxing poll failed",
        providerResponse: error.providerResponse || job.providerResponse
      });
      sendJson(res, 200, fail(failed.errorMessage));
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/image-jobs/poll-submitted") {
    const submitted = imageTaskStore.listJobs().filter((job) =>
      ["submitted", "queued", "running", "processing"].includes(job.status)
    );
    const results = [];
    for (const job of submitted) {
      try {
        const result = await moxingImage.pollImage(job.providerTaskId || job.providerResponse?.task_id);
        const localized = await localizeImageResult(job, result, req);
        let updated = imageTaskStore.updateJob(job.id, {
          status: localized.status,
          imageUrl: localized.imageUrl || job.imageUrl || "",
          imageAsset: localized.imageAsset || job.imageAsset || null,
          remoteImageUrl: localized.remoteImageUrl || job.remoteImageUrl || "",
          providerImageUrl: localized.providerImageUrl || job.providerImageUrl || "",
          localImageBytes: localized.localImageBytes || job.localImageBytes || 0,
          localizeStatus: localized.localizeStatus || job.localizeStatus || "",
          localizeError: localized.localizeError || "",
          providerPollUrl: result.pollUrl || job.providerPollUrl,
          providerResponse: result.providerResponse,
          errorMessage: ""
        });
        if (updated && updated.status === "ready") {
          updated = consumeGenerationQuotaOnce(updated);
        }
        results.push(updated);
      } catch (error) {
        results.push(imageTaskStore.updateJob(job.id, {
          status: "failed",
          errorMessage: error.message || "moxing poll failed",
          providerResponse: error.providerResponse || job.providerResponse
        }));
      }
    }
    sendJson(res, 200, ok({ items: results }));
    return;
  }

  if (req.method === "POST" && url.pathname.match(/^\/api\/image-jobs\/[^/]+\/download$/)) {
    const id = decodeURIComponent(url.pathname.split("/")[3]);
    const job = imageTaskStore.listJobs().find((item) => item.id === id);
    if (!job) {
      sendJson(res, 404, fail("图片任务不存在"));
      return;
    }
    const sourceUrl = job.remoteImageUrl || job.imageUrl || moxingImage.extractImageUrl(job.providerResponse);
    try {
      const downloaded = await imageDownloader.downloadImageToTarget(sourceUrl, job.targetPath);
      const asset = assetStore.registerUploadedAsset({
        id: `generated-${job.id}`,
        type: "generated_tryon",
        group: "daily_tryon",
        localPath: downloaded.localPath,
        mimeType: downloaded.localPath.endsWith(".png") ? "image/png" : "image/jpeg",
        source: "image_job",
        meta: { imageJobId: job.id, userId: job.userId, scene: job.scene }
      }, req);
      let updated = imageTaskStore.updateJob(id, {
        status: "ready",
        imageUrl: asset.previewUrl || asset.url,
        imageAsset: asset,
        remoteImageUrl: sourceUrl,
        localImageBytes: downloaded.bytes,
        localizeStatus: "local_ready",
        localizeError: "",
        errorMessage: ""
      });
      updated = consumeGenerationQuotaOnce(updated);
      sendJson(res, 200, ok(publicImageJob(updated, req)));
    } catch (error) {
      const failed = imageTaskStore.updateJob(id, {
        errorMessage: error.message || "image download failed"
      });
      sendJson(res, 200, fail(failed.errorMessage));
    }
    return;
  }

  if (req.method === "POST" && url.pathname.match(/^\/api\/image-jobs\/[^/]+\/fail$/)) {
    const body = await readBody(req);
    const id = decodeURIComponent(url.pathname.split("/")[3]);
    const job = imageTaskStore.updateJob(id, {
      status: "failed",
      errorMessage: body.message || "生成失败"
    });
    sendJson(res, job ? 200 : 404, job ? ok(job) : fail("图片任务不存在"));
    return;
  }

  sendJson(res, 404, { code: 404, message: "Not found" });
});

const port = Number(process.env.PORT || 8787);

server.listen(port, () => {
  console.log(`Guimi mock API listening on port ${port}`);
  console.log(`Local: http://127.0.0.1:${port}`);
  console.log(`LAN: http://<your-host-ip>:${port}`);
});
