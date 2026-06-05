const api = require("../../services/api");

const themeMap = {
  beige: "米色",
  pink: "粉色",
  cool: "酷炫"
};

const REWARDED_AD_UNIT_ID = "";
const BLOCKING_IMAGE_JOB_STATUS = ["pending", "submitted", "queued", "running", "processing"];
const IMAGE_JOB_FIRST_POLL_DELAY_MS = 1200;
const IMAGE_JOB_POLL_DELAY_MS = 4000;
const IMAGE_JOB_TIMEOUT_MS = 5 * 60 * 1000;

function isImageJobBlocking(imageJob) {
  return Boolean(imageJob && BLOCKING_IMAGE_JOB_STATUS.includes(imageJob.status));
}

function sanitizeImageJob(imageJob) {
  if (!imageJob) return null;
  return {
    id: imageJob.id || "",
    status: imageJob.status || "",
    imageUrl: imageJob.imageUrl || "",
    imageAsset: imageJob.imageAsset || null,
    remoteImageUrl: imageJob.remoteImageUrl || "",
    errorMessage: imageJob.errorMessage || ""
  };
}

function isMissingTryOnPlaceholder(url = "") {
  return String(url || "").includes("/assets/generated/tryon-model-transparent.png");
}

function isInteractionLocked(page) {
  return Boolean(page && page.data && (page.data.generating || page.data.generationLocked));
}

function prepareHomeOutfit(outfit) {
  if (!outfit) return outfit;
  return {
    ...outfit,
    closetSourceText: (outfit.usedClosetItemLabels || []).join(" / ")
  };
}

