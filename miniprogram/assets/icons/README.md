# TabBar 图标资源

本文件夹用于存放小程序 TabBar 的图标文件。

## 需要的图标文件

| 文件名 | 说明 | 尺寸建议 |
|-------|------|---------|
| `home.png` | 首页图标（未选中） | 81×81 px |
| `home-active.png` | 首页图标（选中） | 81×81 px |
| `mine.png` | 我的图标（未选中） | 81×81 px |
| `mine-active.png` | 我的图标（选中） | 81×81 px |

## 图标要求

1. 格式：PNG，支持透明背景
2. 大小：建议不超过 40KB
3. 尺寸：81×81 像素

## 颜色方案

- 未选中状态：`#8b8b8b` (灰色)
- 选中状态：`#00d4ff` (青色/赛博朋克风格)

## 临时方案

如果暂时没有图标文件，可以在 `app.json` 中使用文字代替，将 tabBar 配置修改为：

```json
{
  "tabBar": {
    "custom": true,
    ...
  }
}
```

或者使用在线工具生成简单图标：
- https://www.iconfont.cn/
- https://icons8.com/
- https://www.flaticon.com/
