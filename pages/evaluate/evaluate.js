const api = require("../../services/api");

Page({
  data: {
    image: "",
    evaluating: false,
    result: null
  },

  chooseImage() {
    const done = (path) => this.setData({ image: path, result: null });
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        success: (res) => done(res.tempFiles[0].tempFilePath)
      });
      return;
    }
    wx.chooseImage({
      count: 1,
      sourceType: ["album", "camera"],
      success: (res) => done(res.tempFilePaths[0])
    });
  },

  async evaluate() {
    if (!this.data.image) {
      wx.showToast({ title: "请先上传一张穿搭照", icon: "none" });
      return;
    }

    try {
      this.setData({ evaluating: true });
      const result = await api.evaluateOutfit({ image: this.data.image });
      result.closetCandidatesText = result.closetCandidates.join("、");
      this.setData({ evaluating: false, result });
    } catch (err) {
      this.setData({ evaluating: false });
      wx.showToast({ title: err.message || "点评失败", icon: "none" });
    }
  }
});
