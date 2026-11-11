# AI-new-skin

**65 张 AI 娘壁纸，一键变成 Harness 的皮肤。**

Two things, one click each:

- **设为 Harness 背景** —— 只改编辑器：把这张图铺在 Harness 后面，会话、侧栏、面板照常工作。选择记在浏览器本地，下次打开自动恢复。
- **设为 Windows 桌面壁纸** —— 交给 Harness 的宿主进程调用 `SystemParametersInfo`，换掉整台电脑的桌面。

## 安装

**方式一：插件市场**
插件市场搜索 `AI-new-skin`（上架后），点安装。

**方式二：把仓库链接复制给 Harness**
在对话框里直接说：

> 帮我安装 https://github.com/<you>/ai-new-skin

或者用插件管理器安装：

```
plugin_manager install_bundle  target: <npm 包名 / github:own/repo / 本地目录>
```

**方式三：本地目录**
把本仓库放到任意目录，`install_bundle` 的 `target` 填这个绝对路径即可（开发调试用这个）。

装完重启 Harness（首次安装是 `restart-required`），然后 **设置 → AI 壁纸**。

## 用法

1. 打开 **设置**，左侧找到 **AI 壁纸**。
2. 顶部按分组筛选：`全部` / `单张` / `一行两列` / `两行两列`。
3. 点一张图选中，然后：
   - 点 **设为 Harness 背景** —— 立即生效；
   - 点 **设为桌面壁纸** —— 换 Windows 桌面；
   - 点 **恢复默认** —— 去掉背景（桌面壁纸不受影响）。
4. 双击缩略图 = 直接设为 Harness 背景。

## 壁纸分组

| 分组 | 数量 | 说明 |
| --- | --- | --- |
| 单张 | 37 | 单张整图，直接当背景或桌面壁纸 |
| 一行两列 | 16 | 8 组 × A/B，左右两半，可拼成宽屏 |
| 两行两列 | 12 | 3 组 × A/B/C/D，四宫格，可拼成 2×2 大图 |

> 拼图目前要手动：把同名的 A/B（或 A/B/C/D）用图片工具横向/四宫格拼好再设桌面壁纸。插件读取的是 `pic/` 下的原图。

## 它做了什么（技术）

| 半边 | 文件 | 职责 |
| --- | --- | --- |
| Host | `index.js` | 注册 `webServer` 前缀路由 `/ai-new-skin`：<br>`GET /api/list` 列清单 · `GET /img/<路径>` 发图（带 ETag、304、路径越界拦截）· `POST /api/desktop` 换 Windows 壁纸 |
| Client | `client.js` | 注册 `settings.section`（id `ai-new-skin`），渲染壁纸网格；用一段 `<style>` 覆盖 `html` 背景并把顶层容器设为透明 |

- 只走本机回环（非 loopback 请求返回 403），不联网。
- 图片按需流式发送，不预加载、不打包进 JS。
- 换桌面壁纸用 `SystemParametersInfo(SPI_SETDESKWALLPAPER, …, 0x01|0x02)`，同时刷新缓存。

## 目录

```
pic/                 65 张壁纸（单张 / 一行两列 / 两行两列）
index.js             Host：路由 + 桌面壁纸
client.js            Client：设置页 + 背景应用
cordis.patch.yml     插件行
locale/{zh,en}.json  市场与设置里显示的名称/描述
icon.jpg             插件图标（256×256）
```

## 开发

```sh
node --check index.js && node --check client.js
node test-route.mjs        # 不开 DSH，直接跑一遍 Host 路由
```

改完 `client.js` 需要重启 Harness（客户端 bundle 在启动时装配）。

## 许可

MIT。壁纸为 AI 生成图像，随仓库分发。
