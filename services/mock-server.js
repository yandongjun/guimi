const mock = require("../data/mock");
const assets = require("../data/assets");

const USE_MANUAL_TEST_IMAGES = true;

const state = {
  activeUserId: "user-a",
  generationUsed: 0,
  adUnlocks: 0,
  generations: {},
  ratings: []
};

const wait = (payload, delay = 220) =>
  new Promise((resolve) => {
    setTimeout(() => resolve({ code: 0, data: payload }), delay);
  });

const fail = (message, delay = 180) =>
  new Promise((resolve) => {
    setTimeout(() => resolve({ code: 1, message }), delay);
  });

function quota() {
  const currentUser = activeUser();
  const baseLimit = currentUser.membership === "paid" ? 10 : 2;
  const limit = baseLimit + (currentUser.membership === "paid" ? 0 : state.adUnlocks);
  return {
    membership: currentUser.membership,
    baseLimit,
    limit,
    used: state.generationUsed,
    remaining: Math.max(limit - state.generationUsed, 0),
    adUnlocks: state.adUnlocks,
    maxAdUnlocks: 3
  };
}

function activeUser() {
  return mock.testUsers.find((item) => item.id === state.activeUserId) || mock.testUsers[0] || mock.user;
}

function activeBodyProfile() {
  return activeUser().bodyProfile || mock.bodyProfile;
}

function activeAura() {
  const currentUser = activeUser();
  return {
    ...mock.dailyAura,
    zodiac: currentUser.zodiac,
    luckyColor: currentUser.favoriteColors[0] || mock.dailyAura.luckyColor
  };
}

function activeWeather() {
  return {
    ...mock.weather,
    city: activeUser().city
  };
}

function visualNotesFor(profile) {
  const tags = profile.strategyTags || [];
  const noteMap = {
    define_shoulder: "补肩线",
    raise_waistline: "高腰线",
    extend_leg: "拉长腿",
    petite_extend: "显高",
    light_shoes: "轻量鞋",
    upper_focus: "上身重点",
    smooth_bottom: "垂顺下装",
    same_color_shoes: "鞋裤同色",
    open_neckline: "V领开襟",
    vertical_line: "纵向线",
    clean_bottom: "简洁下装",
    crop_top: "短上衣",
    high_waist: "高腰线"
  };
  const notes = tags.map((tag) => noteMap[tag]).filter(Boolean);
  const fallback = profile.strategies || ["优化比例", "提高腰线"];
  return (notes.length ? notes : fallback).slice(0, 2).map((text, index) => ({
    text,
    type: index === 0 ? "body" : "style"
  }));
}

function summaryReasonsFor(profile, scene) {
  const strategy = (profile.strategies && profile.strategies[0]) || "优化比例";
  const color = activeUser().favoriteColors[0] || "低饱和色";
  return [
    { name: "比例", copy: strategy },
    { name: "颜色", copy: `${color}提气色` },
    { name: "场景", copy: `${scene}更稳` }
  ];
}

function reasonsFor(profile, scene) {
  const strategies = profile.strategies || [];
  const avoid = profile.avoid || [];
  return [
    `身材：${profile.bodyType}，这套重点是${strategies.slice(0, 2).join("、") || "优化比例"}。`,
    `颜色：优先用${activeUser().favoriteColors.slice(0, 2).join("、")}，避免显沉或过度用力。`,
    `场景：${scene}需要能现实穿，${avoid[0] ? `先避开${avoid[0]}。` : "不做夸张造型。"}`
  ];
}

function sceneKey(scene) {
  const map = {
    "上班": "office",
    "约会": "dating",
    "聚会": "party",
    "出游": "travel",
    "逛街": "shopping"
  };
  return map[scene] || scene || "daily";
}

function outfitBriefFor(user, profile, scene, outfit) {
  const targetScene = sceneKey(scene);
  const strategies = profile.strategyTags || [];
  const rejected = user.rejectedStyleTags || [];
  const ranked = mock.closet
    .map((item) => {
      let score = 0;
      if ((item.sceneTags || []).includes(targetScene)) score += 4;
      score += (item.bodyStrategyTags || []).filter((tag) => strategies.includes(tag)).length * 3;
      score -= (item.styleTags || []).filter((tag) => rejected.includes(tag)).length * 4;
      return { item, score };
    })
    .sort((left, right) => right.score - left.score);
  const picked = ranked.filter((entry) => entry.score > 0).slice(0, 2).map((entry) => entry.item);
  const fallback = ranked.slice(0, 1).map((entry) => entry.item);
  const usedClosetItems = picked.length ? picked : fallback;
  const categories = new Set(usedClosetItems.map((item) => item.category));
  const trendFillSlots = [];
  if (!categories.has("top")) trendFillSlots.push("内搭");
  if (!categories.has("bottom") && !categories.has("dress")) trendFillSlots.push("下装");
  if (!categories.has("shoes")) trendFillSlots.push("鞋");
  const usedClosetItemLabels = usedClosetItems.map((item) => item.name || item.subCategoryLabel || item.categoryLabel);

  return {
    scene,
    mood: outfit.displayMood || outfit.mood || "",
    title: outfit.displayTitle || outfit.title || "",
    usedClosetItems,
    usedClosetItemIds: usedClosetItems.map((item) => item.itemId || item.id),
    usedClosetItemLabels,
    trendFillSlots: trendFillSlots.slice(0, 2),
    sourceMix: usedClosetItems.length ? ["wardrobe", "trend_library"] : ["trend_library"],
    closetUsageCopy: usedClosetItemLabels.length
      ? `今天用了你衣橱里的${usedClosetItemLabels.join("、")}。`
      : "今天先用趋势库搭一版，上传常穿衣服后会更像你的日常。"
  };
}

