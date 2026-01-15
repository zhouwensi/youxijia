// POST /api/referral/record - 记录邀请关系（不发放奖励）
const db = require('../_lib/db');

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
    const { inviterCode } = req.body;
    const inviteeAccountId = req.headers['x-account-id'];
    
    if (!inviterCode) {
      return res.status(400).json({ success: false, error: '缺少邀请码' });
    }
    
    if (!inviteeAccountId) {
      return res.status(400).json({ success: false, error: '缺少账户ID' });
    }
    
    // 检查是否已有邀请关系
    const existingReferral = await db.getReferral(inviteeAccountId);
    if (existingReferral) {
      return res.json({ 
        success: true, 
        recorded: false, 
        reason: '已有邀请关系',
        alreadyRecorded: true
      });
    }
    
    // 不能自己邀请自己（邀请码通常是账户ID的前8位）
    if (inviteeAccountId.toUpperCase().startsWith(inviterCode.toUpperCase())) {
      return res.json({ 
        success: false, 
        error: '不能使用自己的邀请链接'
      });
    }
    
    // 记录邀请关系（inviterCode 作为邀请者标识）
    await db.recordReferral(inviterCode, inviteeAccountId);
    
    console.log(`[REFERRAL] 记录邀请关系: 邀请者=${inviterCode}, 被邀请者=${inviteeAccountId}`);
    
    return res.json({
      success: true,
      recorded: true,
      message: '邀请关系已记录，首次成功生成游戏后双方各得1积分'
    });
    
  } catch (error) {
    console.error('记录邀请关系失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
