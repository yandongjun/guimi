const http = require("http");
const mock = require("../data/mock");
const imageTaskStore = require("./image-task-store");
const moxingImage = require("./providers/moxing-image");
const imageDownloader = require("./image-downloader");
const assetStore = require("./asset-store");

const state = {
  generationUsed: 0,
  generations: {},
  ratings: []
};

function quota() {
  const limit = mock.user.membership === "paid" ? 10 : 2;
  return {
    membership: mock.user.membership,
    limit,
    used: state.generationUsed,
    remaining: Math.max(limit - state.generationUsed, 0)
  };
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

function outfitWithAsset(scene, req, userId = "user-a") {
  const base = mock.outfitByScene[scene] || mock.outfitByScene["上班"];
  const job = mock.manualImageJobs.find((item) => item.userId === userId && item.scene === scene);
  if (!job) return base;
  const assetId = require("../data/assets").getOutfitAssetId(job.id);
  const asset = assetId ? assetStore.getAsset(assetId, req) : assetStore.getAssetByLocalPath(job.imagePath, req);
  return {
    ...base,
    id: job.id,
    title: job.outfitTitle,
    displayTitle: job.outfitTitle,
    expectedImagePath: job.imagePath,
    tryOnAsset: asset,
    tryOnImage: asset ? asset.previewUrl : base.tryOnImage
  };
}

function generationPayload(scene, req) {
  const outfit = outfitWithAsset(scene, req);
  const generationId = `${outfit.id}-${Date.now()}`;
  const payload = {
    generationId,
    status: "success",
    scene,
    ...outfit,
    quota: quota()
  };
  state.generations[generationId] = payload;
  return payload;
}

function buildImagePrompt({ user, profile, scene, outfit }) {
  const colors = (user.favoriteColors || []).slice(0, 3).join("、");
  const strategies = (profile.strategies || []).slice(0, 3).join("、");
  const avoid = (profile.avoid || []).slice(0, 3).join("、");
  return [
    `Create a full-body realistic Chinese female fashion try-on image for ${user.nickname}.`,
    `User profile: ${user.ageRange || ""}, ${user.city}, ${user.height}cm/${user.weight}kg, ${profile.bodyType}.`,
    `Scene: ${scene}. Outfit title: ${outfit.displayTitle || outfit.title}.`,
    `Styling strategy: ${strategies}. Favorite colors: ${colors}. Avoid: ${avoid}.`,
    "Output should be a transparent-background PNG cutout: the person and outfit only, alpha channel, no room, no wall, no floor, no street, no props in the background, no shadow panel.",
    "The girl should feel vivid, natural, socially real, and fashionable, not like a catalog mannequin.",
    "Full body visible from head to shoes, natural motion, polished accessories, realistic fabric, 2026 Xiaohongshu daily fashion."
  ].join(" ");
}

function buildPromptContract({ user, profile, scene, outfit }) {
  return {
    ageRange: user.ageRange || "",
    city: user.city || "",
    heightCm: user.height || profile.heightCm || 0,
    weightKg: user.weight || 0,
    bodyType: profile.bodyType || "",
    strategies: profile.strategies || [],
    avoid: profile.avoid || [],
    scene,
    outfitTitle: outfit.displayTitle || outfit.title || "",
    favoriteColors: user.favoriteColors || []
  };
}

function hasContractValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return Boolean(String(value || "").trim());
}

function validateImagePromptContract(job) {
  const prompt = job.prompt || "";
  const contract = job.promptContract || {};
  const checks = [
    ["ageRange", hasContractValue(contract.ageRange) || /User profile:\s*[^,\s]+/.test(prompt)],
    ["city", hasContractValue(contract.city) || /User profile:[^,]*,\s*[^,\s]+/.test(prompt)],
    ["heightCm", hasContractValue(contract.heightCm) || /\b\d{2,3}cm\b/.test(prompt)],
    ["weightKg", hasContractValue(contract.weightKg) || /\b\d{2,3}kg\b/.test(prompt)],
    ["bodyType", hasContractValue(contract.bodyType) || /\bkg,\s*[^.]+/.test(prompt)],
    ["strategies", hasContractValue(contract.strategies) || /Styling strategy:\s*[^.]+/.test(prompt)],
    ["avoid", hasContractValue(contract.avoid) || /Avoid:\s*[^.]+/.test(prompt)],
    ["scene", hasContractValue(contract.scene) || /Scene:\s*[^.]+/.test(prompt)],
    ["outfitTitle", hasContractValue(contract.outfitTitle) || /Outfit title:\s*[^.]+/.test(prompt)],
    ["favoriteColors", hasContractValue(contract.favoriteColors) || /Favorite colors:\s*[^.]+/.test(prompt)]
  ];
  const missing = checks.filter((item) => !item[1]).map((item) => item[0]);
  return {
    valid: missing.length === 0,
    missing
  };
}

