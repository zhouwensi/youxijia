// 用户状态检查API（封禁状态、DevTools白名单等）
const db = require('../_lib/db');

module.exports = async (req, res) => {
  const { method } = req;

  if (method !== 'GET') {
    return res.status(405).json({ success: false, error: '不支持的请求方法' });
  }

  try {
    const accountId = req.query.accountId;
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection?.remoteAddress || '';
    const clientIp = ip.split(',')[0].trim();

    let result = {
      success: true,
      ip: clientIp,
      banned: false,
      banReason: null,
      banExpireAt: null,
      allowDevTools: false
    };

    // 检查IP是否被封禁
    const ipBanInfo = await db.isIPBanned(clientIp);
    if (ipBanInfo) {
      result.banned = true;
      result.banType = 'ip';
      result.banReason = ipBanInfo.reason;
      result.banExpireAt = ipBanInfo.expireAt;
    }

    // 检查账号是否被封禁
    if (accountId) {
      const accountBanInfo = await db.isAccountBanned(accountId);
      if (accountBanInfo) {
        result.banned = true;
        result.banType = 'account';
        result.banReason = accountBanInfo.reason;
        result.banExpireAt = accountBanInfo.expireAt;
      }
    }

    // 检查是否在DevTools白名单中
    const isWhitelisted = await db.isInDevToolsWhitelist(accountId, clientIp);
    result.allowDevTools = isWhitelisted;

    return res.json(result);
  } catch (error) {
    console.error('用户状态检查失败:', error);
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
};
