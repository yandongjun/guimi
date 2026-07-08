const api = require("../../services/api");

Page({
  data: {
    loading: true,
    items: [],
    gaps: [],
    stats: null,
    uploading: false,
    uploadError: "",
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
        uploadError: "",
        items: data.items,
        gaps: data.gaps,
        stats: data.stats
      });
    } catch (err) {
      console.error("[closet] load failed", err);
      this.setData({
        loading: false,
        uploadError: err.message || "衣橱加载失败"
      });
      wx.showToast({ title: err.message || "衣橱加载失败", icon: "none" });
    }
  },

  setCategory(e) {
    this.setData({ activeCategory: e.currentTarget.dataset.key });
  },

  addMockItem() {
    this.uploadClosetImage();
  },

  uploadClosetImage() {
    if (this.data.uploading) return;
    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: async (res) => {
        const filePath = res.tempFilePaths && res.tempFilePaths[0];
        if (!filePath) return;
        this.setData({ uploading: true, uploadError: "" });
        wx.showLoading({ title: "整理衣服中" });
        try {
          const result = await api.uploadClosetItem({ filePath });
          console.log("[closet] upload success", result);
          await this.loadCloset();
          wx.showToast({ title: "已加入衣橱", icon: "success" });
        } catch (err) {
          console.error("[closet] upload failed", {
            filePath,
            message: err.message || "upload failed",
            err
          });
          this.setData({
            uploadError: err.message || "上传失败，请查看 Console 日志"
          });
          wx.showToast({ title: err.message || "上传失败", icon: "none" });
        } finally {
          wx.hideLoading();
          this.setData({ uploading: false });
        }
      }
    });
  }
});
