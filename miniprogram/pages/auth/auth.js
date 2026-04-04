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
    bindEmail: '',
    bindPassword: '',
    bindPassword2: '',
    alreadyBound: false,
    boundEmail: '',
    error: '',
    loading: false
  },

  onLoad(options) {
    if (options.mode === 'changepwd') {
      if (!app.globalData.token) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }
      wx.setNavigationBarTitle({ title: '修改密码' });
      this.setData({ mode: 'changepwd' });
      return;
    }
    if (options.mode === 'bindEmail') {
      if (!app.globalData.token) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }
      wx.setNavigationBarTitle({ title: '绑定邮箱' });
      this.setData({ mode: 'bindEmail' });
      this.checkBoundEmail();
      return;
    }
    this.setData({ mode: '', authTab: options.tab === 'register' ? 'register' : 'login' });
  },

  async checkBoundEmail() {
    try {
      const d = await app.request('/api/account');
      const acc = d.account || d.data || d;
      const em = acc && acc.email ? String(acc.email).trim() : '';
      if (em) {
        this.setData({ alreadyBound: true, boundEmail: em, error: '' });
      } else {
        this.setData({ alreadyBound: false, boundEmail: '', error: '' });
      }
    } catch (e) {
      this.setData({ alreadyBound: false, error: '' });
    }
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
  onBindEmail(e) {
    this.setData({ bindEmail: e.detail.value });
  },
  onBindPassword(e) {
    this.setData({ bindPassword: e.detail.value });
  },
  onBindPassword2(e) {
    this.setData({ bindPassword2: e.detail.value });
  },

  applySession(token, account) {
    const userInfo = {
      account_id: account.accountId || account.account_id,
      nickname: account.nickname || account.account_id,
      avatar_emoji: '🎮',
      credits: account.credits ?? 0,
      email: account.email || ''
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
        this.applySession(data.userToken, { ...(data.account || {}), credits: data.credits });
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

  async submitBindEmail() {
    const email = (this.data.bindEmail || '').trim();
    const password = this.data.bindPassword || '';
    const password2 = this.data.bindPassword2 || '';
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
      const data = await app.request('/api/account/bind-email', {
        method: 'POST',
        data: { email, password }
      });
      if (data.success) {
        this.applySession(data.userToken || app.globalData.token, data.account || {});
        wx.showToast({ title: '绑定成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 500);
      } else {
        this.setData({ error: data.error || '绑定失败' });
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
