/**
 * 激励视频广告奖励 API
 * POST /api/credits/watch-ad - 观看广告后发放积分奖励
 * 
 * 【预留接口】待 500UV 后启用
 * 启用步骤：
 * 1. 在微信公众平台申请激励视频广告位
 * 2. 获取广告单元ID并配置到 siteConfig.ads.rewardedVideoAdUnitId
 * 3. 将下方 FEATURE_ENABLED 改为 true
 * 4. 在小程序端集成 wx.createRewardedVideoAd API
 */

const db = require('../_lib/db');

// 功能开关（待500UV后启用）
const FEATURE_ENABLED = false;

// 每日观看广告次数限制
const DAILY_AD_LIMIT = 5;

// 每次观看广告奖励积分
const AD_REWARD_CREDITS = 2;

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

  // 检查功能是否启用
  if (!FEATURE_ENABLED) {
    return res.status(200).json({ 
      success: false, 
      error: '此功能暂未开放',
      featureDisabled: true,
      message: '激励视频广告功能将在后续版本开放，敬请期待！'
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
    
    // 检查今日观看次数
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM credit_records 
       WHERE account_id = ? AND action = 'watch_ad' AND DATE(created_at) = ?`,
      [accountId, today]
    );
    
    const todayCount = countResult.rows[0]?.count || 0;
    
    if (todayCount >= DAILY_AD_LIMIT) {
      return res.status(200).json({ 
        success: false, 
        error: `今日观看次数已达上限（${DAILY_AD_LIMIT}次）`,
        todayCount,
        dailyLimit: DAILY_AD_LIMIT
      });
    }
    
    // 发放积分奖励
    await db.query(
      `UPDATE accounts SET credits = credits + ? WHERE id = ?`,
      [AD_REWARD_CREDITS, accountId]
    );
    
    // 记录积分变动
    await db.query(
      `INSERT INTO credit_records (account_id, credits, action, description, created_at)
       VALUES (?, ?, 'watch_ad', '观看激励视频广告', NOW())`,
      [accountId, AD_REWARD_CREDITS]
    );
    
    // 获取最新积分
    const creditsResult = await db.query(
      'SELECT credits FROM accounts WHERE id = ?',
      [accountId]
    );
    
    const newCredits = creditsResult.rows[0]?.credits || 0;
    
    return res.status(200).json({
      success: true,
      message: `恭喜获得 ${AD_REWARD_CREDITS} 积分！`,
      creditsAwarded: AD_REWARD_CREDITS,
      credits: newCredits,
      todayCount: todayCount + 1,
      dailyLimit: DAILY_AD_LIMIT,
      remainingToday: DAILY_AD_LIMIT - todayCount - 1
    });
    
  } catch (error) {
    console.error('[Watch Ad API] 发放广告奖励失败:', error);
    return res.status(500).json({ 
      success: false, 
      error: '服务器错误'
    });
  }
};
