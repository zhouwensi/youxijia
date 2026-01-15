// POST /api/referral/reward - 在首次成功生成游戏时触发邀请奖励
const db = require('../_lib/db');

// 每日邀请奖励上限
const DAILY_REFERRAL_LIMIT = 100;
// 每次邀请奖励积分
const REFERRAL_REWARD_POINTS = 1;

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Account-Id');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  try {
    const accountId = req.headers['x-account-id'];
    
    if (!accountId) {
      return res.status(400).json({ success: false, error: '缺少账户ID' });
    }
    
    // 检查该用户是否有被邀请记录
    const referral = await db.getReferral(accountId);
    
    if (!referral) {
      // 没有邀请关系，不需要处理
      return res.json({ success: true, rewarded: false, reason: '无邀请关系' });
    }
    
    if (referral.rewarded) {
      // 已经奖励过了
      return res.json({ success: true, rewarded: false, reason: '已奖励过' });
    }
    
    // 检查邀请者今日奖励次数是否已达上限
    const inviterDailyCount = await db.getDailyReferralCount(referral.inviter);
    if (inviterDailyCount >= DAILY_REFERRAL_LIMIT) {
      // 邀请者今日已达上限，仍标记为已处理但不发放奖励
      await db.markReferralRewarded(accountId);
      return res.json({ 
        success: true, 
        rewarded: false, 
        reason: '邀请者今日奖励已达上限',
        dailyLimit: DAILY_REFERRAL_LIMIT
      });
    }
    
    // 发放奖励
    // 1. 标记邀请关系已奖励
    await db.markReferralRewarded(accountId);
    
    // 2. 增加邀请者今日奖励计数
    await db.incrementDailyReferralCount(referral.inviter);
    
    // 注意：实际积分增加需要在有积分系统的地方处理
    // 这里返回奖励信息，让前端/其他系统处理积分增加
    
    console.log(`[REFERRAL] 邀请奖励触发: 邀请者=${referral.inviter}, 被邀请者=${accountId}, 双方各得${REFERRAL_REWARD_POINTS}积分`);
    
    return res.json({
      success: true,
      rewarded: true,
      inviter: referral.inviter,
      invitee: accountId,
      rewardPoints: REFERRAL_REWARD_POINTS,
      message: `🎉 邀请奖励已发放！你和邀请者各获得 ${REFERRAL_REWARD_POINTS} 积分`
    });
    
  } catch (error) {
    console.error('处理邀请奖励失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
