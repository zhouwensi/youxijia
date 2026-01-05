# 一键游戏开发平台

一个可视化游戏开发平台，让用户无需编程即可创建和导出游戏。

## 功能特性

- 🎮 **多种游戏模板** - 平台跳跃、射击游戏、解谜游戏等
- ⚡ **可视化编辑** - 直观的界面配置游戏参数
- 👀 **实时预览** - 随时预览游戏效果
- 📦 **一键导出** - 生成完整的游戏配置文件

## 技术栈

- **前端框架**: React + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **游戏引擎**: Phaser.js
- **路由**: React Router

## 环境要求

- **Node.js**: 18.0 或更高版本
- **npm**: 9.0 或更高版本（通常随 Node.js 一起安装）

### 首次安装 Node.js

如果您的系统尚未安装 Node.js，请按照以下步骤：

#### Windows 系统

1. **方式一：直接下载安装（推荐）**
   - 访问 [Node.js 官网](https://nodejs.org/)
   - 下载 LTS（长期支持）版本
   - 运行安装程序，按提示完成安装
   - **重要**：安装时确保勾选"自动添加到 PATH"选项

2. **方式二：使用包管理器**
   ```powershell
   # 如果已安装 winget
   winget install OpenJS.NodeJS.LTS
   
   # 或使用 Chocolatey
   choco install nodejs
   ```

3. **验证安装**
   - 安装完成后，**重启终端/命令提示符**
   - 运行以下命令验证：
   ```bash
   node --version
   npm --version
   ```

#### 快速环境检测

运行项目根目录下的 `setup.bat` 脚本，它会自动检测环境并指导安装：

```bash
.\setup.bat
```

## 开始使用

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

应用将在 http://localhost:3000 启动

### 构建生产版本

```bash
npm run build
```

## 使用说明

1. **选择模板** - 在编辑页面选择一个游戏模板
2. **配置参数** - 调整游戏的基础设置、玩家属性等
3. **预览游戏** - 点击预览按钮查看游戏效果
4. **导出游戏** - 导出游戏配置文件

## 游戏控制

- **方向键** 或 **WASD** - 移动角色
- **空格** 或 **W** - 跳跃（平台游戏）

## 项目结构

```
├── src/
│   ├── pages/          # 页面组件
│   │   ├── Home.tsx    # 首页
│   │   ├── GameEditor.tsx  # 游戏编辑器
│   │   └── GamePreview.tsx # 游戏预览
│   ├── types/          # 类型定义
│   ├── data/           # 数据文件（模板等）
│   └── main.tsx        # 入口文件
├── package.json
└── vite.config.ts
```

## 许可证

MIT
