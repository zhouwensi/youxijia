// DevTools白名单管理API
const db = require('../_lib/db');

module.exports = async (req, res) => {
  // 验证管理员权限
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: '未授权' });
  }

  const { method } = req;

  try {
    // GET - 获取白名单
    if (method === 'GET') {
      const whitelist = await db.getDevToolsWhitelist();
      return res.json({ success: true, whitelist });
    }

    // POST - 设置白名单
    if (method === 'POST') {
      const { accounts, ips } = req.body;
      
      const whitelist = {
        accounts: Array.isArray(accounts) ? accounts : [],
        ips: Array.isArray(ips) ? ips : []
      };
      
      await db.setDevToolsWhitelist(whitelist);
      return res.json({ success: true, message: 'DevTools白名单已更新', whitelist });
    }

    // PUT - 添加到白名单
    if (method === 'PUT') {
      const { type, value } = req.body;
      
      if (!type || !value) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
      }
      
      const whitelist = await db.getDevToolsWhitelist();
      
      if (type === 'account') {
        if (!whitelist.accounts.includes(value)) {
          whitelist.accounts.push(value);
        }
      } else if (type === 'ip') {
        if (!whitelist.ips.includes(value)) {
          whitelist.ips.push(value);
        }
      } else {
        return res.status(400).json({ success: false, error: '无效的类型' });
      }
      
      await db.setDevToolsWhitelist(whitelist);
      return res.json({ success: true, message: '已添加到白名单', whitelist });
    }

    // DELETE - 从白名单移除
    if (method === 'DELETE') {
      const { type, value } = req.body;
      
      if (!type || !value) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
      }
      
      const whitelist = await db.getDevToolsWhitelist();
      
      if (type === 'account') {
        whitelist.accounts = whitelist.accounts.filter(a => a !== value);
      } else if (type === 'ip') {
        whitelist.ips = whitelist.ips.filter(i => i !== value);
      } else {
        return res.status(400).json({ success: false, error: '无效的类型' });
      }
      
      await db.setDevToolsWhitelist(whitelist);
      return res.json({ success: true, message: '已从白名单移除', whitelist });
    }

    return res.status(405).json({ success: false, error: '不支持的请求方法' });
  } catch (error) {
    console.error('DevTools白名单操作失败:', error);
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
};
