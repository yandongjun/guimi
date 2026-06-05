const fs = require("fs");
const path = require("path");
const ImagesegClient = require("@alicloud/imageseg20191230").default;
const ImagesegModels = require("@alicloud/imageseg20191230/dist/models/model");

const PHOTOROOM_ENDPOINT = "https://sdk.photoroom.com/v1/segment";
const WAVESPEED_SUBMIT_ENDPOINT = "https://api.wavespeed.ai/api/v3/wavespeed-ai/image-background-remover";
const WAVESPEED_RESULT_ENDPOINT = "https://api.wavespeed.ai/api/v3/predictions";

/* ------------------------------ 基础工具方法 ------------------------------ */

/**
 * 功能：确保目标文件的父目录存在。
 * 参数：filePath 输出文件绝对路径。
 * 返回：无。
 * 异常：目录创建失败时抛出系统异常。
 */
function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/**
 * 功能：读取阿里云视觉智能开放平台访问凭证。
 * 参数：无。
 * 返回：包含 AccessKey 与可选 SecurityToken 的对象。
 * 异常：无。
 */
function getAliyunCredentials() {
  return {
    accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID || "",
    accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET || "",
    securityToken: process.env.ALIBABA_CLOUD_SECURITY_TOKEN || process.env.ALIYUN_SECURITY_TOKEN || ""
  };
}

/**
 * 功能：判断是否已经具备阿里云 SDK 调用所需凭证。
 * 参数：无。
 * 返回：布尔值。
 * 异常：无。
 */
function hasAliyunCredentials() {
  const credentials = getAliyunCredentials();
  return Boolean(credentials.accessKeyId && credentials.accessKeySecret);
}

/**
 * 功能：读取阿里云分割抠图地域。
 * 参数：无。
 * 返回：地域字符串。
 * 异常：无。
 */
function getAliyunRegion() {
  return process.env.ALIYUN_IMAGESEG_REGION || "cn-shanghai";
}

/**
 * 功能：读取阿里云分割抠图服务端点。
 * 参数：无。
 * 返回：端点字符串。
 * 异常：无。
 */
function getAliyunEndpoint() {
  return process.env.ALIYUN_IMAGESEG_ENDPOINT || `imageseg.${getAliyunRegion()}.aliyuncs.com`;
}

/**
 * 功能：读取当前启用的抠图服务名称。
 * 参数：无。
 * 返回：provider 名称。
 * 异常：无。
 */
function getProviderName() {
  const configured = String(process.env.BACKGROUND_REMOVAL_PROVIDER || "").trim().toLowerCase();
  if (configured === "aliyun" || configured === "photoroom" || configured === "wavespeed") {
    return configured;
  }
  if (hasAliyunCredentials()) {
    return "aliyun";
  }
  if (process.env.WAVESPEED_API_KEY) {
    return "wavespeed";
  }
  return "photoroom";
}

/**
 * 功能：按 provider 读取对应的 API Key。
 * 参数：providerName 抠图服务名称。
 * 返回：API Key 字符串。
 * 异常：无。
 */
function getApiKey(providerName = getProviderName()) {
  if (providerName === "aliyun") {
    return getAliyunCredentials().accessKeyId;
  }
  if (providerName === "wavespeed") {
    return process.env.WAVESPEED_API_KEY || "";
  }
  return process.env.PHOTOROOM_API_KEY || "";
}

/**
 * 功能：返回 provider 对应的服务端点。
 * 参数：providerName 抠图服务名称。
 * 返回：接口地址字符串。
 * 异常：无。
 */
function getEndpoint(providerName = getProviderName()) {
  if (providerName === "aliyun") {
    return `https://${getAliyunEndpoint()}`;
  }
  return providerName === "wavespeed" ? WAVESPEED_SUBMIT_ENDPOINT : PHOTOROOM_ENDPOINT;
}

/**
 * 功能：返回当前抠图服务的调试配置。
 * 参数：无。
 * 返回：仅包含安全调试信息的对象。
 * 异常：无。
 */
