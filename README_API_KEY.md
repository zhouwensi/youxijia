# API Key 配置说明

## 当前项目状态

**本项目目前不包含 LLM/AI 功能**，因此不需要配置 API Key。

这是一个纯前端的游戏开发平台，使用 Phaser.js 游戏引擎来运行游戏。

## 如果需要添加 AI 功能

如果您想添加 AI 功能（例如：AI 生成游戏内容、AI 辅助设计等），可以按照以下方式配置：

### 方式一：使用环境变量（推荐）

1. 在项目根目录创建 `.env` 文件
2. 添加您的 API Key：

```env
VITE_OPENAI_API_KEY=sk-your-key-here
# 或
VITE_LLM_API_KEY=your-key-here
```

3. 在代码中使用：

```typescript
const apiKey = import.meta.env.VITE_OPENAI_API_KEY
```

### 方式二：创建配置文件

创建 `src/config/api.ts`：

```typescript
export const API_CONFIG = {
  OPENAI_API_KEY: 'your-key-here',
  LLM_API_URL: 'https://api.example.com/v1'
}
```

**注意**：不要将包含真实 API Key 的文件提交到 Git 仓库！

## 环境变量文件

- `.env` - 本地开发环境（不要提交到 Git）
- `.env.example` - 示例文件（可以提交到 Git）
