Component({
  properties: {
    context: {
      type: String,
      value: "daily"
    }
  },

  data: {
    open: false,
    draft: "",
    messages: [
      {
        id: "m0",
        from: "mili",
        text: "你可以直接说今天要去哪、想要什么感觉，米粒会帮你记成偏好。"
      }
    ],
    quickActions: [
      { label: "更显瘦", text: "这次想更显瘦一点，腰线清楚，别太成熟。" },
      { label: "换场景", text: "我想换一个场景重新搭。" },
      { label: "用衣橱", text: "优先用我衣橱里的衣服。" },
      { label: "别太甜", text: "不要太甜，干净利落一点。" }
    ]
  },

  methods: {
    openChat() {
      this.setData({ open: true });
    },

    closeChat() {
      this.setData({ open: false });
    },

    onInput(e) {
      this.setData({ draft: e.detail.value });
    },

    sendQuick(e) {
      const text = e.currentTarget.dataset.text;
      this.addUserMessage(text);
    },

    sendMessage() {
      const text = this.data.draft.trim();
      if (!text) return;
      this.addUserMessage(text);
      this.setData({ draft: "" });
    },

    addUserMessage(text) {
      const messages = [
        ...this.data.messages,
        {
          id: `u${Date.now()}`,
          from: "user",
          text
        },
        {
          id: `m${Date.now()}`,
          from: "mili",
          text: this.replyFor(text)
        }
      ];
      this.setData({ messages });
      this.triggerEvent("profiledraft", { text, context: this.properties.context });
    },

    replyFor(text) {
      if (text.includes("星座") || text.includes("年龄") || text.includes("岁")) {
        return "收到，我会把这些记进你的基础档案，后面推荐会少问你重复问题。";
      }
      if (text.includes("显瘦") || text.includes("腰线")) {
        return "我会优先看高腰线、顺垂下装和肩线补足，不用靠紧身来显瘦。";
      }
      if (text.includes("衣橱")) {
        return "可以，我会先从你的衣橱找；不够时再用趋势库补方案。";
      }
      if (text.includes("婚礼")) {
        return "婚礼场景要低调精致，不抢主角。我会避开过白、过红和太闪的单品。";
      }
      return "我记下了。下一次生成时会把这句话当成偏好约束，不只是聊天记录。";
    }
  }
});
