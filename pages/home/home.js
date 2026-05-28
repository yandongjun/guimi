const api = require("../../services/api");

const themeMap = {
  beige: "米色",
  pink: "粉色",
  cool: "酷炫"
};

const REWARDED_AD_UNIT_ID = "";

Page({
  data: {
    loading: true,
    generating: false,
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
      this.setData({
        loading: false,
        user: data.user,
        weather: data.weather,
        weatherSummary: this.formatWeather(data.weather),
        dailyAura: data.dailyAura,
        outfit: data.dailyOutfit,
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
    if (scene === "更多") {
      wx.showToast({ title: "更多场景下一版开放", icon: "none" });
      return;
    }
    this.setData({ activeScene: scene });
    await this.generateForScene(scene);
  },

  async generateForScene(scene = this.data.activeScene) {
    if (this.data.generating) return;
    try {
      this.setData({ generating: true });
      const outfit = await api.generateOutfit({ scene });
      this.setData({
        generating: false,
        outfit,
        quota: outfit.quota
      });
      wx.showToast({ title: "米粒搭好啦", icon: "success" });
    } catch (err) {
      this.setData({ generating: false });
      if ((err.message || "").includes("生成次数") || (err.message || "").includes("用完")) {
        this.setData({ quotaModalOpen: true });
        return;
      }
      wx.showToast({ title: err.message || "生成失败", icon: "none" });
    }
  },

  regenerate() {
    this.generateForScene(this.data.activeScene);
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
    const id = this.data.outfit && this.data.outfit.generationId ? this.data.outfit.generationId : "";
    wx.navigateTo({ url: `/pages/daily/daily?id=${id}&scene=${this.data.activeScene}` });
  },

  goCapture() {
    wx.switchTab({ url: "/pages/capture/capture" });
  }
});
