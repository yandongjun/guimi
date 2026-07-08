const fs = require("fs");
const ImagerecogModule = require("@alicloud/imagerecog20190930");
const ImagerecogClient = ImagerecogModule.default;
const {
  TaggingImageRequest,
  RecognizeImageColorRequest,
  TaggingImageAdvanceRequest,
  RecognizeImageColorAdvanceRequest
} = ImagerecogModule;
const assetStore = require("./asset-store");

function textForAnalysis(input = {}, aliyun = {}) {
  return [
    input.categoryHint,
    input.segmentCategory,
    input.aliyunClass,
    input.originalName,
    input.fileName,
    input.imageUrl,
    input.localPath,
    ...(aliyun.tags || []).map((tag) => tag.value),
    ...(aliyun.colors || []).map((color) => `${color.label || ""} ${color.color || ""}`)
  ].filter(Boolean).join(" ").toLowerCase();
}

function aliyunCredentials() {
  return {
    accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID || "",
    accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET || "",
    securityToken: process.env.ALIBABA_CLOUD_SECURITY_TOKEN || process.env.ALIYUN_SECURITY_TOKEN || ""
  };
}

function imagerecogRegion() {
  return process.env.ALIYUN_IMAGERECOG_REGION || process.env.ALIYUN_IMAGESEG_REGION || "cn-shanghai";
}

function imagerecogEndpoint() {
  return process.env.ALIYUN_IMAGERECOG_ENDPOINT || `imagerecog.${imagerecogRegion()}.aliyuncs.com`;
}

function createImagerecogClient() {
  const credentials = aliyunCredentials();
  if (!credentials.accessKeyId || !credentials.accessKeySecret) return null;
  return new ImagerecogClient({
    accessKeyId: credentials.accessKeyId,
    accessKeySecret: credentials.accessKeySecret,
    securityToken: credentials.securityToken || undefined,
    endpoint: imagerecogEndpoint(),
    regionId: imagerecogRegion()
  });
}

function aliyunTimeoutMs() {
  return Number(process.env.ALIYUN_IMAGERECOG_TIMEOUT_MS || 8000);
}

function aliyunRuntimeOptions() {
  return {
    connectTimeout: Number(process.env.ALIYUN_IMAGERECOG_CONNECT_TIMEOUT || 10000),
    readTimeout: Number(process.env.ALIYUN_IMAGERECOG_READ_TIMEOUT || 120000)
  };
}

