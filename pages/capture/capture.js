const api = require("../../services/api");

Page({
  data: {
    ageOptions: ["18-22", "23-28", "29-35", "36+"],
    zodiacOptions: ["白羊座", "金牛座", "双子座", "巨蟹座", "狮子座", "处女座", "天秤座", "天蝎座", "射手座", "摩羯座", "水瓶座", "双鱼座"],
    cityOptions: ["上海", "北京", "广州", "深圳", "杭州", "成都"],
    heightOptions: ["155", "158", "160", "162", "164", "166", "168", "170", "172", "175"],
    weightOptions: ["42", "45", "48", "50", "52", "55", "58", "60", "63", "66"],
    sceneOptions: [
      { label: "上班", active: true },
      { label: "约会", active: false },
      { label: "聚会", active: false },
      { label: "出游", active: false },
      { label: "逛街", active: false }
    ],
    profile: {
      ageRange: "23-28",
      zodiac: "天秤座",
      city: "上海",
      height: "164",
      weight: "50",
      scenes: ["上班"]
    },
    photos: {
      front: "",
      side: "",
      back: ""
    },
    photoAssets: {
      front: null,
      side: null,
      back: null
    },
    guidePhotos: {
      front: "/packages/test-assets/generated/three/profile-short-curvy-front-preview.png",
      side: "/packages/test-assets/generated/three/profile-short-curvy-side-preview.png",
      back: "/packages/test-assets/generated/three/profile-short-curvy-back-preview.png"
    },
    uploading: false,
    analyzing: false,
    result: null
  },

  onLoad() {
    this.loadGuideAssets();
  },

  async loadGuideAssets() {
    try {
      const data = await api.getAssets({ group: "body_scan_guides" });
      const guidePhotos = { ...this.data.guidePhotos };
      (data.items || []).forEach((asset) => {
        if (asset.slot) {
          guidePhotos[asset.slot] = asset.previewUrl || asset.url || guidePhotos[asset.slot];
        }
      });
      this.setData({ guidePhotos });
    } catch (err) {
      // Keep packaged fallback guide images when the asset service is unavailable.
    }
  },

  selectAge(e) {
    this.setData({ "profile.ageRange": e.currentTarget.dataset.value });
  },

  selectZodiac(e) {
    this.setData({ "profile.zodiac": e.currentTarget.dataset.value });
  },

  selectCity(e) {
    this.setData({ "profile.city": e.currentTarget.dataset.value });
  },

  selectHeight(e) {
    this.setData({ "profile.height": e.currentTarget.dataset.value });
  },

  selectWeight(e) {
    this.setData({ "profile.weight": e.currentTarget.dataset.value });
  },

  toggleScene(e) {
    const scene = e.currentTarget.dataset.value;
    const sceneOptions = this.data.sceneOptions.map((item) =>
      item.label === scene ? { ...item, active: !item.active } : item
    );
    const scenes = sceneOptions.filter((item) => item.active).map((item) => item.label);
    this.setData({ sceneOptions, "profile.scenes": scenes });
  },

  async uploadPhoto(path, slot) {
    return api.uploadAsset({
      filePath: path,
      type: "body_scan",
      group: "body_scan_uploads",
      slot
    });
  },

  async assignPhotos(paths) {
    const slots = ["front", "side", "back"];
    const nextPhotos = { ...this.data.photos };
    const nextAssets = { ...this.data.photoAssets };
    this.setData({ uploading: true, result: null });

    try {
      for (let index = 0; index < paths.slice(0, 3).length; index += 1) {
        const slot = slots[index];
        const asset = await this.uploadPhoto(paths[index], slot);
        nextPhotos[slot] = asset.previewUrl || asset.url || paths[index];
        nextAssets[slot] = asset;
      }
      this.setData({ photos: nextPhotos, photoAssets: nextAssets, uploading: false, result: null });
    } catch (err) {
      this.setData({ uploading: false });
      wx.showToast({ title: err.message || "照片上传失败", icon: "none" });
      return;
    }

    if (paths.length < 3) {
      wx.showToast({ title: `还差 ${3 - paths.length} 张，请补齐三视图`, icon: "none" });
    }
  },

  chooseAllPhotos() {
    const done = (paths) => this.assignPhotos(paths);

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 3,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        success: (res) => done(res.tempFiles.map((file) => file.tempFilePath))
      });
      return;
    }

    wx.chooseImage({
      count: 3,
      sourceType: ["album", "camera"],
      success: (res) => done(res.tempFilePaths)
    });
  },

  choosePhoto(e) {
    const slot = e.currentTarget.dataset.slot;
    const done = async (path) => {
      this.setData({ uploading: true, result: null });
      try {
        const asset = await this.uploadPhoto(path, slot);
        this.setData({
          [`photos.${slot}`]: asset.previewUrl || asset.url || path,
          [`photoAssets.${slot}`]: asset,
          uploading: false,
          result: null
        });
      } catch (err) {
        this.setData({ uploading: false });
        wx.showToast({ title: err.message || "照片上传失败", icon: "none" });
      }
    };

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

  hasAllPhotos() {
    const { front, side, back } = this.data.photos;
    return Boolean(front && side && back);
  },

  async analyze() {
    if (!this.hasAllPhotos()) {
      wx.showToast({ title: "请先补齐正面、侧面、背面照", icon: "none" });
      return;
    }

    try {
      this.setData({ analyzing: true });
      const result = await api.analyzeBodyScan({
        photos: this.data.photos,
        photoAssets: this.data.photoAssets,
        profile: this.data.profile
      });
      this.setData({ analyzing: false, result });
    } catch (err) {
      this.setData({ analyzing: false });
      wx.showToast({ title: err.message || "分析失败", icon: "none" });
    }
  },

  goHome() {
    wx.switchTab({ url: "/pages/home/home" });
  }
});
