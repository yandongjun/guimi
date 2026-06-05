const DEV_API_HOST = "10.7.158.93:8787";

App({
  globalData: {
    userId: "demo-user",
    // 局域网联调时，手机和开发机需在同一网段；换网络后只改这里。
    apiBaseUrl: `http://${DEV_API_HOST}`,
    useMock: false
  }
});