function getDebugConfig() {
  const provider = getProviderName();
  const aliyunCredentials = getAliyunCredentials();
  const apiKey = getApiKey(provider);
  if (provider === "aliyun") {
    return {
      provider,
      endpoint: getEndpoint(provider),
      regionId: getAliyunRegion(),
      hasApiKey: hasAliyunCredentials(),
      hasAccessKeyId: Boolean(aliyunCredentials.accessKeyId),
      hasAccessKeySecret: Boolean(aliyunCredentials.accessKeySecret),
      keyLength: aliyunCredentials.accessKeyId.length,
      keyTail: aliyunCredentials.accessKeyId ? aliyunCredentials.accessKeyId.slice(-6) : "",
      keySource: [
        process.env.ALIBABA_CLOUD_ACCESS_KEY_ID ? "process.env.ALIBABA_CLOUD_ACCESS_KEY_ID" : (process.env.ALIYUN_ACCESS_KEY_ID ? "process.env.ALIYUN_ACCESS_KEY_ID" : "missing accessKeyId"),
        process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET ? "process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET" : (process.env.ALIYUN_ACCESS_KEY_SECRET ? "process.env.ALIYUN_ACCESS_KEY_SECRET" : "missing accessKeySecret")
      ].join(" + ")
    };
  }
  return {
    provider,
    endpoint: getEndpoint(provider),
    hasApiKey: Boolean(apiKey),
    keyLength: apiKey.length,
    keyTail: apiKey ? apiKey.slice(-6) : "",
    keySource: provider === "wavespeed"
      ? (process.env.WAVESPEED_API_KEY ? "process.env.WAVESPEED_API_KEY" : "missing")
      : (process.env.PHOTOROOM_API_KEY ? "process.env.PHOTOROOM_API_KEY" : "missing")
  };
}

/**
 * 功能：把远端错误响应转换成可读文本。
 * 参数：response fetch 返回对象。
 * 返回：错误描述字符串。
 * 异常：无。
 */
async function readErrorMessage(response) {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const raw = await response.text();
  if (!raw) {
    return `background removal request failed: ${response.status}`;
  }
  if (!contentType.includes("application/json")) {
    return raw.slice(0, 1000);
  }
  try {
    const payload = JSON.parse(raw);
    return payload.message || payload.error || payload.detail || raw.slice(0, 1000);
  } catch (error) {
    return raw.slice(0, 1000);
  }
}

/**
 * 功能：把远端图片 URL 下载到本地文件。
 * 参数：url 图片 URL，targetPath 目标文件绝对路径，label 失败提示前缀。
 * 返回：输出文件绝对路径。
 * 异常：下载失败时抛出异常。
 */
