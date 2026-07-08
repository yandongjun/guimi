const assert = require("assert");
const path = require("path");

process.env.GUIMI_RUNTIME_DIR = path.join(__dirname, "storage", "test-closet-assets");
const { publicClosetItems } = require("./closet-assets");

async function main() {
  const sourceItems = [
    {
      id: "c-test",
      itemId: "c-test",
      name: "测试外套",
      category: "outerwear",
      image: "https://example.com/coat.jpg",
      imageSourceUrl: "https://example.com/source",
      imageLicense: "Test License"
    }
  ];
  const items = await publicClosetItems(sourceItems, {
    headers: { host: "127.0.0.1:8787" }
  }, {
    download: async () => ({
      localPath: "/__runtime__/storage/closet/c-test.jpg",
      mimeType: "image/jpeg",
      bytes: 1234
    })
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].publicImageUrl, "https://example.com/coat.jpg");
  assert.equal(items[0].imageSourceUrl, "https://example.com/source");
  assert.equal(items[0].imageAsset.localPath, "/__runtime__/storage/closet/c-test.jpg");
  assert.match(items[0].image, /^http:\/\/127\.0\.0\.1:8787\/assets\/local\/__runtime__\/storage\/closet\/c-test\.jpg/);
}

main()
  .then(() => console.log("closet asset checks passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