function localAsset(id) {
  const asset = assets.getAssetById(id);
  if (!asset) return null;
  const previewUrl = asset.previewPath || asset.localPath;
  return {
    ...asset,
    url: asset.localPath,
    previewUrl
  };
}

function userOutfit(scene) {
  const currentUser = activeUser();
  const profile = activeBodyProfile();
  const base = mock.outfitByScene[scene] || mock.outfitByScene["上班"];
  const job = mock.manualImageJobs.find((item) => item.userId === currentUser.id && item.scene === scene);
  const assetId = job ? assets.getOutfitAssetId(job.id) : "";
  const tryOnAsset = assetId ? localAsset(assetId) : null;
  const brief = outfitBriefFor(currentUser, profile, scene, base);
  return {
    ...base,
    id: job ? job.id : `${base.id}-${currentUser.id}`,
    title: job ? job.outfitTitle : base.title,
    displayTitle: job ? job.outfitTitle : base.displayTitle,
    targetUserId: currentUser.id,
    targetUserName: currentUser.nickname,
    expectedImagePath: job ? job.imagePath : "",
    tryOnAsset,
    tryOnImage: USE_MANUAL_TEST_IMAGES && tryOnAsset ? tryOnAsset.previewUrl : "/assets/generated/tryon-model-transparent.png",
    visualNotes: visualNotesFor(profile),
    summaryReasons: summaryReasonsFor(profile, scene),
    reasons: reasonsFor(profile, scene),
    outfitBrief: brief,
    usedClosetItems: brief.usedClosetItems,
    usedClosetItemIds: brief.usedClosetItemIds,
    usedClosetItemLabels: brief.usedClosetItemLabels,
    trendFillSlots: brief.trendFillSlots,
    sourceMix: brief.sourceMix,
    closetUsageCopy: brief.closetUsageCopy
  };
}

function withGenerationMeta(outfit, scene) {
  const brief = outfitBriefFor(activeUser(), activeBodyProfile(), scene, outfit);
  const generationId = `${outfit.id}-${Date.now()}`;
  const payload = {
    generationId,
    status: "success",
    scene,
    ...outfit,
    outfitBrief: brief,
    usedClosetItems: brief.usedClosetItems,
    usedClosetItemIds: brief.usedClosetItemIds,
    usedClosetItemLabels: brief.usedClosetItemLabels,
    trendFillSlots: brief.trendFillSlots,
    sourceMix: brief.sourceMix,
    styleTags: Array.from(new Set(brief.usedClosetItems.flatMap((item) => item.styleTags || []))),
    closetUsageCopy: brief.closetUsageCopy,
    quota: quota()
  };
  state.generations[generationId] = payload;
  return payload;
}

function getHome() {
  const currentUser = activeUser();
  return wait({
    user: currentUser,
    testUsers: mock.testUsers,
    weather: activeWeather(),
    dailyAura: activeAura(),
    bodyProfile: activeBodyProfile(),
    dailyOutfit: userOutfit(currentUser.scenes[0] || "上班"),
    closetCount: mock.closet.length,
    trends: mock.trendItems,
    sceneOptions: mock.sceneOptions,
    quota: quota()
  });
}

function getDailyOutfit(params = {}) {
  const scene = params.scene || "上班";
  const outfit = userOutfit(scene);
  return wait({
    weather: { ...activeWeather(), city: params.city || activeWeather().city },
    dailyAura: activeAura(),
    luckyColor: activeAura().luckyColor,
    favoriteColors: activeUser().favoriteColors,
    outfit,
    trendItems: mock.trendItems,
    quota: quota()
  });
}

function generateOutfit(payload = {}) {
  const currentQuota = quota();
  if (currentQuota.remaining <= 0) {
    return fail("今天的生成次数已经用完了，明天再来，或升级会员获得 10 次生成。", 220);
  }

  const scene = payload.scene || "上班";
  const outfit = userOutfit(scene);
  state.generationUsed += 1;

  return wait({
    ...withGenerationMeta(outfit, scene),
    quota: quota()
  }, 700);
}

