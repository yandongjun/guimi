const staticAssets = [
  {
    id: "tryon-user-a-office",
    type: "generated_tryon",
    group: "daily_tryon",
    localPath: "/packages/test-assets/generated/users/user-a-office.png",
    mimeType: "image/png",
    storage: "repo",
    source: "seed"
  },
  {
    id: "tryon-user-b-office",
    type: "generated_tryon",
    group: "daily_tryon",
    localPath: "/packages/test-assets/generated/users/user-b-office.png",
    mimeType: "image/png",
    storage: "repo",
    source: "seed"
  },
  {
    id: "tryon-user-c-shopping",
    type: "generated_tryon",
    group: "daily_tryon",
    localPath: "/packages/test-assets/generated/users/user-c-shopping.png",
    mimeType: "image/png",
    storage: "repo",
    source: "seed"
  },
  {
    id: "tryon-user-d-party",
    type: "generated_tryon",
    group: "daily_tryon",
    localPath: "/packages/test-assets/generated/users/user-d-party.png",
    mimeType: "image/png",
    storage: "repo",
    source: "seed"
  },
  {
    id: "tryon-user-e-dating",
    type: "generated_tryon",
    group: "daily_tryon",
    localPath: "/packages/test-assets/generated/users/user-e-dating.png",
    mimeType: "image/png",
    storage: "repo",
    source: "seed"
  },
  {
    id: "body-scan-front-example",
    type: "body_scan_example",
    group: "body_scan_guides",
    slot: "front",
    localPath: "/packages/test-assets/generated/three/profile-short-curvy-front.png",
    previewPath: "/packages/test-assets/generated/three/profile-short-curvy-front-preview.png",
    mimeType: "image/png",
    storage: "repo",
    source: "guide"
  },
  {
    id: "body-scan-side-example",
    type: "body_scan_example",
    group: "body_scan_guides",
    slot: "side",
    localPath: "/packages/test-assets/generated/three/profile-short-curvy-side.png",
    previewPath: "/packages/test-assets/generated/three/profile-short-curvy-side-preview.png",
    mimeType: "image/png",
    storage: "repo",
    source: "guide"
  },
  {
    id: "body-scan-back-example",
    type: "body_scan_example",
    group: "body_scan_guides",
    slot: "back",
    localPath: "/packages/test-assets/generated/three/profile-short-curvy-back.png",
    previewPath: "/packages/test-assets/generated/three/profile-short-curvy-back-preview.png",
    mimeType: "image/png",
    storage: "repo",
    source: "guide"
  }
];

const outfitAssetMap = {
  "user-a-office": "tryon-user-a-office",
  "user-b-office": "tryon-user-b-office",
  "user-c-shopping": "tryon-user-c-shopping",
  "user-d-party": "tryon-user-d-party",
  "user-e-dating": "tryon-user-e-dating"
};

function getAssetById(id) {
  return staticAssets.find((asset) => asset.id === id) || null;
}

function getAssetByLocalPath(localPath) {
  return staticAssets.find((asset) =>
    asset.localPath === localPath || asset.previewPath === localPath
  ) || null;
}

function listStaticAssets(filter = {}) {
  return staticAssets.filter((asset) => {
    if (filter.group && asset.group !== filter.group) return false;
    if (filter.type && asset.type !== filter.type) return false;
    if (filter.slot && asset.slot !== filter.slot) return false;
    return true;
  });
}

function getOutfitAssetId(jobId) {
  return outfitAssetMap[jobId] || "";
}

module.exports = {
  staticAssets,
  outfitAssetMap,
  getAssetById,
  getAssetByLocalPath,
  getOutfitAssetId,
  listStaticAssets
};
