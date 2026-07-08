const fs = require("fs");
const assetStore = require("./asset-store");
const imageDownloader = require("./image-downloader");
const publicImageService = require("./public-image-service");

function closetAssetId(item = {}) {
  return `closet-${item.itemId || item.id || "item"}`;
}

function closetAssetPath(item = {}) {
  return `${assetStore.runtimePrefix}/storage/closet/${closetAssetId(item)}.jpg`;
}

function closetPublicImageUrl(item = {}) {
  return item.publicImageUrl
    || item.remoteImageUrl
    || item.sourceImageUrl
    || item.imageUrl
    || (/^https?:\/\//i.test(item.image || "") ? item.image : "");
}

async function ensureClosetAsset(item, req, downloader = imageDownloader) {
  const publicImageUrl = closetPublicImageUrl(item);
  if (!publicImageUrl) return null;

  const id = closetAssetId(item);
  const localPath = closetAssetPath(item);
  let existing = assetStore.getAsset(id, req);
  const existingFile = existing && existing.localPath ? assetStore.resolveLocalFile(existing.localPath) : "";
  if (!existing || !existingFile || !fs.existsSync(existingFile)) {
    const downloadImageToTarget = downloader.downloadImageToTarget || downloader.download;
    const downloaded = await downloadImageToTarget(publicImageUrl, localPath);
    const resolvedFile = assetStore.resolveLocalFile(downloaded.localPath);
    const published = await publicImageService.publishLocalImage(resolvedFile, req, {
      id,
      type: "closet_item",
      group: "user_closet",
      slot: item.category || "",
      source: "mock_closet_seed",
      meta: {
        closetItemId: item.itemId || item.id || "",
        sourceImageUrl: publicImageUrl,
        imageSourceUrl: item.imageSourceUrl || "",
        imageLicense: item.imageLicense || ""
      }
    });
    existing = {
      ...published.asset,
      localUrl: published.localUrl,
      publicImageUrl: published.remoteUrl || publicImageUrl,
      fileServerError: published.fileServerError
    };
  } else {
    existing = {
      ...existing,
      localUrl: `${assetStore.requestBaseUrl(req)}/assets/local${existing.localPath}`,
      publicImageUrl: existing.remoteUrl || publicImageUrl
    };
  }
  return existing;
}

async function publicClosetItems(items = [], req, downloader = imageDownloader) {
  const nextItems = [];
  for (const item of items || []) {
    const publicImageUrl = closetPublicImageUrl(item);
    let imageAsset = null;
    let image = item.image || "";
    let localImagePath = item.localImagePath || "";
    if (publicImageUrl) {
      try {
        imageAsset = await ensureClosetAsset(item, req, downloader);
        if (imageAsset) {
          image = imageAsset.localUrl || imageAsset.previewUrl || imageAsset.url || image;
          localImagePath = imageAsset.localPath || localImagePath;
        }
      } catch (error) {
        image = item.image || publicImageUrl;
      }
    }
    if (!imageAsset && (item.imageAssetId || item.localImagePath)) {
      imageAsset = item.imageAssetId
        ? assetStore.getAsset(item.imageAssetId, req)
        : assetStore.getAssetByLocalPath(item.localImagePath, req);
      if (imageAsset) {
        image = `${assetStore.requestBaseUrl(req)}/assets/local${imageAsset.localPath}`;
        localImagePath = imageAsset.localPath || localImagePath;
      }
    }
    nextItems.push({
      ...item,
      image,
      imageAsset,
      localImagePath,
      publicImageUrl: imageAsset && imageAsset.publicImageUrl ? imageAsset.publicImageUrl : publicImageUrl,
      imageDownloadStatus: imageAsset ? "local_ready" : (publicImageUrl ? "remote_fallback" : "missing")
    });
  }
  return nextItems;
}

module.exports = {
  publicClosetItems,
  closetPublicImageUrl
};
