const assert = require("assert");
const fs = require("fs");
const path = require("path");

process.env.GUIMI_RUNTIME_DIR = path.join(__dirname, "storage", "test-public-image-service");

const publicImageService = require("./public-image-service");
const assetStore = require("./asset-store");

async function main() {
  const sourceDir = path.join(__dirname, "storage", "test-public-image-service-source");
  fs.mkdirSync(sourceDir, { recursive: true });
  const filePath = path.join(sourceDir, "cream-blazer.jpg");
  fs.writeFileSync(filePath, Buffer.from([1, 2, 3, 4]));

  const published = await publicImageService.publishLocalImage(filePath, {
    headers: { host: "127.0.0.1:8787" }
  }, {
    id: "asset-test-blazer",
    type: "closet_item",
    group: "user_closet",
    slot: "outerwear",
    originalName: "cream-blazer.jpg",
    source: "unit_test",
    aliyunOssUploader: {
      isConfigured: () => false
    },
    uploader: {
      isConfigured: () => true,
      upload: async () => ({ id: "remote-1", publicUrl: "https://cdn.example.com/cream-blazer.jpg" })
    }
  });

  assert.equal(published.assetId, "asset-test-blazer");
  assert.equal(published.remoteUrl, "https://cdn.example.com/cream-blazer.jpg");
  assert.equal(published.url, "https://cdn.example.com/cream-blazer.jpg");
  assert.match(published.localUrl, /^http:\/\/127\.0\.0\.1:8787\/assets\/local\//);
  assert.equal(assetStore.getAsset("asset-test-blazer", { headers: { host: "127.0.0.1:8787" } }).remoteUrl, published.remoteUrl);

  const ossPublished = await publicImageService.publishLocalImage(filePath, {
    headers: { host: "127.0.0.1:8787" }
  }, {
    id: "asset-test-oss-blazer",
    type: "closet_item",
    group: "user_closet",
    originalName: "cream-blazer.jpg",
    source: "unit_test",
    aliyunOssUploader: {
      isConfigured: () => true,
      upload: async () => ({ id: "oss-1", objectName: "guimi/test/cream-blazer.jpg", publicUrl: "https://bucket.oss-cn-hangzhou.aliyuncs.com/guimi/test/cream-blazer.jpg" })
    },
    uploader: {
      isConfigured: () => true,
      upload: async () => {
        throw new Error("file server should not be used when oss succeeds");
      }
    }
  });

  assert.equal(ossPublished.remoteUrl, "https://bucket.oss-cn-hangzhou.aliyuncs.com/guimi/test/cream-blazer.jpg");
  assert.equal(ossPublished.remoteProvider, "aliyun_oss");
  assert.equal(assetStore.getAsset("asset-test-oss-blazer", { headers: { host: "127.0.0.1:8787" } }).meta.remoteProvider, "aliyun_oss");
}

main()
  .then(() => console.log("public image service checks passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
