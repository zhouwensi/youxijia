# JavaScript 源代码目录

这是 JS 源代码目录，所有修改应该在这里进行。

## 文件说明

- `app.js` - 主应用逻辑
- `security.js` - 安全保护脚本（DevTools检测等）

## 构建命令

```bash
# 开发环境（轻度混淆，方便调试）
npm run build

# 生产环境（高强度混淆）
npm run build:prod
```

## 注意事项

1. **修改代码后**需要重新运行构建命令
2. **不要直接修改** `public/js/` 下的文件，那是混淆后的生产代码
3. 运行 `start.bat` 会自动执行生产构建