async function downloadToFile(url, targetPath, label) {
  ensureParentDir(targetPath);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label}下载失败: ${response.status}`);
  }
  fs.writeFileSync(targetPath, Buffer.from(await response.arrayBuffer()));
  return targetPath;
}

/**
 * 功能：把阿里云 SDK 异常转换成稳定可读的中文错误文本。
 * 参数：error SDK 抛出的异常对象。
 * 返回：字符串。
 * 异常：无。
 */
function buildAliyunErrorMessage(error) {
  if (!error) {
    return "unknown aliyun imageseg error";
  }
  const parts = [
    error.code || "",
    error.message || "",
    error.data && typeof error.data === "object" ? JSON.stringify(error.data) : ""
  ].filter(Boolean);
  return parts.join(" | ") || String(error);
}

/**
 * 功能：识别阿里云对远程图片地址的校验失败。
 * 参数：error SDK 抛出的异常对象。
 * 返回：布尔值。
 * 异常：无。
 */
function isAliyunInvalidImageUrl(error) {
  const code = String((error && error.code) || "");
  const message = String((error && error.message) || "");
  return code === "InvalidImage.URL" || /InvalidImage\.URL|图片链接非法/i.test(message);
}

/**
 * 功能：判断给定字符串是否是可直接供阿里云抓取的远程地址。
 * 参数：value 任意输入值。
 * 返回：布尔值。
 * 异常：无。
 */
function isRemoteHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

/**
 * 功能：创建阿里云分割抠图 SDK Client。
 * 参数：无。
 * 返回：SDK Client 实例。
 * 异常：凭证缺失时抛出异常。
 */
function createAliyunImagesegClient() {
  const credentials = getAliyunCredentials();
  if (!credentials.accessKeyId || !credentials.accessKeySecret) {
    throw new Error("未配置阿里云 AccessKey，无法执行人物抠图");
  }
  return new ImagesegClient({
    accessKeyId: credentials.accessKeyId,
    accessKeySecret: credentials.accessKeySecret,
    securityToken: credentials.securityToken || undefined,
    regionId: getAliyunRegion(),
    endpoint: getAliyunEndpoint()
  });
}

/**
 * 功能：读取阿里云 SDK 的运行时超时配置。
 * 参数：无。
 * 返回：运行时配置对象。
 * 异常：无。
 */
function getAliyunRuntimeOptions() {
  return {
    connectTimeout: Number(process.env.ALIYUN_IMAGESEG_CONNECT_TIMEOUT || 10000),
    readTimeout: Number(process.env.ALIYUN_IMAGESEG_READ_TIMEOUT || 120000)
  };
}

/**
 * 功能：把本地文件编码为 data URL，便于远端 API 直接消费。
 * 参数：sourcePath 原图绝对路径，mimeType 文件类型。
 * 返回：data URL 字符串。
 * 异常：文件读取失败时抛出异常。
 */
function fileToDataUrl(sourcePath, mimeType) {
  const imageBuffer = fs.readFileSync(sourcePath);
  return `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
}

/**
 * 功能：从响应载荷中提取 WaveSpeed 的任务 ID。
 * 参数：payload 接口响应对象。
 * 返回：任务 ID 字符串。
 * 异常：无。
 */
function extractWaveSpeedRequestId(payload) {
  if (!payload || typeof payload !== "object") return "";
  return payload.request_id
    || payload.id
    || payload.prediction_id
    || payload.data?.request_id
    || payload.data?.id
    || "";
}

/**
 * 功能：从响应载荷中提取 WaveSpeed 输出。
 * 参数：payload 接口响应对象。
 * 返回：输出字符串，可能是 URL 或 base64/data URL。
 * 异常：无。
 */
function extractWaveSpeedOutput(payload) {
  if (!payload || typeof payload !== "object") return "";
  const outputs = payload.outputs
    || payload.data?.outputs
    || payload.output
    || payload.data?.output
    || [];
  if (Array.isArray(outputs) && outputs[0]) {
    return outputs[0];
  }
  return payload.image || payload.url || payload.output_url || "";
}

/**
 * 功能：从响应载荷中提取 WaveSpeed 任务状态。
 * 参数：payload 接口响应对象。
 * 返回：状态字符串。
 * 异常：无。
 */
function extractWaveSpeedStatus(payload) {
  if (!payload || typeof payload !== "object") return "";
  return String(payload.status || payload.data?.status || "").toLowerCase();
}

/**
 * 功能：把 WaveSpeed 输出写入本地 PNG 文件。
 * 参数：output 输出内容，targetPath 目标文件绝对路径。
 * 返回：输出文件绝对路径。
 * 异常：输出为空、下载失败或 base64 非法时抛出异常。
 */
async function writeWaveSpeedOutput(output, targetPath) {
  if (!output) {
    throw new Error("WaveSpeed 未返回可用抠图结果");
  }
  ensureParentDir(targetPath);
  if (output.startsWith("data:")) {
    const base64 = output.split(",", 2)[1] || "";
    fs.writeFileSync(targetPath, Buffer.from(base64, "base64"));
    return targetPath;
  }
  if (/^[A-Za-z0-9+/=\r\n]+$/.test(output) && !/^https?:\/\//i.test(output)) {
    fs.writeFileSync(targetPath, Buffer.from(output, "base64"));
    return targetPath;
  }
  const response = await fetch(output);
  if (!response.ok) {
    throw new Error(`WaveSpeed 结果下载失败: ${response.status}`);
  }
  fs.writeFileSync(targetPath, Buffer.from(await response.arrayBuffer()));
  return targetPath;
}