Page({
  data: {
    loading: true,
    debugDisableChat: true,
    generating: false,
    generationLocked: false,
    generationHint: "",
    quotaModalOpen: false,
    unlockingAd: false,
    subscribing: false,
    todayLabel: "",
    weatherSummary: "",
    theme: "beige",
    themeLabel: "米色",
    themeMenuOpen: false,
    activeScene: "上班",
    sceneOptions: ["上班", "约会", "聚会", "出游", "更多"],
    themeOptions: [
      { key: "beige", label: "米色" },
      { key: "pink", label: "粉色" },
      { key: "cool", label: "酷炫" }
    ],
    user: null,
    weather: null,
    dailyAura: null,
    outfit: null,
    bodyProfile: null,
    quota: null,
    closetCount: 0,
    trends: []
  },

  onLoad() {
    this.setTodayLabel();
    this.initRewardedAd();
  },

  onShow() {
    this.loadHome();
  },

  initRewardedAd() {
    if (!REWARDED_AD_UNIT_ID || !wx.createRewardedVideoAd) return;
    this.rewardedVideoAd = wx.createRewardedVideoAd({
      adUnitId: REWARDED_AD_UNIT_ID
    });
  },

  setTodayLabel() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()];
    this.setData({ todayLabel: `${month}月${date}日 ${week}` });
  },

  formatWeather(weather) {
    return `${weather.city} ${weather.dayTemp}/${weather.nightTemp}°C · ${weather.text}`;
  },

  async loadHome() {
    try {
      this.setData({ loading: true });
      const data = await api.getHome();
      const imageJob = sanitizeImageJob(data.dailyOutfit && data.dailyOutfit.imageJob);
      const imageJobBlocking = isImageJobBlocking(imageJob);
      const currentOutfit = this.data.outfit || {};
      const nextOutfit = data.dailyOutfit
        ? prepareHomeOutfit({ ...data.dailyOutfit, imageJob })
        : data.dailyOutfit;
      if (
        imageJobBlocking
        && currentOutfit.tryOnImage
        && nextOutfit
        && isMissingTryOnPlaceholder(nextOutfit.tryOnImage)
      ) {
        nextOutfit.tryOnImage = currentOutfit.tryOnImage;
        nextOutfit.tryOnAsset = currentOutfit.tryOnAsset || nextOutfit.tryOnAsset || null;
      }
      this.setData({
        loading: false,
        generating: false,
        generationLocked: imageJobBlocking,
        generationHint: imageJobBlocking ? "搭配图生成中，请等待完成" : "",
        activeScene: (nextOutfit && nextOutfit.scene) || this.data.activeScene,
        user: data.user,
        weather: data.weather,
        weatherSummary: this.formatWeather(data.weather),
        dailyAura: data.dailyAura,
        outfit: nextOutfit,
        bodyProfile: data.bodyProfile,
        quota: data.quota,
        closetCount: data.closetCount,
        trends: data.trends,
        sceneOptions: data.sceneOptions || this.data.sceneOptions
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || "首页加载失败", icon: "none" });
    }
  },

  toggleThemeMenu() {
    this.setData({ themeMenuOpen: !this.data.themeMenuOpen });
  },

  setTheme(e) {
    const theme = e.currentTarget.dataset.theme;
    this.setData({
      theme,
      themeLabel: themeMap[theme],
      themeMenuOpen: false
    });
  },

  async selectScene(e) {
    const scene = e.currentTarget.dataset.scene;
    console.log("[DEBUG-home-click] selectScene", { scene });
    if (this.data.generating || this.data.generationLocked) {
      wx.showToast({ title: this.data.generationHint || "搭配图生成中，请稍等", icon: "none" });
      return;
    }
    if (scene === "更多") {
      wx.showToast({ title: "更多场景下一版开放", icon: "none" });
      return;
    }
    this.setData({ activeScene: scene });
    await this.generateForScene(scene);
  },

  async generateForScene(scene = this.data.activeScene, options = {}) {
    if (this.data.generating || this.data.generationLocked) {
      wx.showToast({ title: this.data.generationHint || "搭配图生成中，请稍等", icon: "none" });
      return;
    }
    try {
      const apiBaseUrl = (getApp().globalData || {}).apiBaseUrl;
      console.log("[DEBUG-home-click] generateForScene:start", {
        scene,
        activeScene: this.data.activeScene,
        url: `${apiBaseUrl}/api/outfits/generate`,
        payload: { scene, forceNew: Boolean(options.forceNew) }
      });
      this.setData({
        generating: true,
        generationLocked: true,
        generationHint: "正在提交生成请求..."
      });
      const outfit = await api.generateOutfit({ scene, forceNew: Boolean(options.forceNew) });
      const imageJob = sanitizeImageJob(outfit.imageJob);
      const imageJobBlocking = isImageJobBlocking(imageJob);
      const providerDebug = outfit.debugProviderRequest || null;
      console.log("[DEBUG-home-click] generateForScene:success", {
        scene,
        generationId: outfit.generationId || "",
        imageJobStatus: imageJob && imageJob.status,
        providerDebug
      });
      const currentOutfit = this.data.outfit || {};
      const nextOutfit = prepareHomeOutfit({ ...currentOutfit, ...outfit, imageJob });
      const isTerminalError = imageJob && ["failed", "incomplete"].includes(imageJob.status);
      if (
        (imageJobBlocking || isTerminalError)
        && currentOutfit.tryOnImage
        && isMissingTryOnPlaceholder(nextOutfit.tryOnImage)
      ) {
        nextOutfit.tryOnImage = currentOutfit.tryOnImage;
        nextOutfit.tryOnAsset = currentOutfit.tryOnAsset || nextOutfit.tryOnAsset || null;
      }
      const shouldPoll = imageJobBlocking || (imageJob && imageJob.status === "ready");
      this.setData({
        generating: false,
        generationLocked: imageJobBlocking,
        generationHint: imageJobBlocking ? "搭配图生成中，请等待完成" : "",
        outfit: nextOutfit,
        quota: outfit.quota
      });
      if (isTerminalError) {
        wx.showToast({ title: imageJob.errorMessage || "生成失败", icon: "none" });
        return;
      }
      if (shouldPoll) {
        this.pollGeneratedImage(imageJob);
      }
      wx.showToast({ title: imageJobBlocking ? "已提交生成，正在出图" : "米粒搭好啦", icon: "none" });
    } catch (err) {
      console.log("[DEBUG-home-click] generateForScene:error", {
        scene,
        message: err.message || "generate failed"
      });
      this.setData({
        generating: false,
        generationLocked: false,
        generationHint: ""
      });
      if ((err.message || "").includes("生成次数") || (err.message || "").includes("用完")) {
        this.setData({ quotaModalOpen: true });
        return;
      }
      wx.showToast({ title: err.message || "生成失败", icon: "none" });
    }
  },

  regenerate() {
    console.log("[DEBUG-home-click] regenerate", {
      activeScene: this.data.activeScene,
      loading: this.data.loading,
      generating: this.data.generating,
      generationLocked: this.data.generationLocked
    });
    this.generateForScene(this.data.activeScene, { forceNew: true });
  },

  onCoverImageLoad() {
    console.log("[DEBUG-home-image] load", {
      tryOnImage: this.data.outfit && this.data.outfit.tryOnImage
    });
  },

  onCoverImageError(err) {
    console.log("[DEBUG-home-image] error", {
      tryOnImage: this.data.outfit && this.data.outfit.tryOnImage,
      errMsg: err && err.detail && err.detail.errMsg
    });
  },

  pollGeneratedImage(imageJob, attempt = 0) {
    if (!imageJob || !imageJob.id) return;
    const safeImageJob = sanitizeImageJob(imageJob);
    const startedAt = Number(imageJob.startedAt || Date.now());
    const nextAttempt = attempt + 1;
    const nextDelay = attempt === 0 ? IMAGE_JOB_FIRST_POLL_DELAY_MS : IMAGE_JOB_POLL_DELAY_MS;
    const nextElapsedMs = Date.now() - startedAt + nextDelay;
    if (!safeImageJob) {
      this.setData({
        generating: false,
        generationLocked: false,
        generationHint: ""
      });
      wx.showToast({ title: "生成任务信息缺失，请重试", icon: "none" });
      return;
    }
    if (safeImageJob.status === "ready" && safeImageJob.imageUrl) {
      this.setData({
        generating: false,
        generationLocked: false,
        generationHint: "",
        "outfit.tryOnImage": safeImageJob.imageUrl,
        "outfit.tryOnAsset": safeImageJob.imageAsset || null,
        "outfit.imageJob": safeImageJob
      });
      return;
    }
    if (["failed", "incomplete"].includes(safeImageJob.status) || nextElapsedMs >= IMAGE_JOB_TIMEOUT_MS) {
      this.setData({
        generating: false,
        generationLocked: false,
        generationHint: ""
      });
      if (safeImageJob.errorMessage) {
        wx.showToast({ title: safeImageJob.errorMessage, icon: "none" });
      } else if (nextElapsedMs >= IMAGE_JOB_TIMEOUT_MS) {
        wx.showToast({ title: "生成等待已超过 5 分钟，请稍后重试", icon: "none" });
      }
      return;
    }
    this.setData({
      generationLocked: true,
      generationHint: "搭配图生成中，请等待完成"
    });
    clearTimeout(this.imageJobTimer);
    this.imageJobTimer = setTimeout(async () => {
      try {
        const updated = sanitizeImageJob(await api.pollImageJob(safeImageJob.id));
        if (!updated || !updated.id) {
          this.setData({
            generating: false,
            generationLocked: false,
            generationHint: ""
          });
          wx.showToast({ title: "生成任务轮询返回异常，请重试", icon: "none" });
          return;
        }
        this.pollGeneratedImage({ ...updated, startedAt }, nextAttempt);
      } catch (err) {
        if (attempt < 2) {
          this.pollGeneratedImage({ ...safeImageJob, startedAt }, nextAttempt);
          return;
        }
        this.setData({
          generating: false,
          generationLocked: false,
          generationHint: ""
        });
        wx.showToast({ title: err.message || "生成状态查询失败", icon: "none" });
      }
    }, nextDelay);
  },

  closeQuotaModal() {
    this.setData({ quotaModalOpen: false });
  },

  async playRewardedAd() {
    if (!this.rewardedVideoAd) {
      wx.showToast({ title: "开发版已模拟看完广告", icon: "none" });
      return true;
    }

    return new Promise((resolve, reject) => {
      const ad = this.rewardedVideoAd;
      const cleanup = () => {
        ad.offClose(onClose);
        ad.offError(onError);
      };
      const onClose = (res) => {
        cleanup();
        resolve(Boolean(res && res.isEnded));
      };
      const onError = (err) => {
        cleanup();
        reject(err);
      };
      ad.onClose(onClose);
      ad.onError(onError);
      ad.show().catch(() => ad.load().then(() => ad.show()).catch(reject));
    });
  },

  async watchAdUnlock() {
    if (this.data.unlockingAd) return;
    try {
      this.setData({ unlockingAd: true });
      const completed = await this.playRewardedAd();
      if (!completed) {
        this.setData({ unlockingAd: false });
        wx.showToast({ title: "看完广告后才会解锁", icon: "none" });
        return;
      }
      const data = await api.unlockAdGeneration();
      this.setData({
        unlockingAd: false,
        quotaModalOpen: false,
        quota: data.quota
      });
      wx.showToast({ title: data.message || "已解锁 1 张", icon: "success" });
      await this.generateForScene(this.data.activeScene);
    } catch (err) {
      this.setData({ unlockingAd: false });
      wx.showToast({ title: err.message || "广告解锁失败", icon: "none" });
    }
  },

  async subscribePlus() {
    if (this.data.subscribing) return;
    try {
      this.setData({ subscribing: true });
      const data = await api.subscribePlus();
      this.setData({
        subscribing: false,
        quotaModalOpen: false,
        quota: data.quota
      });
      wx.showToast({ title: "米粒 Plus 已开通", icon: "success" });
      await this.generateForScene(this.data.activeScene);
    } catch (err) {
      this.setData({ subscribing: false });
      wx.showToast({ title: err.message || "订阅失败", icon: "none" });
    }
  },

  noop() {},

  goDaily() {
    if (isInteractionLocked(this)) {
      wx.showToast({ title: this.data.generationHint || "搭配图生成中，请等待完成", icon: "none" });
      return;
    }
    const id = this.data.outfit && this.data.outfit.generationId ? this.data.outfit.generationId : "";
    wx.navigateTo({ url: `/pages/daily/daily?id=${id}&scene=${this.data.activeScene}` });
  },

  goCapture() {
    wx.switchTab({ url: "/pages/capture/capture" });
  },

  onUnload() {
    clearTimeout(this.imageJobTimer);
  }
});