function imageJobPayload(userId, scene) {
  const user = mock.testUsers.find((item) => item.id === userId) || mock.testUsers[0] || mock.user;
  const profile = user.bodyProfile || mock.bodyProfile;
  const outfit = mock.outfitByScene[scene] || mock.outfitByScene[user.scenes && user.scenes[0]] || mock.outfitByScene["上班"];
  const job = mock.manualImageJobs.find((item) => item.userId === user.id && item.scene === scene);
  const targetPath = job ? job.imagePath.replace(/\.jpe?g$/i, ".png") : `/packages/test-assets/generated/users/${user.id}-${scene}.png`;
  const prompt = buildImagePrompt({ user, profile, scene, outfit });
  const promptContract = buildPromptContract({ user, profile, scene, outfit });
  const negativePrompt = [
    "no stiff pose",
    "no wedding studio style",
    "no old fashioned outfit",
    "no heavy makeup",
    "no exaggerated body reshaping",
    "no unrealistic long legs",
    "no cropped head",
    "no cropped feet",
    "no deformed hands"
  ].join(", ");
  return {
    userId: user.id,
    userName: user.nickname,
    scene,
    outfitTitle: job ? job.outfitTitle : outfit.displayTitle,
    targetPath,
    prompt,
    negativePrompt,
    promptContract,
    promptContractStatus: "valid",
    size: { width: 1024, height: 1536 },
    providerRequest: {
      model: "gpt-image-2",
      prompt,
      quality: "medium",
      size: "1024x1536"
    }
  };
}

