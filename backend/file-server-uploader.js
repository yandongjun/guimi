const fs = require("fs");
const path = require("path");

/* ------------------------------ 文件服务器配置 ------------------------------ */

/**
 * 功能：读取文件服务器上传配置。
 * 参数：无。
 * 返回：上传地址、基础地址和账号信息。
 * 异常：无。
 */
function getFileServerConfig() {
  return {
    uploadUrl: String(process.env.FILE_SERVER_UPLOAD_URL || "").trim(),
    baseUrl: String(process.env.FILE_SERVER_BASE_URL || "").trim(),
    userName: String(process.env.FILE_SERVER_USER_NAME || "").trim(),
    userKey: String(process.env.FILE_SERVER_USER_KEY || "").trim()
  };
}

/**
 * 功能：判断文件服务器上传配置是否完整。
 * 参数：无。
 * 返回：布尔值。
 * 异常：无。
 */
function isFileServerConfigured() {
  const config = getFileServerConfig();
  return Boolean(config.uploadUrl && config.userName && config.userKey);
}

/**
 * 功能：按文件扩展名推断 MIME 类型，避免上传时丢失类型。
 * 参数：filePath 文件绝对路径。
 * 返回：MIME 类型字符串。
 * 异常：无。
 */
function guessMimeType(filePath) {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

/**
 * 功能：把文件上传到外部文件服务器，并返回公网访问地址。
 * 参数：filePath 本地文件绝对路径，options 可选参数。
 * 返回：文件服务器返回的 data 对象。
 * 异常：配置缺失、文件不存在、远端返回失败时抛出异常。
 */
async function uploadToFileServer(filePath, options = {}) {
  const config = getFileServerConfig();
  if (!isFileServerConfigured()) {
    throw new Error("未配置文件服务器上传信息，请设置 FILE_SERVER_UPLOAD_URL / FILE_SERVER_USER_NAME / FILE_SERVER_USER_KEY");
  }
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`待上传文件不存在: ${filePath || "empty file path"}`);
  }

  const originalName = options.originalName || path.basename(filePath);
  const mimeType = options.mimeType || guessMimeType(filePath);
  const buffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), originalName);
  if (options.userName) form.append("userName", String(options.userName));
  if (options.userKey) form.append("userKey", String(options.userKey));

  const response = await fetch(config.uploadUrl, {
    method: "POST",
    headers: {
      "x-user-name": options.userName || config.userName,
      "x-user-key": options.userKey || config.userKey
    },
    body: form
  });

  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(`文件服务器上传失败: ${payload && payload.message ? payload.message : (raw || response.status)}`);
  }
  if (!payload || payload.success !== true || !payload.data || !payload.data.publicUrl) {
    throw new Error(`文件服务器返回无效: ${raw || "empty response"}`);
  }
  return payload.data;
}

module.exports = {
  getFileServerConfig,
  isFileServerConfigured,
  uploadToFileServer
};
