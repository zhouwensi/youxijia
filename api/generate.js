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

【内容合规要求 - 必须遵守】：
1. 游戏内容必须健康积极，不得包含任何违法、暴力、色情、赌博等不良内容
2. 不得生成任何涉及政治敏感、宗教争议的内容
3. 不得生成任何侵犯他人权益（如肖像权、版权）的内容
4. 游戏应适合全年龄段用户

【重要要求】：
1. 必须生成完整的HTML文件，包含<!DOCTYPE html>、<html>、<head>、<body>标签
2. 所有CSS样式写在<style>标签内，所有JavaScript写在<script>标签内
3. 游戏画面必须在页面加载后立即可见，不能是空白
4. 使用Canvas绑定要在DOM加载完成后进行
5. 必须包含游戏初始化代码，确保游戏元素正确渲染
6. 游戏界面必须包含一个"游戏说明"按钮（❓或📖图标），点击显示操作说明弹窗

【使用外部库来减少代码量 - 重要】：
对于复杂游戏，你可以使用以下CDN库来简化开发：
- Phaser.js (2D游戏引擎): <script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"></script>
- Matter.js (物理引擎): <script src="https://cdn.jsdelivr.net/npm/matter-js@0.19.0/build/matter.min.js"></script>
- Howler.js (音效): <script src="https://cdn.jsdelivr.net/npm/howler@2.2.3/dist/howler.min.js"></script>
- Anime.js (动画): <script src="https://cdn.jsdelivr.net/npm/animejs@3.2.1/lib/anime.min.js"></script>

使用这些库可以用更少的代码实现更复杂的游戏功能！

【游戏界面要求 - 非常重要】：
1. 只有3种界面状态：开始界面、游戏进行中、结束界面
2. 开始界面：显示游戏标题和"开始游戏"按钮，可以用半透明遮罩层覆盖在Canvas上
3. 游戏进行中：必须隐藏所有遮罩层，只显示Canvas游戏画面。得分、生命值等HUD信息直接用Canvas的ctx.fillText()绑制在画面上，不要用HTML覆盖层
4. 结束界面：游戏结束时才显示结果遮罩层
5. 点击"开始游戏"后，必须立即隐藏开始界面的遮罩，让玩家看到游戏画面
6. 绝对不要在游戏进行中显示任何全屏或半透明的HTML遮罩层，这会挡住游戏画面

【游戏要求】：
1. 游戏要有趣、可玩性强，逻辑完整
2. 界面美观，使用现代化深色主题设计
3. 适配手机和电脑屏幕
4. 禁止使用alert()、confirm()、prompt()等弹窗函数，所有提示信息都要在游戏界面内显示

【手机触屏操作支持 - 非常重要】：
游戏必须完全支持手机触屏操作！
1. 所有需要键盘操作的地方，必须同时提供触屏按钮或手势支持
2. 【关键】对于角色/物体移动控制：优先使用手指触摸拖动方式，而不是虚拟按钮！
   - 玩家用手指在屏幕上按住并滑动，角色跟随手指方向移动
   - 手指离开屏幕时角色停止移动
   - 这比点击方向按钮更直观流畅
3. 射击/动作类：使用双区域操作（左半屏移动，右半屏瞄准/射击）
4. 点击类游戏：确保元素足够大（至少44x44像素），方便手指点击
5. 滑动类游戏：监听touch事件（touchstart, touchmove, touchend）
6. 必须同时监听mouse和touch事件，确保PC和手机都能玩
7. 在开始界面显示操作说明（手机：触屏/滑动，电脑：键盘）

示例触摸移动控制（推荐）:
let touchStartX, touchStartY, isTouching = false;
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  isTouching = true;
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  if (!isTouching) return;
  e.preventDefault();
  const touch = e.touches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  // 根据dx, dy移动角色，角色跟随手指方向
  player.x += dx * 0.1; // 移动速度系数
  player.y += dy * 0.1;
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}, { passive: false });
canvas.addEventListener('touchend', () => { isTouching = false; });

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
    
    // 智谱AI使用 /v4/chat/completions 端点
    const apiPath = config.provider === 'zhipu' ? '/v4/chat/completions' : '/v1/chat/completions';
    const response = await fetch(`${config.baseUrl}${apiPath}`, {
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
        max_tokens: 16384
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