function markPromptContractFailure(job, validation) {
  return imageTaskStore.updateJob(job.id, {
    status: "incomplete",
    promptContractStatus: "invalid",
    promptContractMissing: validation.missing,
    errorMessage: `image prompt contract missing: ${validation.missing.join(", ")}`
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

  const downloaded = await imageDownloader.downloadImageToTarget(resolvedImageUrl, job.targetPath);
  const downloadedAsset = assetStore.registerUploadedAsset({
    id: `generated-${job.id}`,
    type: "generated_tryon",
    group: "daily_tryon",
    localPath: downloaded.localPath,
    mimeType: downloaded.localPath.endsWith(".png") ? "image/png" : "image/jpeg",
    source: "image_job",
    meta: { imageJobId: job.id, userId: job.userId, scene: job.scene }
  }, req);
  return {
    status: "ready",
    imageUrl: downloadedAsset.previewUrl || downloadedAsset.url,
    imageAsset: downloadedAsset,
    remoteImageUrl: resolvedImageUrl,
    localImageBytes: downloaded.bytes
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:8787");

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
      imageModel: "gpt-image-2",
      hasMoxingApiKey: Boolean(process.env.MOXING_API_KEY),
      endpoints: [
        "GET /api/home",
        "GET /api/assets",
        "POST /api/assets/upload",
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
    const localPath = `/${require("path").relative(assetStore.workspaceRoot, filePath).replace(/\\/g, "/")}`;
    const asset = assetStore.registerUploadedAsset({
      id: safeId,
      type,
      group,
      slot,
      localPath,
      mimeType: file.contentType,
      originalName: file.filename,
      source: "upload",
      meta: {
        size: file.buffer.length
      }
    }, req);
    sendJson(res, 200, ok(asset));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/home") {
    sendJson(res, 200, ok({
      user: mock.user,
      weather: mock.weather,
      dailyAura: mock.dailyAura,
      bodyProfile: mock.bodyProfile,
      dailyOutfit: outfitWithAsset("上班", req),
      closetCount: mock.closet.length,
      trends: mock.trendItems,
      sceneOptions: mock.sceneOptions,
      quota: quota()
    }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/outfits/daily") {
    const body = await readBody(req);
    const scene = body.scene || "上班";
    sendJson(res, 200, ok({
      weather: { ...mock.weather, city: body.city || mock.weather.city },
      dailyAura: mock.dailyAura,
      luckyColor: mock.dailyAura.luckyColor,
      favoriteColors: mock.user.favoriteColors,
      outfit: outfitWithAsset(scene, req),
      trendItems: mock.trendItems,
      quota: quota()
    }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/outfits/generate") {
    const body = await readBody(req);
    const currentQuota = quota();
    if (currentQuota.remaining <= 0) {
      sendJson(res, 200, fail("今天的生成次数已经用完了，明天再来，或升级会员获得 10 次生成。"));
      return;
    }
    state.generationUsed += 1;
    const payload = generationPayload(body.scene || "上班", req);
    payload.quota = quota();
    sendJson(res, 200, ok(payload));
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/outfits/")) {
    const id = decodeURIComponent(url.pathname.replace("/api/outfits/", ""));
    sendJson(res, 200, ok(state.generations[id] || generationPayload("上班", req)));
    return;
  }

  if (req.method === "POST" && url.pathname.endsWith("/rating")) {
    const body = await readBody(req);
    const rating = {
      id: `rating-${Date.now()}`,
      scores: body.scores || {},
      createdAt: new Date().toISOString()
    };
    state.ratings.push(rating);
    sendJson(res, 200, ok({ saved: true, rating }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/generation/quota") {
    sendJson(res, 200, ok(quota()));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/body-scan/analyze") {
    const body = await readBody(req);
    const photos = body.photos || {};
    sendJson(res, 200, ok({
      ...mock.bodyProfile,
      photoSlots: Object.keys(photos).filter((key) => photos[key]),
      confidence: 0.82,
      confidencePercent: 82,
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
    sendJson(res, 200, ok({
      items: mock.closet,
      gaps: [
        "缺少一件轻薄防风短外套，适合出游和早晚温差。",
        "缺少米灰色高腰半裙，约会场景可以更柔和。",
        "银色小配饰较少，聚会场景缺少轻亮点。"
      ],
      stats: {
        total: mock.closet.length,
        colors: ["奶油白", "鼠尾草绿", "深靛蓝", "黑色"],
        readiness: 68
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

  if (req.method === "GET" && url.pathname === "/api/image-jobs") {
    sendJson(res, 200, ok({
      items: imageTaskStore.listJobs({ status: url.searchParams.get("status") || "" })
    }));
    return;
  }

  if (req.method === "GET" && url.pathname.match(/^\/api\/image-jobs\/[^/]+$/)) {
    const id = decodeURIComponent(url.pathname.split("/")[3]);
    const job = imageTaskStore.listJobs().find((item) => item.id === id);
    sendJson(res, job ? 200 : 404, job ? ok(job) : fail("图片任务不存在"));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/image-jobs") {
    const body = await readBody(req);
    const scene = body.scene || "上班";
    const job = imageTaskStore.createJob({
      ...imageJobPayload(body.userId || "user-a", scene),
      source: body.source || "api"
    });
    sendJson(res, 200, ok(job));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/image-jobs/seed-test-users") {
    const created = mock.manualImageJobs.map((item) =>
      imageTaskStore.createJob({
        ...imageJobPayload(item.userId, item.scene),
        id: item.id,
        source: "seed"
      })
    );
    sendJson(res, 200, ok({ items: created }));
    return;
  }

  if (req.method === "POST" && url.pathname.match(/^\/api\/image-jobs\/[^/]+\/complete$/)) {
    const body = await readBody(req);
    const id = decodeURIComponent(url.pathname.split("/")[3]);
    const job = imageTaskStore.updateJob(id, {
      status: "ready",
      imageUrl: body.imageUrl || body.localPath || "",
      targetPath: body.targetPath,
      errorMessage: ""
    });
    sendJson(res, job ? 200 : 404, job ? ok(job) : fail("图片任务不存在"));
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
      const result = await moxingImage.submitImage(job);
      const localized = await localizeImageResult(job, result, req);
      const updated = imageTaskStore.updateJob(id, {
        status: localized.status,
        imageUrl: localized.imageUrl,
        imageAsset: localized.imageAsset || null,
        remoteImageUrl: localized.remoteImageUrl,
        localImageBytes: localized.localImageBytes,
        providerTaskId: result.taskId || "",
        providerRequest: result.providerRequest,
        providerResponse: result.providerResponse,
        errorMessage: ""
      });
      sendJson(res, 200, ok(updated));
    } catch (error) {
      const failed = imageTaskStore.updateJob(id, {
        status: "failed",
        errorMessage: error.message || "moxing image generation failed",
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
        const result = await moxingImage.submitImage(job);
        const localized = await localizeImageResult(job, result, req);
        results.push(imageTaskStore.updateJob(job.id, {
          status: localized.status,
          imageUrl: localized.imageUrl,
          imageAsset: localized.imageAsset || null,
          remoteImageUrl: localized.remoteImageUrl,
          localImageBytes: localized.localImageBytes,
          providerTaskId: result.taskId || "",
          providerRequest: result.providerRequest,
          providerResponse: result.providerResponse,
          errorMessage: ""
        }));
      } catch (error) {
        results.push(imageTaskStore.updateJob(job.id, {
          status: "failed",
          errorMessage: error.message || "moxing image generation failed",
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
      if (job.providerResponse && !job.imageUrl) {
        const localized = await localizeImageResult(job, {
          status: job.status,
          providerResponse: job.providerResponse
        }, req);
        const updated = imageTaskStore.updateJob(id, {
          status: localized.status,
          imageUrl: localized.imageUrl || job.imageUrl || "",
          imageAsset: localized.imageAsset || job.imageAsset || null,
          remoteImageUrl: localized.remoteImageUrl || job.remoteImageUrl || "",
          localImageBytes: localized.localImageBytes || job.localImageBytes || 0,
          errorMessage: ""
        });
        sendJson(res, 200, ok(updated));
        return;
      }
      const taskId = job.providerTaskId || job.providerResponse?.task_id;
      const result = body.pollUrl
        ? (body.method === "POST"
          ? await moxingImage.pollImageByPost(taskId, body.pollUrl, body.body || {})
          : await moxingImage.pollImageWithUrl(taskId, body.pollUrl))
        : await moxingImage.pollImage(taskId);
      const localized = await localizeImageResult(job, result, req);
      const updated = imageTaskStore.updateJob(id, {
        status: localized.status,
        imageUrl: localized.imageUrl || job.imageUrl || "",
        imageAsset: localized.imageAsset || job.imageAsset || null,
        remoteImageUrl: localized.remoteImageUrl || job.remoteImageUrl || "",
        localImageBytes: localized.localImageBytes || job.localImageBytes || 0,
        providerPollUrl: result.pollUrl || job.providerPollUrl,
        providerResponse: result.providerResponse,
        errorMessage: ""
      });
      sendJson(res, 200, ok(updated));
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
        results.push(imageTaskStore.updateJob(job.id, {
          status: localized.status,
          imageUrl: localized.imageUrl || job.imageUrl || "",
          imageAsset: localized.imageAsset || job.imageAsset || null,
          remoteImageUrl: localized.remoteImageUrl || job.remoteImageUrl || "",
          localImageBytes: localized.localImageBytes || job.localImageBytes || 0,
          providerPollUrl: result.pollUrl || job.providerPollUrl,
          providerResponse: result.providerResponse,
          errorMessage: ""
        }));
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
      const updated = imageTaskStore.updateJob(id, {
        status: "ready",
        imageUrl: asset.previewUrl || asset.url,
        imageAsset: asset,
        remoteImageUrl: sourceUrl,
        localImageBytes: downloaded.bytes,
        errorMessage: ""
      });
      sendJson(res, 200, ok(updated));
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
  console.log(`Guimi mock API listening on http://127.0.0.1:${port}`);
});
