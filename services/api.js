const mockServer = require("./mock-server");

function getAppConfig() {
  const app = getApp();
  return app.globalData || {};
}

function useMock() {
  return getAppConfig().useMock !== false;
}

function request(path, method = "GET", data = {}) {
  const { apiBaseUrl } = getAppConfig();
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${apiBaseUrl}${path}`,
      method,
      data,
      success: (res) => {
        if (res.data && res.data.code === 0) {
          resolve(res.data.data);
          return;
        }
        reject(new Error((res.data && res.data.message) || "接口返回异常"));
      },
      fail: reject
    });
  });
}

function upload(path, filePath, formData = {}) {
  const { apiBaseUrl } = getAppConfig();
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${apiBaseUrl}${path}`,
      filePath,
      name: "file",
      formData,
      success: (res) => {
        let data = {};
        try {
          data = JSON.parse(res.data || "{}");
        } catch (error) {
          reject(new Error("上传接口返回异常"));
          return;
        }
        if (data && data.code === 0) {
          resolve(data.data);
          return;
        }
        reject(new Error((data && data.message) || "上传失败"));
      },
      fail: reject
    });
  });
}

async function unwrap(promise) {
  const res = await promise;
  if (res.code === 0) {
    return res.data;
  }
  throw new Error(res.message || "接口返回异常");
}

module.exports = {
  getHome() {
    return useMock() ? unwrap(mockServer.getHome()) : request("/api/home");
  },
  getDailyOutfit(params) {
    return useMock() ? unwrap(mockServer.getDailyOutfit(params)) : request("/api/outfits/daily", "POST", params);
  },
  generateOutfit(payload) {
    return useMock() ? unwrap(mockServer.generateOutfit(payload)) : request("/api/outfits/generate", "POST", payload);
  },
  getGeneration(id) {
    return useMock() ? unwrap(mockServer.getGeneration({ id })) : request(`/api/outfits/${id}`);
  },
  rateGeneration(payload) {
    return useMock() ? unwrap(mockServer.rateGeneration(payload)) : request(`/api/outfits/${payload.generationId}/rating`, "POST", payload);
  },
  getQuota() {
    return useMock() ? unwrap(mockServer.getQuota()) : request("/api/generation/quota");
  },
  unlockAdGeneration() {
    return useMock() ? unwrap(mockServer.unlockAdGeneration()) : request("/api/generation/ad-unlock", "POST");
  },
  subscribePlus() {
    return useMock() ? unwrap(mockServer.subscribePlus()) : request("/api/subscription/plus", "POST");
  },
  analyzeBodyScan(payload) {
    return useMock() ? unwrap(mockServer.analyzeBodyScan(payload)) : request("/api/body-scan/analyze", "POST", payload);
  },
  evaluateOutfit(payload) {
    return useMock() ? unwrap(mockServer.evaluateOutfit(payload)) : request("/api/outfit/evaluate", "POST", payload);
  },
  getCloset() {
    return useMock() ? unwrap(mockServer.getCloset()) : request("/api/closet");
  },
  addClosetItem(payload) {
    return useMock() ? unwrap(mockServer.addClosetItem(payload)) : request("/api/closet/items", "POST", payload);
  },
  getSimilarProducts() {
    return useMock() ? unwrap(mockServer.getSimilarProducts()) : request("/api/products/similar");
  },
  getAssets(filter = {}) {
    const query = Object.keys(filter)
      .filter((key) => filter[key])
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(filter[key])}`)
      .join("&");
    return useMock() ? unwrap(mockServer.getAssets(filter)) : request(`/api/assets${query ? `?${query}` : ""}`);
  },
  uploadAsset(payload = {}) {
    if (useMock()) {
      return unwrap(mockServer.uploadAsset(payload));
    }
    return upload("/api/assets/upload", payload.filePath, {
      type: payload.type || "user_upload",
      group: payload.group || "",
      slot: payload.slot || ""
    });
  },
  getTestUsers() {
    return useMock() ? unwrap(mockServer.getTestUsers()) : request("/api/test-users");
  },
  selectTestUser(userId) {
    return useMock() ? unwrap(mockServer.selectTestUser({ userId })) : request("/api/test-users/active", "POST", { userId });
  },
  listImageJobs(status = "") {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return request(`/api/image-jobs${query}`);
  },
  createImageJob(payload) {
    return request("/api/image-jobs", "POST", payload);
  },
  completeImageJob(id, payload) {
    return request(`/api/image-jobs/${id}/complete`, "POST", payload);
  },
  submitImageJob(id) {
    return request(`/api/image-jobs/${id}/submit`, "POST", {});
  },
  pollImageJob(id) {
    return request(`/api/image-jobs/${id}/poll`, "POST", {});
  },
  downloadImageJob(id) {
    return request(`/api/image-jobs/${id}/download`, "POST", {});
  }
};
