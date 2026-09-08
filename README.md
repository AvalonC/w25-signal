# 星间来信 · Project W25

给 Leah 的七章星光旅程。第二版采用连续星空、柔和粉色与粒子文字，适配手机触摸和键盘操作。

## 本地运行

需要 Node.js 22.13 以上。

```sh
npm ci
npm run dev
```

开发预览：http://localhost:3000/ 。

与 GitHub Pages 相同的静态版本：

```sh
npm run build:pages
npm run preview:pages
```

打开 http://localhost:4173/w25-signal/ 。同一 Wi-Fi 下可以把 localhost 换成电脑的局域网地址，在 iPhone 上测试。AR Quick Look 请优先使用部署后的 HTTPS 地址。

## 七章流程

开场：一颗四角星按 W25（`.-- / ..--- / .....`）闪光。首次首页只有星空和轻提示。已完成后，星星组成 Project W25；点击可重新选择愿望或重温上次三个选择。

1. **愿望**：词汇自由错落在星空中；拖动聚拢并选出三个。祝福以动画浮现、淡出，然后自动进入下一部分，不再弹出转场对话框。
2. **光谱**：拖动棱镜或调节滑条，在 68° 附近找到精确的 **#ffb3de**。
3. **星轨**：只触碰前三颗星组成 W；2 和 5 自动以长短光延续，随后自动转场。长光移动并留下拖尾。
4. **纪念日**：双转盘到 **10 月 9 日**，得到粉色蓝宝石。拖动宝石，让三个祝福依次出现。蓝宝石是这份礼物指定的诞生纪念，不按月份自动推算宝石。
5. **回声**：教程说明短按与至少 1 秒长按。观察闪光，回应三个字母组，解出 W25。可重播、撤回，也可用替代按钮输入。
6. **成形**：呈现从原始 Blender 模型提取的星光线框。拖动查看，点击中央粉色蓝宝石。另有真实 USDZ 的 AR Quick Look 入口。
7. **回信**：模型散开成星空，重排为 Project W25，再组成 HBD, Leah。按住文字至少 3 秒，激发闪光并散回首页。

按最新确认取消实物交付等待。体验可自主停留，不用倒计时强制凑满 15–20 分钟；实际时长需由真人试用校准。

## 保存与手机反馈

当前设备通过 localStorage 保存章节与选择。刷新会恢复未完成旅程；已完成的来访从 Project W25 首页开始。旧版完成记录会保留前三个愿望。关闭网页、切后台或取消触摸会中断长按，不能误触完成。

支持 Vibration API 的设备使用短/长震动。iPhone Safari 不支持任意时长的网页振动；轻触使用原生 switch 反馈的尽力兼容，能否触发取决于系统与 Safari。长信号同步显示光效，可手动开启音效。不可把这一版视作 iPhone 持续震动已实现。开启系统“减少动态效果”会减弱粒子移动与闪光。所有关键步骤另有点击或键盘方式。

## 模型与实现入口

- `components/game/journey.tsx`：章节、交互、祝福与结尾状态。
- `components/game/particles.tsx`：星空、文字重组、星光词汇。
- `components/game/model.tsx`：真实手链线框投影、宝石热点及散开效果。
- `lib/journey.ts`：W25 时间序列、存档校验、重玩规则。
- `public/models/bracelet.usdz`：约 9 MB 的真实模型，仅点击 AR 时加载。
- `public/models/bracelet-wire.json`：从 `silver_pink_bracelet_v3.blend` 提取的简化线框，保留短镶座、长镶座、四角星和延长链。
- `lib/gift-config.ts`：礼物信息记录；章节文案与交互参数在上述源文件中。

日期以 10 月 9 日为准，颜色 #ffb3de，结尾收件人 Leah。

## 验证与自动部署

```sh
npm test
npm run typecheck
npm run build:pages
```

测试涵盖三愿望限制、七章存档、重温历史、损坏存档、旧版迁移、1 秒阈值和 W25 间隔。静态检查验证入口及模型文件，不替代 iPhone 真机试用。

每次推送到 main，`.github/workflows/deploy-pages.yml` 会检查、构建并部署 `dist/pages`，访问：
https://avalonc.github.io/w25-signal/ 。

仓库 Settings → Pages → Source 需要设为 **GitHub Actions**。这是一次性的仓库设置；普通工作流令牌不能替管理员开启 Pages。先前的 `dist/client` 是服务端应用的客户端资源目录，缺少独立静态入口；第二版改为有完整 index.html 的 Pages 构建，并设置正确子路径。默认 `npm run build` 仍保留 Sites 原有服务端预览构建。

官方说明：[Vite 的 Pages 部署](https://vite.dev/guide/static-deploy.html#github-pages)、[Safari 原生 switch 反馈](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/)。
