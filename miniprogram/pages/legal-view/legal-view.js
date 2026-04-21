const docs = require('../../utils/legal-docs.js');

const TITLES = {
  userAgreement: '用户服务协议',
  privacyPolicy: '隐私政策',
  redeemRules: '兑换码使用规则',
};

Page({
  data: {
    content: '',
  },

  onLoad(q) {
    const type = (q && q.type) || 'userAgreement';
    const body = docs[type] || docs.userAgreement;
    wx.setNavigationBarTitle({ title: TITLES[type] || '规则文档' });
    this.setData({ content: body });
  },
});
