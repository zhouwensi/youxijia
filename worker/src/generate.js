/**
 * LLM 生成游戏（与 api/generate.js 逻辑对齐，供 Cloudflare Worker 使用）
 */
export const SYSTEM_PROMPT = `你是一个专业的HTML5游戏开发专家。用户会给你一句话描述，你需要生成一个完整的、可直接运行的HTML5游戏。

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
3. 射击/动作类：使用双区域操作（左半屏移动，右半屏瞄准/射击）
4. 点击类游戏：确保元素足够大（至少44x44像素），方便手指点击
5. 滑动类游戏：监听touch事件（touchstart, touchmove, touchend）
6. 必须同时监听mouse和touch事件，确保PC和手机都能玩
7. 在开始界面显示操作说明（手机：触屏/滑动，电脑：键盘）

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
    </style>
</head>
<body>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
        });
    </script>
</body>
</html>
\`\`\`

只返回完整的HTML代码，用\`\`\`html和\`\`\`包裹，不要有任何解释文字。`;

export async function runGenerate(body, env) {
  const { prompt, llmConfig } = body || {};
  if (!prompt || String(prompt).trim().length === 0) {
    return { ok: false, status: 400, body: { success: false, error: '请输入游戏描述' } };
  }

  const config = {
    provider: llmConfig?.provider || 'deepseek',
    apiKey: llmConfig?.apiKey || env.DEEPSEEK_API_KEY,
    baseUrl: llmConfig?.baseUrl || env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: llmConfig?.model || 'deepseek-chat',
  };

  if (!config.apiKey) {
    return { ok: false, status: 400, body: { success: false, error: '请配置API Key' } };
  }

  const apiPath = config.provider === 'zhipu' ? '/v4/chat/completions' : '/v1/chat/completions';
  const response = await fetch(`${config.baseUrl}${apiPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `请生成游戏：${prompt}` },
      ],
      temperature: 0.7,
      max_tokens: 16384,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    return {
      ok: false,
      status: 502,
      body: { success: false, error: `LLM API错误: ${response.status} - ${errorData.slice(0, 500)}` },
    };
  }

  const data = await response.json();
  let code = data.choices[0].message.content;

  const htmlMatch = code.match(/```html\n?([\s\S]*?)```/);
  if (htmlMatch) {
    code = htmlMatch[1].trim();
  } else {
    const altMatch = code.match(/```\n?([\s\S]*?)```/);
    if (altMatch) {
      code = altMatch[1].trim();
    } else if (code.includes('<!DOCTYPE') || code.includes('<html')) {
      code = code.trim();
    }
  }

  const titleMatch = code.match(/<title>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : String(prompt).slice(0, 50);

  return {
    ok: true,
    body: {
      success: true,
      code,
      title,
      prompt,
      debug: {
        codeLength: code.length,
        tokens: data.usage,
      },
    },
  };
}
