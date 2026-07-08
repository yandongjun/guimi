const assert = require("assert");

const presenter = require("./image-job-presenter");

function main() {
  const req = { headers: { host: "127.0.0.1:8787" } };
  const job = {
    id: "img-test",
    imageUrl: "https://private.example.com/generated.jpg",
    remoteImageUrl: "https://oss.example.com/generated.jpg",
    updatedAt: "2026-06-11T08:22:04.405Z"
  };
  const asset = {
    localPath: "/__runtime__/generated/users/user-a-party.jpg",
    previewUrl: "https://oss.example.com/generated.jpg",
    url: "https://oss.example.com/generated.jpg",
    remoteUrl: "https://oss.example.com/generated.jpg"
  };

  const imageUrl = presenter.publicGeneratedImageUrl(job, asset, req);
  assert.match(imageUrl, /^http:\/\/127\.0\.0\.1:8787\/assets\/local\/__runtime__\/generated\/users\/user-a-party\.jpg\?/);

  assert.equal(
    presenter.recordTitleFor({
      outfitTitle: "\u5229\u843d\u5916\u5957 + \u4eae\u70b9\u914d\u9970",
      usedClosetItemLabels: ["\u77ed\u6b3e\u5976\u6cb9\u767d\u897f\u88c5", "\u9152\u7ea2\u8272\u534a\u8eab\u88d9"]
    }),
    "\u77ed\u6b3e\u5976\u6cb9\u767d\u897f\u88c5 + \u9152\u7ea2\u8272\u534a\u8eab\u88d9"
  );

  assert.equal(
    presenter.recordTitleFor({
      outfitTitle: "\u8584\u5916\u5957 + \u6e05\u723d\u5185\u642d",
      usedClosetItemLabels: []
    }),
    "\u8584\u5916\u5957 + \u6e05\u723d\u5185\u642d"
  );

  assert.equal(
    presenter.generatedTargetPathForJob("user-a", "\u805a\u4f1a", "img-abc123"),
    "/__runtime__/generated/users/user-a-party-img-abc123.jpg"
  );
}

main();
console.log("image job presenter checks passed");
