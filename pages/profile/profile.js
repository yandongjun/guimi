const mock = require("../../data/mock");
const api = require("../../services/api");

function formatUser(user) {
  return {
    ...user,
    styleText: user.styleKeywords.join("、"),
    colorText: user.favoriteColors.join("、")
  };
}

Page({
  data: {
    subscribing: false,
    activeUserId: mock.testUsers[0].id,
    testUsers: mock.testUsers,
    user: formatUser(mock.testUsers[0]),
    companion: mock.user.companion
  },

  onLoad() {
    this.loadTestUsers();
  },

  async loadTestUsers() {
    try {
      const data = await api.getTestUsers();
      const active = data.users.find((item) => item.id === data.activeUserId) || data.users[0];
      this.setData({
        activeUserId: data.activeUserId,
        testUsers: data.users,
        user: formatUser(active)
      });
    } catch (err) {
      wx.showToast({ title: err.message || "测试用户加载失败", icon: "none" });
    }
  },

  async selectTestUser(e) {
    const userId = e.currentTarget.dataset.id;
    try {
      const data = await api.selectTestUser(userId);
      this.setData({
        activeUserId: data.activeUserId,
        user: formatUser(data.user)
      });
      wx.showToast({ title: "已切换测试用户", icon: "success" });
      wx.switchTab({ url: "/pages/home/home" });
    } catch (err) {
      wx.showToast({ title: err.message || "切换失败", icon: "none" });
    }
  },

  async subscribePlus() {
    if (this.data.subscribing) return;
    try {
      this.setData({ subscribing: true });
      await api.subscribePlus();
      this.setData({ subscribing: false });
      wx.showToast({ title: "米粒 Plus 已开通", icon: "success" });
    } catch (err) {
      this.setData({ subscribing: false });
      wx.showToast({ title: err.message || "订阅失败", icon: "none" });
    }
  }
});
