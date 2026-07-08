const api = require("../../services/api");
const recordPresenter = require("./record-presenter");

Page({
  data: {
    loading: true,
    recovering: false,
    jobs: [],
    quota: null
  },

  onShow() {
    this.loadRecord();
  },

  async loadRecord() {
    try {
      this.setData({ loading: true });
      const [homeData, jobsData] = await Promise.all([
        api.getHome(),
        api.listImageJobs()
      ]);
      const jobs = recordPresenter.normalizeJobs(jobsData.items || []);
      this.setData({
        loading: false,
        jobs,
        quota: homeData.quota
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || "记录加载失败", icon: "none" });
    }
  },

  async syncProviderImages() {
    if (this.data.recovering) return;
    try {
      this.setData({ recovering: true });
      const result = await api.recoverRemoteImageJobs({ pollProvider: true });
      wx.showToast({
        title: result.items && result.items.length ? `同步到${result.items.length}张图` : "暂无可同步图片",
        icon: "none"
      });
      await this.loadRecord();
    } catch (err) {
      wx.showToast({ title: err.message || "同步失败", icon: "none" });
    } finally {
      this.setData({ recovering: false });
    }
  },

  previewJob(e) {
    const imageUrl = e.currentTarget.dataset.imageUrl;
    if (!imageUrl) return;
    wx.previewImage({
      urls: [imageUrl],
      current: imageUrl
    });
  },

  goDaily(e) {
    const id = e.currentTarget.dataset.id || "";
    wx.navigateTo({ url: `/pages/daily/daily?imageJobId=${encodeURIComponent(id)}` });
  },

  goEvaluate() {
    wx.navigateTo({ url: "/pages/evaluate/evaluate" });
  }
});
