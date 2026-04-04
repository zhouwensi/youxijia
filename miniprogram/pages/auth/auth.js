/**
 * 邮箱注册 / 登录 / 修改密码（与网站共用 Worker 接口）
 */
const app = getApp();

Page({
  data: {
    mode: '',
    authTab: 'login',
    loginAccount: '',
    loginPassword: '',
    regEmail: '',
    regPassword: '',
    regPassword2: '',
    regNickname: '',
    oldPassword: '',
    newPassword: '',
    newPassword2: '',
    error: '',
    loading: false
  },

  onLoad(options) {
    const mode = options.mode === 'changepwd' ? 'changepwd' : '';
    if (mode === 'changepwd' && !app.globalData.token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ mode, authTab: options.tab === 'register' ? 'register' : 'login' });
  },

  switchTab(e) {
    this.setData({ authTab: e.currentTarget.dataset.tab, error: '' });
  },

  onLoginAccount(e) {
    this.setData({ loginAccount: e.detail.value });
  },
  onLoginPassword(e) {
    this.setData({ loginPassword: e.detail.value });
  },
  onRegEmail(e) {
    this.setData({ regEmail: e.detail.value });
  },
  onRegPassword(e) {
    this.setData({ regPassword: e.detail.value });
  },
  onRegPassword2(e) {
    this.setData({ regPassword2: e.detail.value });
  },
  onRegNickname(e) {
    this.setData({ regNickname: e.detail.value });
  },
  onOldPwd(e) {
    this.setData({ oldPassword: e.detail.value });
  },
  onNewPwd(e) {
    this.setData({ newPassword: e.detail.value });
  },
  onNewPwd2(e) {
    this.setData({ newPassword2: e.detail.value });
  },

  applySession(token, account) {
    const userInfo = {
      account_id: account.accountId || account.account_id,
      nickname: account.nickname || account.account_id,
      avatar_emoji: '🎮',
      credits: 0
    };
    app.globalData.token = token;
    app.globalData.userInfo = userInfo;
    app.globalData.isLoggedIn = true;
    app.globalData.accountId = userInfo.account_id;
    wx.setStorageSync('token', token);
    wx.setStorageSync('userInfo', userInfo);
  },

  async submitLogin() {
    const accountId = (this.data.loginAccount || '').trim();
    const password = this.data.loginPassword || '';
    if (!accountId || !password) {
      this.setData({ error: '请填写账号和密码' });
      return;
    }
    this.setData({ loading: true, error: '' });
    try {
      const data = await app.request('/api/account/login', {
        method: 'POST',
        data: { accountId, password }
      });
      if (data.success && data.userToken) {
        this.applySession(data.userToken, data.account || {});
        wx.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 400);
      } else {
        this.setData({ error: data.error || '登录失败' });
      }
    } catch (err) {
      this.setData({ error: err.message || '网络错误' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async submitRegister() {
    const email = (this.data.regEmail || '').trim();
    const password = this.data.regPassword || '';
    const password2 = this.data.regPassword2 || '';
    const nickname = (this.data.regNickname || '').trim();
    if (!email) {
      this.setData({ error: '请输入邮箱' });
      return;
    }
    if (password.length < 8) {
      this.setData({ error: '密码至少 8 位' });
      return;
    }
    if (password !== password2) {
      this.setData({ error: '两次密码不一致' });
      return;
    }
    this.setData({ loading: true, error: '' });
    try {
      const data = await app.request('/api/account/register', {
        method: 'POST',
        data: { email, password, nickname: nickname || undefined }
      });
      if (data.success && data.userToken) {
        this.applySession(data.userToken, data.account || {});
        wx.showToast({ title: '注册成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 400);
      } else {
        this.setData({ error: data.error || '注册失败' });
      }
    } catch (err) {
      this.setData({ error: err.message || '网络错误' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async wxLoginOnly() {
    this.setData({ loading: true, error: '' });
    try {
      await app.wxLogin();
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 400);
    } catch (err) {
      this.setData({ error: err.message || '微信登录失败' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async submitChangePwd() {
    const oldPassword = this.data.oldPassword || '';
    const newPassword = this.data.newPassword || '';
    const newPassword2 = this.data.newPassword2 || '';
    if (!newPassword || newPassword.length < 8) {
      this.setData({ error: '新密码至少 8 位' });
      return;
    }
    if (newPassword !== newPassword2) {
      this.setData({ error: '两次新密码不一致' });
      return;
    }
    this.setData({ loading: true, error: '' });
    try {
      const data = await app.request('/api/account/change-password', {
        method: 'POST',
        data: { oldPassword, newPassword }
      });
      if (data.success) {
        wx.showToast({ title: '已更新', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 400);
      } else {
        this.setData({ error: data.error || '修改失败' });
      }
    } catch (err) {
      this.setData({ error: err.message || '网络错误' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
