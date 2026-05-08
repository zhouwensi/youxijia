/**
 * 首次启动：协议确认 + 微信登录（换取 OpenID 绑定账号，用于防刷与兑换码）
 */
const app = getApp();

function windowContentHeight() {
  try {
    if (typeof wx.getWindowInfo === 'function') {
      return wx.getWindowInfo().windowHeight || 0;
    }
  } catch (_) {}
  try {
    return wx.getSystemInfoSync().windowHeight || 0;
  } catch (_) {
    return 0;
  }
}

Page({
  data: {
    agreed: false,
    loading: false,
    /** scroll-y 的 scroll-view 必须有确定高度，否则内容区高度为 0，用户看不到勾选框 */
    scrollHeight: 400,
  },

  onReady() {
    const q = wx.createSelectorQuery().in(this);
    q.select('.hero').boundingClientRect();
    q.select('.footer').boundingClientRect();
    q.exec((res) => {
      const hero = res && res[0];
      const foot = res && res[1];
      const wh = windowContentHeight() || 667;
      const heroH = hero && hero.height ? hero.height : 140;
      const footH = foot && foot.height ? foot.height : 72;
      const h = Math.floor(wh - heroH - footH - 4);
      this.setData({ scrollHeight: Math.max(h, 160) });
    });
  },

  onAgreeChange(e) {
    const v = (e.detail && e.detail.value) || [];
    this.setData({ agreed: v.indexOf('ok') >= 0 });
  },

  openDoc(e) {
    const type = e.currentTarget.dataset.type;
    if (!type) return;
    wx.navigateTo({ url: `/pages/legal-view/legal-view?type=${type}` });
  },

  async onEnter() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先勾选同意', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    try {
      await app.wxLogin();
      wx.setStorageSync('mp_privacy_ok_v1', '1');
      wx.switchTab({ url: '/pages/home/home' });
    } catch (err) {
      const msg = (err && err.message) || '登录失败';
      wx.showToast({ title: msg, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onShow() {
    if (wx.getStorageSync('mp_privacy_ok_v1')) {
      wx.switchTab({ url: '/pages/home/home' });
    }
  },
});
