const api = require("../../services/api");

Page({
  data: {
    loading: true,
    outfit: null,
    quota: null
  },

  onShow() {
    this.loadRecord();
  },

  async loadRecord() {
    try {
      this.setData({ loading: true });
      const data = await api.getHome();
      this.setData({
        loading: false,
        outfit: data.dailyOutfit,
        quota: data.quota
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || "记录加载失败", icon: "none" });
    }
  },

  goDaily() {
    const id = this.data.outfit && this.data.outfit.generationId ? this.data.outfit.generationId : "";
    wx.navigateTo({ url: `/pages/daily/daily?id=${id}` });
  },

  goEvaluate() {
    wx.navigateTo({ url: "/pages/evaluate/evaluate" });
  }
});
