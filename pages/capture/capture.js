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
    photoVariants: {
      front: null,
      side: null,
      back: null
    },
    guidePhotos: {
      front: "/packages/test-assets/generated/three/profile-short-curvy-front-preview.png",
      side: "/packages/test-assets/generated/three/profile-short-curvy-side-preview.png",
      back: "/packages/test-assets/generated/three/profile-short-curvy-back-preview.png"
    },
    referenceCutoutImages: [],
    referenceCompositePreviewImages: null,
    referenceCompositeImages: null,
    compositeError: "",
    uploading: false,
    analyzing: false,
    result: null
  },

  onLoad() {
    console.log("[DEBUG-capture-life] onLoad");
    this.loadGuideAssets();
  },

  onShow() {
    console.log("[DEBUG-capture-life] onShow", {
      photos: this.data.photos,
      uploading: this.data.uploading,
      analyzing: this.data.analyzing
    });
  },

  onHide() {
    console.log("[DEBUG-capture-life] onHide");
  },

  onUnload() {
    console.log("[DEBUG-capture-life] onUnload");
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
    console.log("[DEBUG-capture-upload] uploadPhoto:start", { slot, path });
    return api.uploadAsset({
      filePath: path,
      type: "body_scan",
      group: "body_scan_uploads",
      slot
    });
  },

  pickReferenceCompositeImages(payload) {
    if (!payload) return null;
    return payload.referenceCompositeImages
      || (payload.meta && payload.meta.referenceCompositeImages)
      || null;
  },

  pickCompositeError(payload) {
    if (!payload) return "";
    return (payload.processing && payload.processing.compositeError)
      || (payload.processing && payload.processing.fittedError)
      || (payload.meta && payload.meta.fittedError)
      || "";
  },

  pickFittedVariants(payload) {
    if (!payload) return null;
    return (payload.processing && payload.processing.fitted)
      || (payload.meta && payload.meta.fitted)
      || null;
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
        console.log("[DEBUG-capture-upload] uploadPhoto:success", {
          slot,
          assetId: asset && asset.id,
          previewUrl: asset && asset.previewUrl,
          url: asset && asset.url,
          referenceCompositeImages: asset && asset.referenceCompositeImages,
          processing: asset && asset.processing
        });
        nextPhotos[slot] = asset.previewUrl || asset.url || paths[index];
        nextAssets[slot] = asset;
        const compositeError = this.pickCompositeError(asset);
        const fitted = this.pickFittedVariants(asset);
        this.setData({
          [`photoVariants.${slot}`]: fitted,
          referenceCutoutImages: [],
          referenceCompositePreviewImages: null,
          referenceCompositeImages: null,
          compositeError: compositeError || ""
        });
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

  /**
   * 功能：统一选择图片文件，优先使用图片选择器，规避 Windows 端多媒体选择器卡住的问题。
   * 参数：count 允许选择的图片数量。
   * 返回：Promise，成功时返回临时图片路径数组。
   * 异常：用户取消或系统选图失败时抛出异常。
   */
  chooseImageFiles(count) {
    return new Promise((resolve, reject) => {
      if (wx.chooseImage) {
        wx.chooseImage({
          count,
          sizeType: ["compressed"],
          sourceType: ["album", "camera"],
          success: (res) => resolve((res && res.tempFilePaths) || []),
          fail: reject
        });
        return;
      }

      if (wx.chooseMedia) {
        wx.chooseMedia({
          count,
          mediaType: ["image"],
          sourceType: ["album", "camera"],
          success: (res) => resolve((res.tempFiles || []).map((file) => file.tempFilePath)),
          fail: reject
        });
        return;
      }

      reject(new Error("当前环境不支持图片选择"));
    });
  },

  chooseAllPhotos() {
    this.chooseImageFiles(3)
      .then((paths) => this.assignPhotos(paths))
      .catch((err) => {
        if (err && /cancel/i.test(err.errMsg || err.message || "")) {
          return;
        }
        wx.showToast({ title: "打开相册失败", icon: "none" });
      });
  },

  choosePhoto(e) {
    const slot = e.currentTarget.dataset.slot;
    const done = async (path) => {
      console.log("[DEBUG-capture-upload] choosePhoto:selected", { slot, path });
      this.setData({ uploading: true, result: null });
      try {
        const asset = await this.uploadPhoto(path, slot);
        console.log("[DEBUG-capture-upload] choosePhoto:success", {
          slot,
          assetId: asset && asset.id,
          previewUrl: asset && asset.previewUrl,
          url: asset && asset.url,
          referenceCompositeImages: asset && asset.referenceCompositeImages,
          processing: asset && asset.processing
        });
        this.setData({
          [`photos.${slot}`]: asset.previewUrl || asset.url || path,
          [`photoAssets.${slot}`]: asset,
          [`photoVariants.${slot}`]: this.pickFittedVariants(asset),
          referenceCutoutImages: [],
          referenceCompositePreviewImages: null,
          referenceCompositeImages: null,
          compositeError: this.pickCompositeError(asset) || "",
          uploading: false,
          result: null
        });
      } catch (err) {
        console.log("[DEBUG-capture-upload] choosePhoto:error", {
          slot,
          message: err.message || "upload failed"
        });
        this.setData({ uploading: false });
        wx.showToast({ title: err.message || "照片上传失败", icon: "none" });
      }
    };

    this.chooseImageFiles(1)
      .then((paths) => {
        if (!paths || !paths[0]) {
          return;
        }
        return done(paths[0]);
      })
      .catch((err) => {
        if (err && /cancel/i.test(err.errMsg || err.message || "")) {
          return;
        }
        wx.showToast({ title: "打开相册失败", icon: "none" });
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
      console.log("[DEBUG-capture-analyze] success", {
        referenceCutoutImages: result && result.referenceCutoutImages,
        referenceCompositePreviewImages: result && result.referenceCompositePreviewImages,
        referenceCompositeImages: result && result.referenceCompositeImages,
        compositeError: result && result.compositeError
      });
      this.setData({
        analyzing: false,
        result,
        referenceCutoutImages: result.referenceCutoutImages || [],
        referenceCompositePreviewImages: result.referenceCompositePreviewImages || this.data.referenceCompositePreviewImages,
        referenceCompositeImages: result.referenceCompositeImages || this.data.referenceCompositeImages,
        compositeError: result.compositeError || this.data.compositeError
      });
    } catch (err) {
      this.setData({ analyzing: false });
      wx.showToast({ title: err.message || "分析失败", icon: "none" });
    }
  },

  goHome() {
    wx.switchTab({ url: "/pages/home/home" });
  },

  onPhotoLoad(e) {
    console.log("[DEBUG-capture-image] load", {
      src: e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.src
    });
  },

  onPhotoError(e) {
    console.log("[DEBUG-capture-image] error", {
      src: e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.src,
      errMsg: e && e.detail && e.detail.errMsg
    });
  }
});
