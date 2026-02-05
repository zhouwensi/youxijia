/**
 * 积分明细 API
 * GET /api/credits/logs - 获取用户积分变动明细
 * 
 * 支持参数:
 * - limit: 返回条数，默认20
 * - offset: 偏移量，默认0
 * - include_stats: 是否包含统计数据，设为1时返回今日/本周/本月获取统计
 */

const db = require('../_lib/db');

module.exports = async (req, res) => {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Token, X-Platform');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: '方法不允许' });
  }

  try {
    const userToken = req.headers['x-user-token'];
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    // 获取用户账号
    const accountResult = await db.query(
      'SELECT account_id FROM user_tokens WHERE token = ?',
      [userToken]
    );
    
    if (!accountResult.rows || accountResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: '用户未登录' });
    }
    
    const accountId = accountResult.rows[0].account_id;
    
    // 解析请求参数
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const includeStats = req.query.include_stats === '1';
    
    // 获取积分明细
    const logsResult = await db.query(
      `SELECT id, credits as amount, action, description, created_at
       FROM credit_records 
       WHERE account_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [accountId, limit, offset]
    );
    
    // 格式化日期
    const logs = (logsResult.rows || []).map(log => ({
      id: log.id,
      amount: log.amount,
      action: log.action,
      description: log.description,
      created_at: formatDateTime(log.created_at)
    }));
    
    // 返回结果
    const result = {
      success: true,
      data: logs
    };
    
    // 如果需要统计数据
    if (includeStats) {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      
      // 计算本周一
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset).toISOString();
      
      // 计算本月第一天
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      // 统计今日获得的积分（只计正数）
      const todayResult = await db.query(
        `SELECT COALESCE(SUM(credits), 0) as total
         FROM credit_records 
         WHERE account_id = ? AND credits > 0 AND created_at >= ?`,
        [accountId, todayStart]
      );
      
      // 统计本周获得的积分
      const weekResult = await db.query(
        `SELECT COALESCE(SUM(credits), 0) as total
         FROM credit_records 
         WHERE account_id = ? AND credits > 0 AND created_at >= ?`,
        [accountId, weekStart]
      );
      
      // 统计本月获得的积分
      const monthResult = await db.query(
        `SELECT COALESCE(SUM(credits), 0) as total
         FROM credit_records 
         WHERE account_id = ? AND credits > 0 AND created_at >= ?`,
        [accountId, monthStart]
      );
      
      result.stats = {
        today_earned: todayResult.rows[0]?.total || 0,
        week_earned: weekResult.rows[0]?.total || 0,
        month_earned: monthResult.rows[0]?.total || 0
      };
    }
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('[Credits Logs API] 获取积分明细失败:', error);
    return res.status(500).json({ 
      success: false, 
      error: '服务器错误'
    });
  }
};

// 格式化日期时间
function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  
  // 如果是今天，只显示时间
  if (d.toDateString() === now.toDateString()) {
    return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  
  // 如果是昨天
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `昨天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  
  // 如果是今年，显示月/日 时:分
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  
  // 其他显示完整日期
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
