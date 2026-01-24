# GitHub SSH Keys 设置指南（Windows）

## 步骤 1：检查现有 SSH 密钥

打开 PowerShell 终端，运行以下命令检查是否已有 SSH 密钥：

```powershell
ls -al ~/.ssh
```

如果看到 `id_rsa` 和 `id_rsa.pub` 文件，说明已有 SSH 密钥，可以直接跳到步骤 3。

## 步骤 2：生成新的 SSH 密钥

在 PowerShell 中运行以下命令生成新的 SSH 密钥，替换为你的 GitHub 邮箱：

```powershell
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

- 按 Enter 接受默认保存位置
- 输入密码（可选，用于额外安全性）

## 步骤 3：将 SSH 密钥添加到 SSH 代理

1. 启动 SSH 代理：
   ```powershell
   Start-Service ssh-agent
   ```

2. 将 SSH 私钥添加到代理：
   ```powershell
   ssh-add ~/.ssh/id_rsa
   ```

## 步骤 4：将 SSH 公钥添加到 GitHub 账户

1. 查看 SSH 公钥内容：
   ```powershell
   cat ~/.ssh/id_rsa.pub
   ```

2. 复制输出的全部内容

3. 打开 GitHub，进入：
   - 点击头像 → Settings → SSH and GPG keys → New SSH key
   - 标题：自定义名称（如 "Windows PC"）
   - 粘贴公钥到 Key 字段
   - 点击 Add SSH key

## 步骤 5：测试 SSH 连接

在 PowerShell 中运行：

```powershell
ssh -T git@github.com
```

- 首次连接会提示确认 GitHub 主机密钥，输入 `yes`
- 如果成功，会看到：`Hi username! You've successfully authenticated...`

## 步骤 6：更新 Git 远程 URL

将本地仓库的远程 URL 从 HTTPS 切换到 SSH：

```powershell
git remote set-url origin git@github.com:zhouwensi/youxijia.git
```

## 验证设置

运行以下命令确认远程 URL 已更新：

```powershell
git remote -v
```

应该看到输出包含 `git@github.com:zhouwensi/youxijia.git` 而不是 HTTPS URL。

现在你可以正常使用 `git push` 等命令，无需输入用户名和密码。