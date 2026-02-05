/**
 * 成就列表 API
 * GET /api/achievements - 获取用户成就列表及进度
 */

const db = require('../_lib/db');

module.exports = async (req, res) => {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: '方法不允许' });
  }

  try {
    const userToken = req.headers['x-user-token'];
    
    // 获取所有成就定义
    const achievementsResult = await db.query(`
      SELECT 
        id, category, name, description, icon, 
        action_type, target_value, reward_credits,
        is_repeatable, reset_period, is_hidden
      FROM achievements 
      WHERE is_hidden = 0
      ORDER BY category, target_value ASC
    `);
    
    const achievements = achievementsResult.rows || [];
    
    // 如果用户已登录，获取用户成就进度
    let userProgress = {};
    let accountId = null;
    
    if (userToken) {
      // 查询用户账号
      const accountResult = await db.query(
        'SELECT account_id FROM user_tokens WHERE token = ?',
        [userToken]
      );
      
      if (accountResult.rows && accountResult.rows.length > 0) {
        accountId = accountResult.rows[0].account_id;
        
        // 获取用户成就进度
        const progressResult = await db.query(`
          SELECT 
            achievement_id, current_value, status, claimed, 
            claimed_at, completed_at, last_updated
          FROM user_achievements 
          WHERE account_id = ?
        `, [accountId]);
        
        // 转换为 map 方便查询
        (progressResult.rows || []).forEach(p => {
          userProgress[p.achievement_id] = p;
        });
      }
    }
    
    // 合并成就定义和用户进度
    const result = achievements.map(achievement => {
      const progress = userProgress[achievement.id] || {};
      
      return {
        id: achievement.id,
        category: achievement.category,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        action_type: achievement.action_type,
        target_value: achievement.target_value,
        reward_credits: achievement.reward_credits,
        is_repeatable: achievement.is_repeatable === 1,
        reset_period: achievement.reset_period,
        // 用户进度
        current_value: progress.current_value || 0,
        status: progress.status || 'locked', // locked, in_progress, completed
        claimed: progress.claimed === 1,
        claimed_at: progress.claimed_at,
        completed_at: progress.completed_at
      };
    });
    
    // 统计可领取数量
    const claimableCount = result.filter(a => a.status === 'completed' && !a.claimed).length;
    
    return res.status(200).json({
      success: true,
      achievements: result,
      claimableCount,
      accountId: accountId ? accountId.substring(0, 8) + '...' : null
    });
    
  } catch (error) {
    console.error('[Achievements API] 获取成就列表失败:', error);
    return res.status(500).json({ 
      success: false, 
      error: '服务器错误',
      achievements: [] // 返回空数组确保前端不报错
    });
  }
};