function getGeneration(payload = {}) {
  const generation = state.generations[payload.id] || withGenerationMeta(userOutfit("上班"), "上班");
  return wait(generation);
}

function rateGeneration(payload = {}) {
  const rating = {
    id: `rating-${Date.now()}`,
    generationId: payload.generationId,
    scores: payload.scores || {},
    styleTags: payload.styleTags || [],
    reason: payload.reason || "",
    createdAt: new Date().toISOString()
  };
  state.ratings.push(rating);
  const scores = rating.scores || {};
  if (Number(scores.fashion || 0) <= 2 || Number(scores.wearable || 0) <= 2) {
    const user = activeUser();
    const rejected = new Set(user.rejectedStyleTags || []);
    (rating.styleTags || []).forEach((tag) => rejected.add(tag));
    user.rejectedStyleTags = Array.from(rejected);
  }
  return wait({
    saved: true,
    rating,
    fashionProfileUpdate: {
      favoriteStyles: ["clean_fit", "commute"],
      reinforcedTags: ["raise_waistline", "define_shoulder"],
      rejectedStyleTags: activeUser().rejectedStyleTags || []
    }
  });
}

function getQuota() {
  return wait(quota());
}

function unlockAdGeneration() {
  if (activeUser().membership === "paid") {
    return wait({ quota: quota(), unlocked: false, reason: "paid_user" });
  }
  if (state.adUnlocks >= 3) {
    return fail("今天看广告解锁次数也用完了，可以明天再来或开通米粒 Plus。");
  }
  state.adUnlocks += 1;
  return wait({
    unlocked: true,
    quota: quota(),
    message: "已解锁 1 张试穿图"
  });
}

function subscribePlus() {
  activeUser().membership = "paid";
  return wait({
    subscribed: true,
    quota: quota(),
    membership: "paid"
  });
}

function analyzeBodyScan(payload = {}) {
  const photos = payload.photos || {};
  const photoSlots = Object.keys(photos).filter((key) => photos[key]);
  return wait({
    ...activeBodyProfile(),
    photoSlots,
    confidence: 0.82,
    confidencePercent: 82,
    nextStep: "档案已建立，可以去首页选择场景生成今日试穿图。"
  }, 620);
}

function evaluateOutfit(payload = {}) {
  return wait({
    ...mock.evaluation,
    image: payload.image || "",
    savedToCloset: true,
    generatedTryOnPrompt: userOutfit(activeUser().scenes[0] || "上班").renderPrompt
  }, 520);
}

function getTestUsers() {
  return wait({
    activeUserId: state.activeUserId,
    users: mock.testUsers,
    imageJobs: mock.manualImageJobs
  });
}

function getAssets(payload = {}) {
  return wait({
    items: assets.listStaticAssets(payload).map((asset) => localAsset(asset.id))
  }, 120);
}

function uploadAsset(payload = {}) {
  const asset = {
    id: `mock-upload-${Date.now()}`,
    type: payload.type || "user_upload",
    group: payload.group || "user_uploads",
    slot: payload.slot || "",
    localPath: payload.filePath || "",
    previewPath: payload.filePath || "",
    url: payload.filePath || "",
    previewUrl: payload.filePath || "",
    source: "mock_upload"
  };
  return wait(asset, 160);
}

function selectTestUser(payload = {}) {
  const exists = mock.testUsers.some((item) => item.id === payload.userId);
  if (!exists) return fail("测试用户不存在");
  state.activeUserId = payload.userId;
  state.generationUsed = 0;
  state.adUnlocks = 0;
  return wait({
    activeUserId: state.activeUserId,
    user: activeUser(),
    bodyProfile: activeBodyProfile(),
    quota: quota()
  });
}

function getCloset() {
  return wait({
    items: mock.closet,
    gaps: [
      "缺少一件轻薄防风短外套，适合出游和早晚温差。",
      "缺少米灰色高腰半裙，约会场景可以更柔和。",
      "银色小配饰较少，聚会场景缺少轻亮点。"
    ],
    stats: {
      total: mock.closet.length,
      colors: ["奶油白", "鼠尾草绿", "深靛蓝", "黑色"],
      readiness: 68
    }
  });
}

function addClosetItem(payload = {}) {
  return wait({
    id: `c${Date.now()}`,
    name: payload.name || "新衣物",
    category: payload.category || "unknown",
    color: payload.color || "待识别",
    tags: payload.tags || ["待整理"]
  }, 240);
}

function getSimilarProducts() {
  return wait({
    items: mock.similarProducts
  });
}

module.exports = {
  getHome,
  getDailyOutfit,
  generateOutfit,
  getGeneration,
  rateGeneration,
  getQuota,
  unlockAdGeneration,
  subscribePlus,
  analyzeBodyScan,
  evaluateOutfit,
  getCloset,
  addClosetItem,
  getSimilarProducts,
  getTestUsers,
  getAssets,
  uploadAsset,
  selectTestUser
};
