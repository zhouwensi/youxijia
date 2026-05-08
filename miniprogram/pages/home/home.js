/**
 * 权益首页：基础兑换码免费领取；高级兑换码仅用户主动点击激励视频后发放。
 * 文案不出现站外、浏览器、外链等敏感表述。
 */
const app = getApp();

const CARDS_DEF = [
  {
    id: 'yx',
    emoji: '🎮',
    title: '创作类兑换码',
    sub: '基础：每日1次 · 高级：每日最多3次（需主动观看激励视频）',
    kindB: 'YXS_BASIC',
    kindP: 'YXS_PREMIUM',
  },
  {
    id: 'md',
    emoji: '🪦',
    title: '纪念类兑换码',
    sub: '基础：每日1次 · 高级：每日最多2次（需主动观看激励视频）',
    kindB: 'MYN_BASIC',
    kindP: 'MYN_PREMIUM',
  },
  {
    id: 'cs',
    emoji: '📊',
    title: '趣味测试类兑换码',
    sub: '基础：每日1次 · 高级：每日最多2次（需主动观看激励视频）',
    kindB: 'CSC_BASIC',
    kindP: 'CSC_PREMIUM',
  },
];

Page({
  data: {
    role: 'dev',
    cards: [],
    bannerUnitId: '',
    showCode: false,
    dlgCode: '',
  },

  rewardedVideoAd: null,
  interstitialAd: null,
  pendingPremiumKind: '',
  _coldSplashDone: false,
  _rewardedVideoUnitId: '',
  _interstitialUnitId: '',

  rewardedVideoUnitId() {
    const g = app.globalData || {};
    const uid = String(
      g.config?.rewardedVideoAdUnitId ||
        g.siteConfig?.rewardedVideoAdUnitId ||
        g.siteConfig?.extraConfig?.ads?.rewardedVideoAdUnitId ||
        ''
    ).trim();
    return uid;
  },

  onLoad() {
    this.onLoadRole();
    this.refreshAdsFromConfig();
  },

  syncAdUnits() {
    const g = app.globalData || {};
    const cfg = g.siteConfig || {};
    const ex = cfg.extraConfig || {};
    const ads = ex.ads || {};
    const banner =
      cfg.miniBannerAdUnitId ||
      ads.miniBannerAdUnitId ||
      ads.bannerAdUnitId ||
      g.config?.miniBannerAdUnitId ||
      '';
    this.setData({ bannerUnitId: banner || '' });
  },

  /** 站点配置在 App.onLaunch 里异步加载，onLoad 常早于配置返回，需在 onShow / 配置回调里再次执行 */
  refreshAdsFromConfig() {
    this.syncAdUnits();
    this.initRewarded();
    this.initInterstitial();
  },

  initRewarded() {
    const uid = this.rewardedVideoUnitId();
    if (!uid || !wx.createRewardedVideoAd) {
      if (this.rewardedVideoAd) {
        try {
          this.rewardedVideoAd.destroy();
        } catch (_) {}
        this.rewardedVideoAd = null;
      }
      this._rewardedVideoUnitId = '';
      return;
    }
    if (this._rewardedVideoUnitId === uid && this.rewardedVideoAd) return;
    if (this.rewardedVideoAd) {
      try {
        this.rewardedVideoAd.destroy();
      } catch (_) {}
      this.rewardedVideoAd = null;
    }
    this._rewardedVideoUnitId = uid;
    const ad = wx.createRewardedVideoAd({ adUnitId: uid });
    this.rewardedVideoAd = ad;
    ad.onClose((res) => {
      if (res && res.isEnded === false) {
        wx.showToast({ title: '未看完视频，未发放高级兑换码', icon: 'none' });
        this.pendingPremiumKind = '';
        return;
      }
      const kind = this.pendingPremiumKind;
      this.pendingPremiumKind = '';
      if (!kind) return;
      this.claimKind(kind, true);
    });
    ad.onError(() => {
      wx.showToast({ title: '广告暂时不可用', icon: 'none' });
      this.pendingPremiumKind = '';
    });
  },

  initInterstitial() {
    const uid = String(
      app.globalData?.config?.interstitialAdUnitId ||
        app.globalData?.siteConfig?.extraConfig?.ads?.interstitialAdUnitId ||
        ''
    ).trim();
    if (!uid || !wx.createInterstitialAd) {
      this.interstitialAd = null;
      this._interstitialUnitId = '';
      return;
    }
    if (this._interstitialUnitId === uid && this.interstitialAd) return;
    this.interstitialAd = null;
    this._interstitialUnitId = uid;
    try {
      this.interstitialAd = wx.createInterstitialAd({ adUnitId: uid });
      this.interstitialAd.onError(() => {});
    } catch (_) {
      this.interstitialAd = null;
    }
  },

  onShow() {
    if (!wx.getStorageSync('mp_privacy_ok_v1')) {
      wx.reLaunch({ url: '/pages/consent/consent' });
      return;
    }
    this.refreshAdsFromConfig();
    this.ensureLoginAndRefresh();
    if (!this._coldSplashDone) {
      this._coldSplashDone = true;
      setTimeout(() => this.tryColdSplash(), 800);
    }
  },

  tryColdSplash() {
    const uid =
      app.globalData?.config?.splashAdUnitId ||
      app.globalData?.siteConfig?.extraConfig?.ads?.splashAdUnitId ||
      '';
    if (uid && wx.createSplashAd) {
      try {
        const sp = wx.createSplashAd({ adUnitId: uid });
        sp.show().catch(() => {});
        return;
      } catch (_) {}
    }
    if (this.interstitialAd) {
      this.interstitialAd.show().catch(() => {});
    }
  },

  async ensureLoginAndRefresh() {
    try {
      // 每次静默换 code：避免本地仅有旧 user_token、D1 无 mp_openid 时 quotas 返回 400
      await app.wxLogin();
    } catch (e) {
      wx.showToast({ title: '请先完成微信登录', icon: 'none' });
    }
    await this.refreshQuotas();
  },

  async refreshQuotas() {
    try {
      const res = await app.request('/api/mp/privilege/quotas', {
        method: 'GET',
        header: { 'x-platform': 'miniprogram' },
      });
      const q = (res && res.quotas) || {};
      const cards = CARDS_DEF.map((c) => {
        const b = q[c.kindB] || { used: 0, limit: 1 };
        const p = q[c.kindP] || { used: 0, limit: 1 };
        const basicDisabled = b.used >= b.limit;
        const premiumDisabled = p.used >= p.limit;
        return {
          ...c,
          basicDisabled,
          premiumDisabled,
          basicLabel: basicDisabled ? '今日已领完，明日再来' : '免费领基础兑换码',
          premiumLabel: premiumDisabled ? '今日已领完，明日再来' : '看视频领高级兑换码',
        };
      });
      this.setData({ cards });
    } catch (_) {
      const cards = CARDS_DEF.map((c) => ({
        ...c,
        basicDisabled: false,
        premiumDisabled: false,
        basicLabel: '免费领基础兑换码',
        premiumLabel: '看视频领高级兑换码',
      }));
      this.setData({ cards });
    }
  },

  onRoleChange(e) {
    const v = e.detail.value;
    wx.setStorageSync('mp_role_stat', v);
    this.setData({ role: v });
  },

  onLoadRole() {
    const r = wx.getStorageSync('mp_role_stat');
    if (r === 'player') this.setData({ role: 'player' });
  },

  onClaimBasic(e) {
    const kind = e.currentTarget.dataset.kind;
    if (!kind) return;
    this.claimKind(kind, false);
  },

  onClaimPremiumTap(e) {
    const kind = e.currentTarget.dataset.kind;
    if (!kind) return;
    wx.showModal({
      title: '激励视频说明',
      content: '观看完整视频后可领取高级兑换码；中途关闭不会发放，也不会影响您使用基础免费领取。',
      confirmText: '继续',
      cancelText: '取消',
      success: (r) => {
        if (!r.confirm) return;
        this.initRewarded();
        if (!this.rewardedVideoAd) {
          wx.showModal({
            title: '暂无法播放激励视频',
            content:
              '当前未获取到激励视频广告位 ID。请确认：1）小程序已开通流量主并创建「激励式视频广告」；2）将广告单元 ID 配置到服务端环境变量 REWARDED_VIDEO_AD_UNIT_ID（Cloudflare Worker / Pages 控制台），保存后下拉首页重试。',
            showCancel: false,
            confirmText: '知道了',
          });
          return;
        }
        this.pendingPremiumKind = kind;
        this.rewardedVideoAd
          .show()
          .catch(() => {
            wx.showToast({ title: '广告加载失败', icon: 'none' });
            this.pendingPremiumKind = '';
          });
      },
    });
  },

  async claimKind(kind, fromVideo) {
    try {
      wx.showLoading({ title: '领取中', mask: true });
      const res = await app.request('/api/mp/privilege/claim', {
        method: 'POST',
        header: { 'x-platform': 'miniprogram' },
        data: { kind },
      });
      wx.hideLoading();
      if (!res || !res.success) {
        wx.showToast({ title: (res && res.error) || '领取失败', icon: 'none' });
        await this.refreshQuotas();
        return;
      }
      this.setData({ showCode: true, dlgCode: res.code || '' });
      await this.refreshQuotas();
      if (fromVideo) {
        // 合规：激励视频仅绑定高级码，不在此重复扣视频
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: (err && err.message) || '网络异常', icon: 'none' });
      await this.refreshQuotas();
    }
  },

  copyDlg() {
    const c = this.data.dlgCode;
    if (!c) return;
    wx.setClipboardData({ data: c });
  },

  async closeDlg() {
    this.setData({ showCode: false, dlgCode: '' });
    await this.maybePostInterstitial();
  },

  noop() {},

  async maybePostInterstitial() {
    try {
      const res = await app.request('/api/mp/privilege/interstitial-log', {
        method: 'POST',
        header: { 'x-platform': 'miniprogram' },
        data: {},
      });
      if (res && res.success && this.interstitialAd) {
        this.interstitialAd.show().catch(() => {});
      }
    } catch (_) {
      /* 达上限或网络错误则静默 */
    }
  },

  onBannerErr() {},
});
