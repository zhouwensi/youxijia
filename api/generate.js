// POST /api/generate - 生成游戏（调用LLM）

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  const startTime = Date.now();
  console.log('\n========== 开始生成游戏 ==========');
  
  try {
    const { prompt, llmConfig } = req.body;
    console.log('[INFO] 收到生成请求:', { prompt, provider: llmConfig?.provider });
    
    if (!prompt || prompt.trim().length === 0) {
      console.log('[ERROR] 游戏描述为空');
      return res.status(400).json({ success: false, error: '请输入游戏描述' });
    }

    // 默认使用DeepSeek，优先使用用户提供的 API Key
    const config = {
      provider: llmConfig?.provider || 'deepseek',
      apiKey: llmConfig?.apiKey || process.env.DEEPSEEK_API_KEY,
      baseUrl: llmConfig?.baseUrl || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      model: llmConfig?.model || 'deepseek-chat'
    };
    
    console.log('[INFO] LLM配置:', { provider: config.provider, baseUrl: config.baseUrl, model: config.model });

    if (!config.apiKey) {
      console.log('[ERROR] API Key未配置');
      return res.status(400).json({ success: false, error: '请配置API Key' });
    }

    const systemPrompt = `你是一个专业的HTML5游戏开发专家。用户会给你一句话描述，你需要生成一个完整的、可直接运行的HTML5游戏。

【重要要求】：
1. 必须生成完整的HTML文件，包含<!DOCTYPE html>、<html>、<head>、<body>标签
2. 所有CSS样式写在<style>标签内，所有JavaScript写在<script>标签内
3. 游戏画面必须在页面加载后立即可见，不能是空白
4. 使用Canvas绑定要在DOM加载完成后进行
5. 必须包含游戏初始化代码，确保游戏元素正确渲染

【游戏要求】：
1. 游戏要有趣、可玩性强，逻辑完整
2. 必须有清晰的游戏界面：开始画面、游戏画面、结束画面
3. 界面美观，使用现代化深色主题设计
4. 适配手机和电脑屏幕

【手机触屏操作支持 - 非常重要】：
游戏必须完全支持手机触屏操作！
1. 所有需要键盘操作的地方，必须同时提供触屏按钮或手势支持
2. 移动类游戏：添加虚拟方向键或摇杆（固定在屏幕底部）
3. 射击/动作类：添加虚拟按钮（A/B按钮）
4. 点击类游戏：确保元素足够大（至少44x44像素），方便手指点击
5. 滑动类游戏：监听touch事件（touchstart, touchmove, touchend）
6. 必须同时监听mouse和touch事件，确保PC和手机都能玩
7. 在开始界面显示操作说明（手机：触屏/滑动，电脑：键盘）

示例虚拟按键CSS:
.virtual-controls { position: fixed; bottom: 20px; left: 0; right: 0; display: flex; justify-content: space-between; padding: 0 20px; z-index: 100; }
.d-pad, .action-buttons { display: flex; gap: 10px; }
.control-btn { width: 60px; height: 60px; border-radius: 50%; background: rgba(255,255,255,0.3); border: 2px solid rgba(255,255,255,0.5); display: flex; align-items: center; justify-content: center; font-size: 24px; color: white; user-select: none; -webkit-touch-callout: none; }

示例触摸事件处理:
canvas.addEventListener('touchstart', handleTouch, { passive: false });
canvas.addEventListener('touchmove', handleTouch, { passive: false });
function handleTouch(e) { e.preventDefault(); const touch = e.touches[0]; /* 处理触摸 */ }

【代码结构】：
\`\`\`html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, maximum-scale=1.0">
    <title>游戏名称</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #1a1a2e; overflow: hidden; touch-action: none; }
        /* 其他样式 */
    </style>
</head>
<body>
    <!-- 游戏容器 -->
    <script>
        // 确保DOM加载完成后初始化
        document.addEventListener('DOMContentLoaded', function() {
            // 游戏初始化代码
            // 检测是否为移动设备
            const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            // 根据设备类型显示对应控制方式
        });
    </script>
</body>
</html>
\`\`\`

只返回完整的HTML代码，用\`\`\`html和\`\`\`包裹，不要有任何解释文字。`;

    console.log('[INFO] 开始调用LLM API...');
    const apiStartTime = Date.now();
    
    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请生成游戏：${prompt}` }
        ],
        temperature: 0.7,
        max_tokens: 8000
      })
    });

    const apiTime = Date.now() - apiStartTime;
    console.log(`[INFO] LLM API响应时间: ${apiTime}ms, 状态: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.text();
      console.log('[ERROR] LLM API错误:', errorData);
      throw new Error(`LLM API错误: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('[INFO] LLM响应成功, tokens使用:', data.usage);
    
    let code = data.choices[0].message.content;
    console.log('[INFO] 原始响应长度:', code.length);
    
    // 提取HTML代码
    const htmlMatch = code.match(/```html\n?([\s\S]*?)```/);
    if (htmlMatch) {
      code = htmlMatch[1].trim();
      console.log('[INFO] 成功从markdown提取HTML代码');
    } else {
      // 尝试其他格式
      const altMatch = code.match(/```\n?([\s\S]*?)```/);
      if (altMatch) {
        code = altMatch[1].trim();
        console.log('[INFO] 从普通markdown提取代码');
      } else if (code.includes('<!DOCTYPE') || code.includes('<html')) {
        code = code.trim();
        console.log('[INFO] 直接使用响应作为HTML');
      } else {
        console.log('[WARN] 无法识别代码格式，原样使用');
      }
    }
    
    // 验证HTML结构
    const hasDoctype = code.includes('<!DOCTYPE') || code.includes('<!doctype');
    const hasHtml = code.includes('<html');
    const hasBody = code.includes('<body');
    const hasScript = code.includes('<script');
    
    console.log('[INFO] HTML结构检查:', { hasDoctype, hasHtml, hasBody, hasScript });
    console.log('[INFO] 最终代码长度:', code.length);

    // 生成标题
    const titleMatch = code.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : prompt.slice(0, 50);
    console.log('[INFO] 游戏标题:', title);

    const totalTime = Date.now() - startTime;
    console.log(`[SUCCESS] 游戏生成完成，总耗时: ${totalTime}ms`);
    console.log('========================================\n');

    res.status(200).json({ 
      success: true, 
      code,
      title,
      prompt,
      debug: {
        codeLength: code.length,
        apiTime,
        totalTime,
        tokens: data.usage
      }
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[ERROR] 生成游戏失败 (耗时${totalTime}ms):`, error.message);
    console.log('========================================\n');
    res.status(500).json({ success: false, error: error.message });
  }
};
