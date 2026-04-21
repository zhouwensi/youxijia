/**
 * 首次启动：协议确认 + 微信登录（换取 OpenID 绑定账号，用于防刷与兑换码）
 */
const app = getApp();

Page({
  data: {
    agreed: false,
    loading: false,
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
