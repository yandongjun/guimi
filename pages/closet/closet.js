const api = require("../../services/api");

Page({
  data: {
    loading: true,
    items: [],
    gaps: [],
    stats: null,
    activeCategory: "all",
    categories: [
      { key: "all", label: "全部" },
      { key: "outerwear", label: "外套" },
      { key: "top", label: "上装" },
      { key: "bottom", label: "下装" },
      { key: "shoes", label: "鞋包" }
    ]
  },

  onLoad() {
    this.loadCloset();
  },

  async loadCloset() {
    try {
      const data = await api.getCloset();
      this.setData({
        loading: false,
        items: data.items,
        gaps: data.gaps,
        stats: data.stats
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || "衣橱加载失败", icon: "none" });
    }
  },

  setCategory(e) {
    this.setData({ activeCategory: e.currentTarget.dataset.key });
  },

  addMockItem() {
    wx.showToast({ title: "下一版接拍照识别", icon: "none" });
  }
});