/**
 * 功能：调用阿里云分割抠图 SDK，把原图转换成透明 PNG。
 * 参数：sourcePath 原图绝对路径，targetPath 输出 PNG 绝对路径，options 可选参数。
 * 返回：输出文件绝对路径。
 * 异常：接口调用失败或结果下载失败时抛出异常。
 */
async function removeBackgroundWithAliyun(sourcePath, targetPath, options = {}) {
  const client = createAliyunImagesegClient();
  const runtime = getAliyunRuntimeOptions();
  const sourceUrl = isRemoteHttpUrl(options.sourceUrl) ? String(options.sourceUrl).trim() : "";
  const localHdRequest = {
    imageURLObject: fs.createReadStream(sourcePath)
  };
  const localBodyRequest = {
    imageURLObject: fs.createReadStream(sourcePath),
    returnForm: options.crop === false ? undefined : "crop"
  };

  async function runAliyunAttempt(useRemoteUrl) {
    const hdRequest = useRemoteUrl
      ? new ImagesegModels.SegmentHDBodyRequest({ imageURL: sourceUrl })
      : localHdRequest;
    try {
      const hdResponse = useRemoteUrl
        ? await client.segmentHDBody(hdRequest)
        : await client.segmentHDBodyAdvance(hdRequest, runtime);
      const hdUrl = hdResponse?.body?.data?.imageURL || hdResponse?.data?.imageURL || "";
      if (!hdUrl) {
        throw new Error("阿里云高清人体分割未返回结果 URL");
      }
      return downloadToFile(hdUrl, targetPath, "阿里云高清人体分割结果");
    } catch (hdError) {
      const fallbackRequest = useRemoteUrl
        ? new ImagesegModels.SegmentBodyRequest({
          imageURL: sourceUrl,
          returnForm: options.crop === false ? undefined : "crop"
        })
        : localBodyRequest;
      try {
        const bodyResponse = useRemoteUrl
          ? await client.segmentBody(fallbackRequest)
          : await client.segmentBodyAdvance(fallbackRequest, runtime);
        const bodyUrl = bodyResponse?.body?.data?.imageURL || bodyResponse?.data?.imageURL || "";
        if (!bodyUrl) {
          throw new Error("阿里云人体分割未返回结果 URL");
        }
        return downloadToFile(bodyUrl, targetPath, "阿里云人体分割结果");
      } catch (bodyError) {
        throw new Error(`高清人体分割失败(${buildAliyunErrorMessage(hdError)}); 回退人体分割失败(${buildAliyunErrorMessage(bodyError)})`);
      }
    }
  }

  if (sourceUrl) {
    try {
      return await runAliyunAttempt(true);
    } catch (remoteError) {
      if (!isAliyunInvalidImageUrl(remoteError)) {
        throw new Error(`人物抠图失败: ${remoteError.message || remoteError}`);
      }
      try {
        return await runAliyunAttempt(false);
      } catch (localError) {
        throw new Error(`人物抠图失败: 远程 URL 不被阿里云接受(${remoteError.message || remoteError}); 本地文件流回退失败(${localError.message || localError})`);
      }
    }
  }

  try {
    return await runAliyunAttempt(false);
  } catch (localOnlyError) {
    throw new Error(`人物抠图失败: ${localOnlyError.message || localOnlyError}`);
  }
}

/**
 * 功能：调用 PhotoRoom 抠图接口，把原图转换成透明 PNG。
 * 参数：sourcePath 原图绝对路径，targetPath 输出 PNG 绝对路径，options 可选参数。
 * 返回：输出文件绝对路径。
 * 异常：接口调用失败时抛出异常。
 */
