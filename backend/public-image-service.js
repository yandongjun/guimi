const path = require("path");
const assetStore = require("./asset-store");
const fileServerUploader = require("./file-server-uploader");
const aliyunOssUploader = require("./aliyun-oss-uploader");

function defaultUploader() {
  return {
    isConfigured: fileServerUploader.isFileServerConfigured,
    upload: fileServerUploader.uploadToFileServer
  };
}

function localMetaFromFile(filePath, req, size = {}) {
  const localPath = assetStore.publicLocalPathForAbsolute(filePath);
  if (!localPath) {
    throw new Error(`无法为文件生成资源信息: ${filePath}`);
  }
  const localUrl = `${assetStore.requestBaseUrl(req)}/assets/local${localPath}`;
  return {
    width: size.width || 0,
    height: size.height || 0,
    localPath,
    localUrl,
    mimeType: assetStore.mimeTypeFor(filePath)
  };
}

async function uploadRemote(filePath, meta, options = {}) {
  const aliyunOss = options.aliyunOssUploader || {
    isConfigured: aliyunOssUploader.isAliyunOssConfigured,
    upload: aliyunOssUploader.uploadToAliyunOss
  };
  let aliyunOssError = "";
  if (aliyunOss.isConfigured()) {
    try {
      const result = await aliyunOss.upload(filePath, {
        originalName: options.originalName || path.basename(filePath),
        mimeType: meta.mimeType,
        source: options.source || "public_image_service"
      });
      return {
        remoteUrl: result.publicUrl || "",
        remoteProvider: "aliyun_oss",
        remoteId: result.objectName || result.id || "",
        fileServerId: "",
        fileServerError: "",
        aliyunOssError: "",
        aliyunOssResult: result
      };
    } catch (error) {
      aliyunOssError = error.message || "unknown aliyun oss upload error";
    }
  }

  const uploader = options.uploader || defaultUploader();
  if (!uploader.isConfigured()) {
    return {
      remoteUrl: "",
      remoteProvider: "",
      remoteId: "",
      fileServerId: "",
      fileServerError: aliyunOssError || "",
      aliyunOssError,
      aliyunOssResult: null
    };
  }
  try {
    const result = await uploader.upload(filePath, {
      originalName: options.originalName || path.basename(filePath),
      mimeType: meta.mimeType
    });
    return {
      remoteUrl: result.publicUrl || "",
      remoteProvider: "file_server",
      remoteId: result.id || result.fileId || "",
      fileServerId: result.id || "",
      fileServerError: aliyunOssError,
      aliyunOssError,
      aliyunOssResult: null
    };
  } catch (error) {
    return {
      remoteUrl: "",
      remoteProvider: "",
      remoteId: "",
      fileServerId: "",
      fileServerError: error.message || "unknown file server upload error",
      aliyunOssError,
      aliyunOssResult: null
    };
  }
}

async function publishLocalImage(filePath, req, options = {}) {
  const baseMeta = localMetaFromFile(filePath, req, options.size || {});
  const remote = await uploadRemote(filePath, baseMeta, options);
  const asset = assetStore.registerUploadedAsset({
    id: options.id,
    type: options.type || "image",
    group: options.group || "published_images",
    slot: options.slot || "",
    localPath: baseMeta.localPath,
    remoteUrl: remote.remoteUrl,
    previewRemoteUrl: remote.remoteUrl,
    mimeType: baseMeta.mimeType,
    source: options.source || "public_image_service",
    originalName: options.originalName || path.basename(filePath),
    meta: {
      ...(options.meta || {}),
      remoteProvider: remote.remoteProvider,
      remoteId: remote.remoteId,
      fileServerUrl: remote.remoteUrl,
      fileServerId: remote.fileServerId,
      fileServerError: remote.fileServerError,
      aliyunOssError: remote.aliyunOssError,
      aliyunOss: remote.aliyunOssResult
    }
  }, req);
  return {
    assetId: asset.id,
    localPath: asset.localPath,
    localUrl: baseMeta.localUrl,
    remoteUrl: remote.remoteUrl,
    url: remote.remoteUrl || baseMeta.localUrl,
    previewUrl: remote.remoteUrl || baseMeta.localUrl,
    mimeType: asset.mimeType,
    fileServerError: remote.fileServerError,
    aliyunOssError: remote.aliyunOssError,
    remoteProvider: remote.remoteProvider,
    asset
  };
}

module.exports = {
  localMetaFromFile,
  publishLocalImage
};
