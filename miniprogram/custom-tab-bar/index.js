Component({
  data: {
    selected: 0,
    color: "#8b8b8b",
    selectedColor: "#00d4ff",
    list: [
      {
        pagePath: "/pages/create/create",
        text: "创作",
        icon: "✨",
        selectedIcon: "🎨"
      },
      {
        pagePath: "/pages/rank/rank",
        text: "排行",
        icon: "📊",
        selectedIcon: "🏆"
      },
      {
        pagePath: "/pages/mine/mine",
        text: "我的",
        icon: "👤",
        selectedIcon: "😊"
      }
    ]
  },

  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;

      wx.switchTab({ url });
    }
  }
});