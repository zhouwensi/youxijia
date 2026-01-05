# 环境安装指南

## 需要安装的软件

### 1. Node.js 和 npm

本项目需要 Node.js 18+ 和 npm。

#### 方式一：直接下载安装（推荐）

1. 访问 Node.js 官网：https://nodejs.org/
2. 下载 LTS（长期支持）版本
3. 运行安装程序，按照提示完成安装
4. 安装完成后，重启终端

#### 方式二：使用包管理器

**如果使用 Chocolatey：**
```powershell
choco install nodejs
```

**如果使用 winget：**
```powershell
winget install OpenJS.NodeJS.LTS
```

### 2. 验证安装

安装完成后，打开新的终端窗口，运行以下命令验证：

```bash
node --version
npm --version
```

应该看到版本号，例如：
- Node.js: v20.x.x
- npm: 10.x.x

### 3. 安装项目依赖

在项目根目录运行：

```bash
npm install
```

### 4. 启动开发服务器

```bash
npm run dev
```

项目将在 http://localhost:3000 启动

## 故障排查

### npm 命令不识别

1. 确保已安装 Node.js
2. 重启终端或命令提示符
3. 检查环境变量 PATH 中是否包含 Node.js 路径
4. 可能需要重新安装 Node.js 并选择"添加到 PATH"选项

### 端口被占用

如果 3000 端口被占用，可以修改 `vite.config.ts` 中的端口号。

### 依赖安装失败

尝试清除缓存后重新安装：

```bash
npm cache clean --force
npm install
```

## 下一步

安装完成后，请运行：

```bash
npm install
npm run dev
```

然后访问 http://localhost:3000 查看应用。
