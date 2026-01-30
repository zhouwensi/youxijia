/**
 * 微信小程序相关工具函数
 * 包含 access_token 获取与缓存、订阅消息发送等功能
 */

// access_token 缓存（内存缓存，生产环境建议使用 Redis 等持久化存储）
let accessTokenCache = {
  token: null,
  expiresAt: 0
};

/**
 * 获取微信小程序的 access_token
 * 会自动缓存，避免频繁调用微信接口
 * @returns {Promise<string>} access_token
 */
async function getAccessToken() {
  const now = Date.now();
  
  // 如果缓存有效（提前5分钟刷新），直接返回
  if (accessTokenCache.token && accessTokenCache.expiresAt > now + 5 * 60 * 1000) {
    console.log('[WeChat] 使用缓存的 access_token');
    return accessTokenCache.token;
  }
  
  const appId = process.env.WX_APPID;
  const appSecret = process.env.WX_APPSECRET;
  
  if (!appId || !appSecret) {
    throw new Error('微信小程序配置缺失：请在环境变量中配置 WX_APPID 和 WX_APPSECRET');
  }
  
  console.log('[WeChat] 正在获取新的 access_token...');
  
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.errcode) {
    console.error('[WeChat] 获取 access_token 失败:', data);
    throw new Error(`获取 access_token 失败: ${data.errmsg} (${data.errcode})`);
  }
  
  // 更新缓存
  accessTokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000
  };
  
  console.log('[WeChat] 成功获取新的 access_token，有效期:', data.expires_in, '秒');
  return data.access_token;
}

/**
 * 发送订阅消息通知
 * @param {Object} options 发送选项
 * @param {string} options.openId 用户的 openId
 * @param {string} options.templateId 订阅消息模板ID
 * @param {Object} options.data 模板数据
 * @param {string} [options.page] 点击消息后跳转的小程序页面
 * @returns {Promise<Object>} 微信API响应
 */
async function sendSubscribeMessage({ openId, templateId, data, page }) {
  if (!openId) {
    throw new Error('发送订阅消息失败：缺少 openId');
  }
  
  if (!templateId) {
    throw new Error('发送订阅消息失败：缺少 templateId');
  }
  
  const accessToken = await getAccessToken();
  
  const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;
  
  const body = {
    touser: openId,
    template_id: templateId,
    data: data,
    miniprogram_state: process.env.NODE_ENV === 'production' ? 'formal' : 'trial', // formal-正式版, trial-体验版, developer-开发版
    lang: 'zh_CN'
  };
  
  // 如果指定了跳转页面
  if (page) {
    body.page = page;
  }
  
  console.log('[WeChat] 发送订阅消息:', { openId, templateId, page });
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  const result = await response.json();
  
  if (result.errcode !== 0) {
    console.error('[WeChat] 发送订阅消息失败:', result);
    throw new Error(`发送订阅消息失败: ${result.errmsg} (${result.errcode})`);
  }
  
  console.log('[WeChat] 订阅消息发送成功');
  return result;
}

/**
 * 发送游戏创建完成通知
 * @param {Object} options 发送选项
 * @param {string} options.openId 用户的 openId
 * @param {string} options.gameName 游戏名称
 * @param {string} options.gameId 游戏ID
 * @param {string} [options.status='创建成功'] 状态描述
 * @returns {Promise<Object>} 微信API响应
 */
async function sendGameCreatedNotification({ openId, gameName, gameId, status = '创建成功' }) {
  const templateId = process.env.WX_SUBSCRIBE_TMPL_GAME_CREATED;
  
  if (!templateId) {
    console.warn('[WeChat] 未配置游戏创建通知模板ID (WX_SUBSCRIBE_TMPL_GAME_CREATED)，跳过发送');
    return null;
  }
  
  // 格式化当前时间
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  // 构建模板数据
  // 模板字段说明（模板编号 28117 - 任务完成通知）：
  // thing1 - 任务名称
  // thing2 - 任务描述
  // time5 - 完成时间
  // thing6 - 备注
  const data = {
    thing1: { value: gameName.substring(0, 20) },   // 任务名称，最多20个字符
    thing2: { value: status.substring(0, 20) },     // 任务描述，最多20个字符
    time5: { value: timeStr },                       // 完成时间
    thing6: { value: '点击查看你的游戏' }           // 备注
  };
  
  // 跳转到游戏详情页
  const page = gameId ? `/pages/game-detail/game-detail?id=${gameId}` : '';
  
  return sendSubscribeMessage({
    openId,
    templateId,
    data,
    page
  });
}

module.exports = {
  getAccessToken,
  sendSubscribeMessage,
  sendGameCreatedNotification
};
