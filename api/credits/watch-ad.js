/**
 * 激励视频广告奖励 API
 * POST /api/credits/watch-ad - 观看广告后发放积分奖励
 * 
 * 配置项：
 * - credits_ad_enabled: 功能开关（默认false）
 * - credits_ad_reward: 每次观看奖励积分（默认3）
 * - credits_ad_daily_limit: 每日观看上限（默认30）
 */

const db = require('../_lib/db');

// 从配置读取设置
function getConfig(key, defaultValue) {
  try {
    const result = db.query('SELECT value FROM system_config WHERE key = ?', [key]);
    if (result.rows && result.rows.length > 0) {
      return result.rows[0].value;
    }
  } catch (error) {
    console.error(`[Watch Ad API] 读取配置失败 ${key}:`, error);
  }
  return defaultValue;
}

module.exports = async (req, res) => {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Token, X-Platform');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '方法不允许' });
  }

  // 从配置读取功能开关
  const featureEnabled = getConfig('credits_ad_enabled', 'false') === 'true';
  
  // 检查功能是否启用
  if (!featureEnabled) {
    return res.status(200).json({ 
      success: false, 
      error: '此功能暂未开放',
      featureDisabled: true,
      message: '激励视频广告功能暂未启用，请联系管理员'
    });
  }

  try {
    const userToken = req.headers['x-user-token'];
    const platform = req.headers['x-platform'] || 'unknown';
    
    // 仅限小程序端调用
    if (platform !== 'miniprogram') {
      return res.status(403).json({ 
        success: false, 
        error: '此功能仅限小程序使用'
      });
    }
    
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
    const today = new Date().toISOString().split('T')[0];
    
    // 从配置读取奖励积分和每日上限
    const adReward = parseFloat(getConfig('credits_ad_reward', '3'));
    const dailyLimit = parseInt(getConfig('credits_ad_daily_limit', '30'));
    
    // 检查今日观看次数
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM credit_records 
       WHERE account_id = ? AND action = 'watch_ad' AND DATE(created_at) = ?`,
      [accountId, today]
    );
    
    const todayCount = countResult.rows[0]?.count || 0;
    
    if (todayCount >= dailyLimit) {
      return res.status(200).json({ 
        success: false, 
        error: `今日观看次数已达上限（${dailyLimit}次）`,
        todayCount,
        dailyLimit: dailyLimit
      });
    }
    
    // 发放积分奖励
    await db.query(
      `UPDATE accounts SET credits = credits + ? WHERE id = ?`,
      [adReward, accountId]
    );
    
    // 记录积分变动
    await db.query(
      `INSERT INTO credit_records (account_id, credits, action, description, created_at)
       VALUES (?, ?, 'watch_ad', '观看激励视频广告', NOW())`,
      [accountId, adReward]
    );
    
    // 获取最新积分
    const creditsResult = await db.query(
      'SELECT credits FROM accounts WHERE id = ?',
      [accountId]
    );
    
    const newCredits = creditsResult.rows[0]?.credits || 0;
    
    return res.status(200).json({
      success: true,
      message: `恭喜获得 ${adReward} 积分！`,
      creditsAwarded: adReward,
      credits: newCredits,
      todayCount: todayCount + 1,
      dailyLimit: dailyLimit,
      remainingToday: dailyLimit - todayCount - 1
    });
    
  } catch (error) {
    console.error('[Watch Ad API] 发放广告奖励失败:', error);
    return res.status(500).json({ 
      success: false, 
      error: '服务器错误'
    });
  }
};
