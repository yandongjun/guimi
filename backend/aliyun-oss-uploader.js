const fs = require("fs");
const path = require("path");
const OSSModule = require("@alicloud/oss-client");

const OSSClient = OSSModule.default;
const {
  Config,
  PutObjectRequest,
  PutObjectRequestHeader
} = OSSModule;

function aliyunCredentials() {
  return {
    accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID || "",
    accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET || "",
    securityToken: process.env.ALIBABA_CLOUD_SECURITY_TOKEN || process.env.ALIYUN_SECURITY_TOKEN || ""
  };
}

function getAliyunOssConfig() {
  return {
    bucket: String(process.env.ALIYUN_OSS_BUCKET || "oss-pai-0yceqi8q94k2rh7bs7-cn-hangzhou").trim(),
    region: String(process.env.ALIYUN_OSS_REGION || "cn-hangzhou").trim(),
    endpoint: String(process.env.ALIYUN_OSS_ENDPOINT || "").trim(),
    publicBaseUrl: String(process.env.ALIYUN_OSS_PUBLIC_BASE_URL || "").trim(),
    prefix: String(process.env.ALIYUN_OSS_PREFIX || "guimi").trim().replace(/^\/+|\/+$/g, ""),
    objectAcl: String(process.env.ALIYUN_OSS_OBJECT_ACL || "").trim()
  };
}

function isAliyunOssConfigured() {
  const config = getAliyunOssConfig();
  const credentials = aliyunCredentials();
  return Boolean(config.bucket && config.region && credentials.accessKeyId && credentials.accessKeySecret);
}

function createClient() {
  const config = getAliyunOssConfig();
  const credentials = aliyunCredentials();
  if (!isAliyunOssConfigured()) return null;
  return new OSSClient(new Config({
    accessKeyId: credentials.accessKeyId,
    accessKeySecret: credentials.accessKeySecret,
    securityToken: credentials.securityToken || undefined,
    endpoint: config.endpoint || `oss-${config.region}.aliyuncs.com`,
    regionId: config.region,
    protocol: "https",
    readTimeout: Number(process.env.ALIYUN_OSS_READ_TIMEOUT || 120000),
    connectTimeout: Number(process.env.ALIYUN_OSS_CONNECT_TIMEOUT || 10000)
  }));
}

function guessMimeType(filePath) {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

function safeName(value) {
  return String(value || "image")
    .trim()
    .replace(/[\\/:*?"<>|#%&{}$!'@+`=]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 96) || "image";
}

function monthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
}

function objectNameFor(filePath, options = {}) {
  const config = getAliyunOssConfig();
  const ext = path.extname(options.originalName || filePath || "") || path.extname(filePath || "") || ".jpg";
  const baseName = safeName(path.basename(options.originalName || filePath || "image", ext));
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  return [config.prefix, monthKey(), `${baseName}-${suffix}${ext.toLowerCase()}`]
    .filter(Boolean)
    .join("/");
}

function publicUrlForObject(objectName) {
  const config = getAliyunOssConfig();
  const encoded = objectName.split("/").map(encodeURIComponent).join("/");
  const base = config.publicBaseUrl
    ? config.publicBaseUrl.replace(/\/+$/, "")
    : `https://${config.bucket}.oss-${config.region}.aliyuncs.com`;
  return `${base}/${encoded}`;
}

async function uploadToAliyunOss(filePath, options = {}) {
  if (!isAliyunOssConfigured()) {
    throw new Error("Aliyun OSS is not configured");
  }
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Aliyun OSS upload file not found: ${filePath || "empty file path"}`);
  }
  const client = options.client || createClient();
  if (!client) throw new Error("Aliyun OSS client create failed");

  const config = getAliyunOssConfig();
  const objectName = options.objectName || objectNameFor(filePath, options);
  const mimeType = options.mimeType || guessMimeType(filePath);
  const header = {
    contentType: mimeType,
    contentLength: String(fs.statSync(filePath).size)
  };
  if (config.objectAcl) {
    header.objectAcl = config.objectAcl;
  }
  const response = await client.putObject(new PutObjectRequest({
    bucketName: config.bucket,
    objectName,
    body: fs.createReadStream(filePath),
    header: new PutObjectRequestHeader(header),
    userMeta: {
      source: options.source || "guimi",
      originalName: options.originalName || path.basename(filePath)
    }
  }), {
    autoretry: true,
    maxAttempts: Number(process.env.ALIYUN_OSS_MAX_ATTEMPTS || 2),
    connectTimeout: Number(process.env.ALIYUN_OSS_CONNECT_TIMEOUT || 10000),
    readTimeout: Number(process.env.ALIYUN_OSS_READ_TIMEOUT || 120000)
  });
  return {
    id: objectName,
    bucket: config.bucket,
    region: config.region,
    objectName,
    publicUrl: publicUrlForObject(objectName),
    mimeType,
    requestId: response && response.requestId ? response.requestId : "",
    etag: response && response.eTag ? response.eTag : ""
  };
}

module.exports = {
  getAliyunOssConfig,
  isAliyunOssConfigured,
  uploadToAliyunOss,
  publicUrlForObject,
  objectNameFor
};
