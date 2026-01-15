// 封禁管理API
const db = require('../_lib/db');

module.exports = async (req, res) => {
  // 验证管理员权限
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: '未授权' });
  }

  const { method } = req;

  try {
    // GET - 获取封禁列表
    if (method === 'GET') {
      const type = req.query.type || 'all';
      
      let result = {};
      
      if (type === 'all' || type === 'accounts') {
        result.bannedAccounts = await db.getBannedAccounts();
      }
      
      if (type === 'all' || type === 'ips') {
        result.bannedIPs = await db.getBannedIPs();
      }
      
      // 返回可用的封禁类型常量
      result.banTypes = db.BAN_TYPES;
      
      return res.json({ success: true, ...result });
    }

    // POST - 添加封禁
    if (method === 'POST') {
      const { type, target, reason, duration, hideWorks, hideMessages, banTypes } = req.body;
      
      if (!type || !target) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
      }
      
      // 验证封禁类型（如果提供）
      let validBanTypes = null;
      if (banTypes && Array.isArray(banTypes) && banTypes.length > 0) {
        const validTypes = Object.values(db.BAN_TYPES);
        validBanTypes = banTypes.filter(t => validTypes.includes(t));
        if (validBanTypes.length === 0) {
          return res.status(400).json({ success: false, error: '无效的封禁类型列表' });
        }
      }
      
      let result;
      
      if (type === 'account') {
        result = await db.banAccount(target, reason || '违规', duration, hideWorks, hideMessages, 'admin', validBanTypes);
        const banTypeNames = getBanTypeNames(result.banTypes);
        return res.json({ 
          success: true, 
          message: `账号 ${target} 已被封禁 (${banTypeNames})`, 
          banInfo: result 
        });
      } else if (type === 'ip') {
        result = await db.banIP(target, reason || '违规', duration, 'admin', validBanTypes);
        const banTypeNames = getBanTypeNames(result.banTypes);
        return res.json({ 
          success: true, 
          message: `IP ${target} 已被封禁 (${banTypeNames})`, 
          banInfo: result 
        });
      } else {
        return res.status(400).json({ success: false, error: '无效的封禁类型' });
      }
    }

    // DELETE - 解除封禁
    if (method === 'DELETE') {
      const { type, target } = req.body;
      
      if (!type || !target) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
      }
      
      if (type === 'account') {
        await db.unbanAccount(target);
        return res.json({ success: true, message: `账号 ${target} 已解封` });
      } else if (type === 'ip') {
        await db.unbanIP(target);
        return res.json({ success: true, message: `IP ${target} 已解封` });
      } else {
        return res.status(400).json({ success: false, error: '无效的类型' });
      }
    }

    return res.status(405).json({ success: false, error: '不支持的请求方法' });
  } catch (error) {
    console.error('封禁操作失败:', error);
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
};

// 获取封禁类型的中文名称
function getBanTypeNames(banTypes) {
  if (!banTypes || !Array.isArray(banTypes)) return '全部';
  
  const nameMap = {
    'access': '禁止访问',
    'comment': '禁止发言',
    'create': '禁止创作'
  };
  
  return banTypes.map(t => nameMap[t] || t).join(', ');
}