function resolveReadableImagePath(input = {}) {
  const candidates = [
    input.absolutePath,
    input.localFilePath,
    input.filePath,
    input.localPath
  ].filter(Boolean);
  for (const candidate of candidates) {
    const direct = String(candidate || "");
    if (fs.existsSync(direct)) return direct;
    const resolved = assetStore.resolveLocalFile(direct);
    if (resolved && fs.existsSync(resolved)) return resolved;
  }
  return "";
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label} timed out after ${ms}ms`);
      error.code = "ALIYUN_TIMEOUT";
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function aliyunFailureStatus(error) {
  const message = error && error.message ? error.message : "";
  const code = error && error.code ? error.code : "";
  const text = `${code} ${message}`;
  if (/ALIYUN_TIMEOUT|timed out/i.test(text)) return "timeout";
  if (/InvalidApi\.NotPurchase|not purchased|NotPurchase/i.test(text)) return "not_purchased";
  return "failed";
}

function analysisMessageFor(aliyun = {}) {
  if (aliyun.status === "success") return "云识别完成";
  if (aliyun.status === "not_configured") return "未配置阿里云图像识别 Key，已使用本地规则标签";
  if (aliyun.status === "not_purchased") return "阿里云图像识别 API 未开通，已使用本地规则标签";
  if (aliyun.status === "timeout") return "阿里云图像识别超时，已使用本地规则标签";
  if (aliyun.status === "skipped") return "缺少可识别图片地址，已使用本地规则标签";
  return "云识别失败，已使用本地规则标签";
}

function pickColor(text, colors = []) {
  const dominant = colors[0] || {};
  const source = `${dominant.label || ""} ${dominant.color || ""} ${text}`.toLowerCase();
  if (/cream|ivory|white|米|白|奶油/.test(source)) return ["cream_white", "奶油白"];
  if (/sage|green|绿|青/.test(source)) return ["sage_green", "鼠尾草绿"];
  if (/indigo|blue|denim|jean|蓝|牛仔/.test(source)) return ["dark_indigo", "深靛蓝"];
  if (/black|黑/.test(source)) return ["black", "黑色"];
  if (/gray|grey|silver|灰|银/.test(source)) return ["silver_gray", "银色浅灰"];
  if (/pink|rose|粉|玫/.test(source)) return ["soft_pink", "柔粉色"];
  if (/brown|咖|棕|驼/.test(source)) return ["camel_brown", "驼棕色"];
  return ["neutral", "中性色"];
}

function pickCategory(text) {
  if (/dress|连衣裙|长裙|onepiece|one-piece/.test(text)) {
    return {
      category: "dress",
      categoryLabel: "连衣裙",
      subCategory: "dress",
      subCategoryLabel: "连衣裙",
      nameSuffix: "连衣裙"
    };
  }
  if (/shoe|mary|loafer|boot|heel|sneaker|鞋/.test(text)) {
    return {
      category: "shoes",
      categoryLabel: "鞋包",
      subCategory: "shoes",
      subCategoryLabel: "鞋",
      nameSuffix: "鞋"
    };
  }
  if (/jean|pants|trouser|skirt|bottom|裤|裙/.test(text)) {
    const isSkirt = /skirt|裙/.test(text);
    return {
      category: "bottom",
      categoryLabel: "下装",
      subCategory: isSkirt ? "skirt" : "straight_jeans",
      subCategoryLabel: isSkirt ? "半身裙" : "直筒裤",
      nameSuffix: isSkirt ? "半身裙" : "直筒裤"
    };
  }
  if (/blazer|jacket|coat|outer|trench|windbreaker|外套|西装|风衣|夹克/.test(text)) {
    return {
      category: "outerwear",
      categoryLabel: "外套",
      subCategory: /trench|windbreaker|风衣/.test(text) ? "trench_coat" : "short_blazer",
      subCategoryLabel: /trench|windbreaker|风衣/.test(text) ? "风衣外套" : "短款西装",
      nameSuffix: /trench|windbreaker|风衣/.test(text) ? "风衣外套" : "西装外套"
    };
  }
  return {
    category: "top",
    categoryLabel: "上衣",
    subCategory: /vest|背心/.test(text) ? "knit_vest" : "top",
    subCategoryLabel: /vest|背心/.test(text) ? "针织背心" : "上衣",
    nameSuffix: /vest|背心/.test(text) ? "针织背心" : "上衣"
  };
}

function sceneTagsForCategory(category) {
  if (category === "shoes") return ["office", "dating", "party"];
  if (category === "bottom") return ["office", "travel", "party"];
  if (category === "outerwear" || category === "dress") return ["office", "dating"];
  return ["office", "travel"];
}

function bodyStrategyForCategory(category) {
  if (category === "outerwear") {
    return {
      tags: ["define_shoulder", "raise_waistline"],
      labels: ["修饰肩线", "提高腰线"]
    };
  }
  if (category === "bottom" || category === "shoes") {
    return {
      tags: ["extend_leg"],
      labels: ["拉长腿部比例"]
    };
  }
  if (category === "dress") {
    return {
      tags: ["one_piece_balance", "raise_waistline"],
      labels: ["整体比例统一", "提高腰线"]
    };
  }
  return {
    tags: ["upper_focus"],
    labels: ["上半身做重点"]
  };
}

function bodyStrategyForAnalysis(category, text = "") {
  if (category === "shoes") {
    if (/heel|high heel|pointed|mary|高跟|尖头|玛丽珍/i.test(text)) {
      return {
        tags: ["extend_leg"],
        labels: ["拉长腿部比例"]
      };
    }
    if (/sandal|flat|slipper|slide|凉鞋|平底|拖鞋/i.test(text)) {
      return {
        tags: ["comfort_walk"],
        labels: ["行走舒适"]
      };
    }
    return {
      tags: ["easy_match"],
      labels: ["轻便好搭"]
    };
  }
  return bodyStrategyForCategory(category);
}

function pickSmartColor(text, colors = []) {
  const totals = colors.reduce((acc, color) => {
    const key = String(color.label || "").toLowerCase();
    if (key) acc[key] = (acc[key] || 0) + Number(color.percentage || 0);
    return acc;
  }, {});
  const dominantLabel = Object.entries(totals)
    .sort((left, right) => right[1] - left[1])[0]?.[0] || "";
  const first = colors[0] || {};
  const source = `${dominantLabel} ${first.label || ""} ${first.color || ""} ${text}`.toLowerCase();
  if (/burgundy|wine|maroon|purple|violet|red|7a2f56|8a3342|酒红|紫红|紫色|红色/.test(source)) return ["burgundy", "酒红色"];
  if (/sage|green|绿色/.test(source)) return ["sage_green", "鼠尾草绿"];
  if (/indigo|blue|denim|jean|蓝/.test(source)) return ["denim_blue", "牛仔蓝"];
  if (/black|黑/.test(source)) return ["black", "黑色"];
  if (/gray|grey|silver|灰|银/.test(source)) return ["silver_gray", "银色浅灰"];
  if (/pink|rose|粉/.test(source)) return ["soft_pink", "柔粉色"];
  if (/brown|camel|棕|咖/.test(source)) return ["camel_brown", "驼棕色"];
  if (/cream|ivory|white|白|奶油/.test(source)) return ["cream_white", "奶油白"];
  return ["neutral", "中性色"];
}

function topSubCategoryForText(text) {
  if (/t恤|t-shirt|tee|短袖|short sleeve|short-sleeve/i.test(text)) {
    return {
      subCategory: "short_sleeve_tshirt",
      subCategoryLabel: "短袖T恤",
      nameSuffix: "短袖T恤"
    };
  }
  if (/shirt|衬衫|襯衫|blouse/i.test(text)) {
    return {
      subCategory: "shirt",
      subCategoryLabel: "衬衫",
      nameSuffix: "衬衫"
    };
  }
  if (/vest|背心/i.test(text)) {
    return {
      subCategory: "knit_vest",
      subCategoryLabel: "针织背心",
      nameSuffix: "针织背心"
    };
  }
  return {
    subCategory: "top",
    subCategoryLabel: "上衣",
    nameSuffix: "上衣"
  };
}

function pickSmartCategory(text) {
  const base = pickCategory(text);
  if (base.category !== "top") return base;
  return {
    ...base,
    categoryLabel: "上衣",
    ...topSubCategoryForText(text)
  };
}

function styleForAnalysis(text, category) {
  const tags = new Set();
  const labels = new Set();
  if (/clean|minimal|simple|干净|利落|极简|简洁/i.test(text)) {
    tags.add("clean_fit");
    labels.add("干净利落");
  }
  if (/blazer|jacket|office|commute|西装|通勤/i.test(text) || category === "outerwear") {
    tags.add("commute");
    labels.add("通勤");
  }
  if (/t恤|t-shirt|tee|短袖|short sleeve|short-sleeve|运动|sports?|casual|休闲/i.test(text)) {
    tags.add("casual");
    labels.add("日常休闲");
  }
  if (/短袖|short sleeve|short-sleeve/i.test(text)) {
    tags.add("summer_light");
    labels.add("夏季轻薄");
  }
  if (category === "shoes") {
    tags.add("light_shoes");
    labels.add("轻量鞋履");
  }
  return {
    styleTags: Array.from(tags),
    styleLabels: Array.from(labels)
  };
}

function normalizeTags(response) {
  const tags = response && response.body && response.body.data && response.body.data.tags;
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => ({
    value: tag.value || tag.label || "",
    confidence: Number(tag.confidence || tag.score || 0)
  })).filter((tag) => tag.value);
}

function normalizeColors(response) {
  const list = response && response.body && response.body.data && response.body.data.colorTemplateList;
  if (!Array.isArray(list)) return [];
  return list.map((item) => ({
    color: item.color || "",
    label: item.label || "",
    percentage: Number(item.percentage || 0)
  })).filter((item) => item.color || item.label);
}

async function runAliyunAnalysis(input = {}) {
  const imageUrl = input.imageUrl || "";
  const client = input.client || createImagerecogClient();
  const readableImagePath = resolveReadableImagePath(input);
  if (!imageUrl && !readableImagePath) {
    return { status: "skipped", tags: [], colors: [], requestIds: [] };
  }
  if (!client) {
    return { status: "not_configured", tags: [], colors: [], requestIds: [] };
  }

  const timeoutMs = Number(input.timeoutMs || aliyunTimeoutMs());
  const runtime = aliyunRuntimeOptions();
  const [taggingResponse, colorResponse] = readableImagePath
    ? await withTimeout(Promise.all([
      client.taggingImageAdvance(new TaggingImageAdvanceRequest({
        imageURLObject: fs.createReadStream(readableImagePath)
      }), runtime),
      client.recognizeImageColorAdvance(new RecognizeImageColorAdvanceRequest({
        urlObject: fs.createReadStream(readableImagePath),
        colorCount: input.colorCount || 5
      }), runtime)
    ]), timeoutMs, "Aliyun image recognition advance")
    : await withTimeout(Promise.all([
      client.taggingImage(new TaggingImageRequest({ imageURL: imageUrl })),
      client.recognizeImageColor(new RecognizeImageColorRequest({ url: imageUrl, colorCount: input.colorCount || 5 }))
    ]), timeoutMs, "Aliyun image recognition");
  return {
    status: "success",
    mode: readableImagePath ? "advance_stream" : "url",
    tags: normalizeTags(taggingResponse),
    colors: normalizeColors(colorResponse),
    requestIds: [
      taggingResponse && taggingResponse.body ? taggingResponse.body.requestId || "" : "",
      colorResponse && colorResponse.body ? colorResponse.body.requestId || "" : ""
    ].filter(Boolean)
  };
}

async function analyzeClothingImage(input = {}) {
  let aliyun = { status: "skipped", tags: [], colors: [], requestIds: [] };
  try {
    aliyun = await runAliyunAnalysis(input);
  } catch (error) {
    const status = aliyunFailureStatus(error);
    aliyun = {
      status,
      tags: [],
      colors: [],
      requestIds: [],
      errorMessage: error.message || "aliyun imagerecog failed"
    };
    console.warn("[clothing-analysis] Aliyun image recognition fallback", {
      status,
      message: aliyun.errorMessage
    });
  }

  const text = textForAnalysis(input, aliyun);
  const picked = pickSmartCategory(text);
  const [color, colorLabel] = pickSmartColor(text, aliyun.colors);
  const bodyStrategy = bodyStrategyForAnalysis(picked.category, text);
  const style = styleForAnalysis(text, picked.category);
  return {
    ...picked,
    name: `${colorLabel}${picked.nameSuffix}`,
    color,
    colorLabel,
    warmth: picked.category === "outerwear" || picked.category === "bottom" ? 2 : 1,
    formality: picked.category === "outerwear" || picked.category === "dress" ? 4 : 2,
    sourceType: "wardrobe",
    styleTags: style.styleTags,
    styleLabels: style.styleLabels,
    bodyStrategyTags: bodyStrategy.tags,
    bodyStrategyLabels: bodyStrategy.labels,
    sceneTags: sceneTagsForCategory(picked.category),
    sceneLabels: picked.category === "outerwear" || picked.category === "dress" ? ["上班", "约会"] : ["上班", "出游"],
    riskTags: [],
    riskLabels: [],
    confidence: aliyun.status === "success" ? 0.84 : 0.72,
    analyzer: aliyun.status === "success" ? "aliyun_imagerecog" : "local_keyword_mvp",
    analysisStatus: aliyun.status,
    analysisMessage: analysisMessageFor(aliyun),
    analysisTimeoutMs: aliyunTimeoutMs(),
    rawTags: aliyun.tags,
    rawColors: aliyun.colors,
    analyzerRequestIds: aliyun.requestIds,
    analyzerError: aliyun.errorMessage || ""
  };
}

module.exports = {
  analyzeClothingImage,
  pickCategory,
  pickColor
};
