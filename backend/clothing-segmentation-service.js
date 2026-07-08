const fs = require("fs");
const ImagesegClient = require("@alicloud/imageseg20191230").default;
const ImagesegModels = require("@alicloud/imageseg20191230/dist/models/model");
const assetStore = require("./asset-store");

const defaultClothClasses = ["tops", "coat", "pants", "skirt", "dress", "shoes", "bag"];

function aliyunCredentials() {
  return {
    accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID || "",
    accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET || "",
    securityToken: process.env.ALIBABA_CLOUD_SECURITY_TOKEN || process.env.ALIYUN_SECURITY_TOKEN || ""
  };
}

function hasAliyunCredentials() {
  const credentials = aliyunCredentials();
  return Boolean(credentials.accessKeyId && credentials.accessKeySecret);
}

function imageSegRegion() {
  return process.env.ALIYUN_IMAGESEG_REGION || "cn-shanghai";
}

function imageSegEndpoint() {
  return process.env.ALIYUN_IMAGESEG_ENDPOINT || `imageseg.${imageSegRegion()}.aliyuncs.com`;
}

function createSegmentClient() {
  const credentials = aliyunCredentials();
  if (!credentials.accessKeyId || !credentials.accessKeySecret) return null;
  return new ImagesegClient({
    accessKeyId: credentials.accessKeyId,
    accessKeySecret: credentials.accessKeySecret,
    securityToken: credentials.securityToken || undefined,
    endpoint: imageSegEndpoint(),
    regionId: imageSegRegion()
  });
}

function aliyunRuntimeOptions() {
  return {
    connectTimeout: Number(process.env.ALIYUN_IMAGESEG_CONNECT_TIMEOUT || 10000),
    readTimeout: Number(process.env.ALIYUN_IMAGESEG_READ_TIMEOUT || 120000)
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

function normalizeAliyunClass(value) {
  return String(value || "").trim().toLowerCase();
}

function categoryForAliyunClass(value) {
  const text = normalizeAliyunClass(value);
  if (/tops?|upper|shirt|tshirt|t-shirt|blouse|sweater|vest/.test(text)) return "top";
  if (/coat|jacket|outer|trench|windbreaker|blazer/.test(text)) return "outerwear";
  if (/pants|trouser|jeans|shorts|skirt|bottom/.test(text)) return "bottom";
  if (/dress|gown|onepiece|one-piece/.test(text)) return "dress";
  if (/shoes?|sneaker|loafer|boot|heel/.test(text)) return "shoes";
  if (/bag|purse|handbag/.test(text)) return "bag";
  return "unknown";
}

function responseElements(response) {
  const data = response && response.body && response.body.data;
  if (!data) return [];
  if (Array.isArray(data.elements)) return data.elements;
  if (Array.isArray(data.items)) return data.items;
  if (data.imageURL || data.classUrl) return [data];
  return [];
}

function normalizeElement(element, index) {
  const classEntries = Object.entries(element.classUrl || {});
  if (classEntries.length) {
    return classEntries.map(([aliyunClass, maskUrl]) => ({
      id: `${index}-${normalizeAliyunClass(aliyunClass) || "cloth"}`,
      aliyunClass,
      category: categoryForAliyunClass(aliyunClass),
      imageUrl: element.imageURL || element.url || maskUrl || "",
      maskUrl: maskUrl || "",
      raw: element
    }));
  }
  const aliyunClass = element.className || element.category || element.label || element.type || "unknown";
  return [{
    id: `${index}-${normalizeAliyunClass(aliyunClass) || "cloth"}`,
    aliyunClass,
    category: categoryForAliyunClass(aliyunClass),
    imageUrl: element.imageURL || element.url || element.maskUrl || "",
    maskUrl: element.maskUrl || "",
    raw: element
  }];
}

async function segmentClothingFromPersonImage(input = {}) {
  const sourceImageUrl = input.imageUrl || "";
  const readableImagePath = resolveReadableImagePath(input);
  if (!sourceImageUrl && !readableImagePath) {
    return {
      status: "missing_image_url",
      provider: "aliyun_segment_cloth",
      sourceImageUrl,
      items: [],
      message: "缺少可供阿里云服饰分割访问的图片 URL。"
    };
  }

  const client = input.client || createSegmentClient();
  if (!client) {
    return {
      status: "not_configured",
      provider: "aliyun_segment_cloth",
      sourceImageUrl,
      items: [],
      message: "缺少阿里云 AccessKey，无法调用服饰分割。"
    };
  }

  const requestParams = {
    clothClass: Array.isArray(input.clothClass) && input.clothClass.length ? input.clothClass : defaultClothClasses,
    outMode: Number.isFinite(input.outMode) ? input.outMode : 1,
    returnForm: input.returnForm || "mask"
  };
  const response = readableImagePath
    ? await client.segmentClothAdvance(new ImagesegModels.SegmentClothAdvanceRequest({
      ...requestParams,
      imageURLObject: fs.createReadStream(readableImagePath)
    }), aliyunRuntimeOptions())
    : await client.segmentCloth(new ImagesegModels.SegmentClothRequest({
      ...requestParams,
      imageURL: sourceImageUrl
    }));
  const items = responseElements(response).flatMap((element, index) => normalizeElement(element, index));
  return {
    status: "success",
    provider: "aliyun_segment_cloth",
    mode: readableImagePath ? "advance_stream" : "url",
    requestId: response && response.body ? response.body.requestId || "" : "",
    sourceImageUrl,
    items
  };
}

module.exports = {
  defaultClothClasses,
  hasAliyunCredentials,
  segmentClothingFromPersonImage,
  categoryForAliyunClass
};