async function removeBackgroundWithPhotoRoom(sourcePath, targetPath, options = {}) {
  const apiKey = getApiKey("photoroom");
  if (!apiKey) {
    throw new Error("未配置 PHOTOROOM_API_KEY，无法执行人物抠图");
  }

  const mimeType = options.mimeType || "image/png";
  const fileName = options.fileName || path.basename(sourcePath) || "input.png";
  const imageBuffer = fs.readFileSync(sourcePath);

  const form = new FormData();
  form.append("image_file", new Blob([imageBuffer], { type: mimeType }), fileName);
  form.append("format", "png");
  form.append("crop", options.crop === false ? "false" : "true");
  form.append("size", options.size || "full");

  const response = await fetch(PHOTOROOM_ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": apiKey
    },
    body: form
  });

  if (!response.ok) {
    const detail = await readErrorMessage(response);
    throw new Error(`人物抠图失败: ${detail}`);
  }

  ensureParentDir(targetPath);
  const outputBuffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(targetPath, outputBuffer);
  return targetPath;
}

/**
 * 功能：调用 WaveSpeed 抠图接口，把原图转换成透明 PNG。
 * 参数：sourcePath 原图绝对路径，targetPath 输出 PNG 绝对路径，options 可选参数。
 * 返回：输出文件绝对路径。
 * 异常：接口调用失败、轮询失败或下载失败时抛出异常。
 */
async function removeBackgroundWithWaveSpeed(sourcePath, targetPath, options = {}) {
  const apiKey = getApiKey("wavespeed");
  if (!apiKey) {
    throw new Error("未配置 WAVESPEED_API_KEY，无法执行人物抠图");
  }

  const mimeType = options.mimeType || "image/png";
  const payload = {
    image: fileToDataUrl(sourcePath, mimeType),
    enable_base64_output: true,
    enable_sync_mode: true
  };

  const submitResponse = await fetch(WAVESPEED_SUBMIT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!submitResponse.ok) {
    const detail = await readErrorMessage(submitResponse);
    throw new Error(`人物抠图失败: ${detail}`);
  }

  const submitPayload = await submitResponse.json();
  const immediateOutput = extractWaveSpeedOutput(submitPayload);
  if (immediateOutput) {
    return writeWaveSpeedOutput(immediateOutput, targetPath);
  }

  const requestId = extractWaveSpeedRequestId(submitPayload);
  if (!requestId) {
    throw new Error("WaveSpeed 未返回任务 ID，无法继续轮询抠图结果");
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const resultResponse = await fetch(`${WAVESPEED_RESULT_ENDPOINT}/${encodeURIComponent(requestId)}/result`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
    if (!resultResponse.ok) {
      const detail = await readErrorMessage(resultResponse);
      throw new Error(`WaveSpeed 抠图轮询失败: ${detail}`);
    }
    const resultPayload = await resultResponse.json();
    const status = extractWaveSpeedStatus(resultPayload);
    const output = extractWaveSpeedOutput(resultPayload);
    if (output) {
      return writeWaveSpeedOutput(output, targetPath);
    }
    if (status === "failed" || status === "error" || status === "canceled") {
      const reason = resultPayload.error || resultPayload.message || "unknown wavespeed error";
      throw new Error(`WaveSpeed 抠图失败: ${reason}`);
    }
  }

  throw new Error("WaveSpeed 抠图超时，请稍后重试");
}

/**
 * 功能：根据当前配置选择具体 provider，并执行人物抠图。
 * 参数：sourcePath 原图绝对路径，targetPath 输出 PNG 绝对路径，options 可选参数。
 * 返回：输出文件绝对路径。
 * 异常：provider 未配置或接口调用失败时抛出异常。
 */
async function removeBackground(sourcePath, targetPath, options = {}) {
  const provider = getProviderName();
  if (provider === "aliyun") {
    return removeBackgroundWithAliyun(sourcePath, targetPath, options);
  }
  if (provider === "wavespeed") {
    return removeBackgroundWithWaveSpeed(sourcePath, targetPath, options);
  }
  return removeBackgroundWithPhotoRoom(sourcePath, targetPath, options);
}

module.exports = {
  getDebugConfig,
  removeBackground
};
