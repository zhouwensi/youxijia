/**
 * 我的：兑换码记录、规则中心、帮助（不出现外链/站外敏感词）
 */
const app = getApp();

const KIND_LABEL = {
  YXS_BASIC: '创作类·基础',
  YXS_PREMIUM: '创作类·高级',
  MYN_BASIC: '纪念类·基础',
  MYN_PREMIUM: '纪念类·高级',
  CSC_BASIC: '趣味测试类·基础',
  CSC_PREMIUM: '趣味测试类·高级',
};

const KIND_ORDER = [
  'YXS_BASIC',
  'YXS_PREMIUM',
  'MYN_BASIC',
  'MYN_PREMIUM',
  'CSC_BASIC',
  'CSC_PREMIUM',
];

const TYPE_OPTIONS = ['全部类型', ...KIND_ORDER.map((k) => KIND_LABEL[k])];
const STATUS_OPTIONS = ['全部状态', '待核销', '已核销', '已过期'];

Page({
  data: {
    avatarUrl: '',
    nickname: '游戏人',
    records: [],
    rawItems: [],
    typeLabels: TYPE_OPTIONS,
    statusLabels: STATUS_OPTIONS,
    typeIdx: 0,
    statusIdx: 0,
    bannerUnitId: '',
  },

  onShow() {
    if (!wx.getStorageSync('mp_privacy_ok_v1')) {
      wx.reLaunch({ url: '/pages/consent/consent' });
      return;
    }
    this.syncBanner();
    this.loadUser();
    this.loadCodes();
  },

  syncBanner() {
    const cfg = app.globalData?.siteConfig || {};
    const ads = (cfg.extraConfig && cfg.extraConfig.ads) || {};
    const banner = cfg.miniBannerMineAdUnitId || ads.miniBannerMineAdUnitId || cfg.miniBannerAdUnitId || ads.miniBannerAdUnitId || '';
    this.setData({ bannerUnitId: banner || '' });
  },

  loadUser() {
    const u = app.globalData?.userInfo || wx.getStorageSync('userInfo') || {};
    const nick = u.nickname || u.nickName || u.account_id || u.accountId || '游戏人';
    this.setData({
      nickname: nick,
      avatarUrl: u.avatarUrl || '',
    });
  },

  onTapAvatar() {
    if (typeof wx.getUserProfile !== 'function') return;
    wx.getUserProfile({
      desc: '用于展示头像昵称',
      success: (r) => {
        const u = r.userInfo || {};
        this.setData({ nickname: u.nickName || this.data.nickname, avatarUrl: u.avatarUrl || '' });
      },
    });
  },

  async loadCodes() {
    try {
      await app.wxLogin();
    } catch (_) {}
    try {
      const res = await app.request('/api/mp/privilege/my-codes', {
        method: 'GET',
        header: { 'x-platform': 'miniprogram' },
      });
      const items = (res && res.items) || [];
      const raw = items.map((it) => {
        const kind = String(it.kind || '');
        const status = String(it.status || 'pending');
        const statusLabel = status === 'used' ? '已核销' : status === 'expired' ? '已过期' : '待核销';
        const dim = status === 'used' || status === 'expired';
        return {
          ...it,
          kindLabel: KIND_LABEL[kind] || kind,
          statusLabel,
          creditsOnRedeem: it.creditsOnRedeem != null ? it.creditsOnRedeem : '',
          dim,
        };
      });
      this.setData({ rawItems: raw });
      this.applyFilter();
    } catch (_) {
      this.setData({ rawItems: [], records: [] });
    }
  },

  applyFilter() {
    const tIdx = this.data.typeIdx;
    const sIdx = this.data.statusIdx;
    const wantType = tIdx <= 0 ? null : KIND_ORDER[tIdx - 1];
    const wantStatus = sIdx <= 0 ? null : sIdx === 1 ? 'pending' : sIdx === 2 ? 'used' : 'expired';
    let list = this.data.rawItems.slice();
    if (wantType) list = list.filter((x) => String(x.kind) === wantType);
    if (wantStatus) list = list.filter((x) => String(x.status) === wantStatus);
    this.setData({ records: list });
  },

  onTypePick(e) {
    this.setData({ typeIdx: Number(e.detail.value) || 0 });
    this.applyFilter();
  },

  onStatusPick(e) {
    this.setData({ statusIdx: Number(e.detail.value) || 0 });
    this.applyFilter();
  },

  copyCode(e) {
    const c = e.currentTarget.dataset.code;
    if (!c) return;
    wx.setClipboardData({ data: String(c) });
  },

  openDoc(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({ url: `/pages/legal-view/legal-view?type=${type}` });
  },

  onBannerErr() {},
});
