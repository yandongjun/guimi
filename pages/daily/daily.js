const api = require("../../services/api");

const ratingFields = [
  { key: "like", label: "喜欢程度", value: 5 },
  { key: "fit", label: "适合自己", value: 5 },
  { key: "wearable", label: "愿意现实穿", value: 5 },
  { key: "fashion", label: "时尚感", value: 5 },
  { key: "likeness", label: "像不像自己", value: 4 }
];

function prepareOutfit(outfit = {}) {
  return {
    ...outfit,
    usedClosetItemsText: (outfit.usedClosetItemLabels || []).join("、"),
    trendFillSlotsText: (outfit.trendFillSlots || []).join("、")
  };
}

function applyImageJob(outfit = {}, imageJob = null) {
  if (!imageJob || imageJob.status !== "ready" || !imageJob.imageUrl) return outfit;
  return {
    ...outfit,
    id: outfit.id || imageJob.id,
    scene: imageJob.scene || outfit.scene,
    displayTitle: outfit.displayTitle || imageJob.outfitTitle,
    title: outfit.title || imageJob.outfitTitle,
    tryOnImage: imageJob.imageUrl,
    tryOnAsset: imageJob.imageAsset || outfit.tryOnAsset || null,
    imageJob
  };
}

Page({
  data: {
    loading: true,
    submitting: false,
    city: "上海",
    scene: "上班",
    weather: null,
    dailyAura: null,
    luckyColor: "",
    favoriteColors: [],
    outfit: null,
    trendItems: [],
    similarProducts: [],
    showSimilar: false,
    ratingFields,
    scoreOptions: [1, 2, 3, 4, 5],
    ratingSaved: false
  },

  onLoad(options = {}) {
    this.setData({ scene: options.scene || "上班" });
    if (options.id) {
      this.loadGeneration(options.id, options.imageJobId || "");
      return;
    }
    if (options.imageJobId) {
      this.loadImageJob(options.imageJobId);
      return;
    }
    this.loadDaily();
  },

  async loadGeneration(id, imageJobId = "") {
    try {
      this.setData({ loading: true });
      let outfit = prepareOutfit(await api.getGeneration(id));
      if (imageJobId) {
        const imageJob = await api.getImageJob(imageJobId);
        outfit = prepareOutfit(applyImageJob(outfit, imageJob));
      }
      const home = await api.getHome();
      this.setData({
        loading: false,
        outfit,
        weather: home.weather,
        dailyAura: home.dailyAura,
        luckyColor: home.dailyAura.luckyColor,
        favoriteColors: home.user.favoriteColors,
        trendItems: home.trends
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || "结果加载失败", icon: "none" });
    }
  },

  async loadImageJob(imageJobId) {
    try {
      this.setData({ loading: true });
      const imageJob = await api.getImageJob(imageJobId);
      const home = await api.getHome();
      const baseOutfit = home.dailyOutfit || {};
      const outfit = prepareOutfit(applyImageJob(baseOutfit, imageJob));
      this.setData({
        loading: false,
        outfit,
        weather: home.weather,
        dailyAura: home.dailyAura,
        luckyColor: home.dailyAura.luckyColor,
        favoriteColors: home.user.favoriteColors,
        trendItems: home.trends
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || "结果加载失败", icon: "none" });
    }
  },

  async loadDaily() {
    try {
      this.setData({ loading: true });
      const data = await api.getDailyOutfit({
        city: this.data.city,
        scene: this.data.scene
      });
      this.setData({
        loading: false,
        weather: data.weather,
        dailyAura: data.dailyAura,
        luckyColor: data.luckyColor,
        favoriteColors: data.favoriteColors,
        primaryFavoriteColor: data.favoriteColors[0],
        outfit: prepareOutfit(data.outfit),
        trendItems: data.trendItems
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || "今日穿搭加载失败", icon: "none" });
    }
  },

  setScore(e) {
    const key = e.currentTarget.dataset.key;
    const value = Number(e.currentTarget.dataset.value);
    const ratingFields = this.data.ratingFields.map((field) =>
      field.key === key ? { ...field, value } : field
    );
    this.setData({ ratingFields, ratingSaved: false });
  },

  async submitRating() {
    if (!this.data.outfit) return;
    try {
      this.setData({ submitting: true });
      const scores = {};
      this.data.ratingFields.forEach((field) => {
        scores[field.key] = field.value;
      });
      await api.rateGeneration({
        generationId: this.data.outfit.generationId || this.data.outfit.id,
        scores,
        styleTags: this.data.outfit.styleTags || []
      });
      this.setData({ submitting: false, ratingSaved: true });
      wx.showToast({ title: "米粒记住了", icon: "success" });
    } catch (err) {
      this.setData({ submitting: false });
      wx.showToast({ title: err.message || "保存失败", icon: "none" });
    }
  },

  async showSimilarProducts() {
    try {
      const data = await api.getSimilarProducts();
      this.setData({ similarProducts: data.items, showSimilar: true });
    } catch (err) {
      wx.showToast({ title: err.message || "类似款加载失败", icon: "none" });
    }
  },

  goTab(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.switchTab({ url });
  }
});
