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

打开 http://localhost:4173/w25-signal/ 。同一 Wi-Fi 下可以把 localhost 换成电脑的局域网地址，在 iPhone 上测试。AR Quick Look 请优先使用部署后的 HTTPS 地址；入口使用原生 `rel="ar"` 链接及单一图片子元素。图片仅提供浅色底面，没有手链缩略图或自绘图标，AR 徽标由 iPhone Safari 显示；非 Safari 浏览器不会显示这个系统徽标。整行文字和图标区域均可触碰。

模型、AR 文件与后备图共用 `lib/model-assets.ts` 的版本地址。替换包的 revision 变化时同步更新，避免设备继续使用上一版资源缓存。当前为 GU1893-v6，模型内容保持原替换包不变。

## 七章流程

开场：一颗四角星按 W25（`.-- / ..--- / .....`）闪光。首次首页只有星空和轻提示。已完成后，星星组成 Project W25；点击可重新选择愿望或重温上次三个选择。

1. **愿望**：词汇自由错落在星空中；拖动聚拢并选出三个。祝福以动画浮现、淡出，然后自动进入下一部分，不再弹出转场对话框。
2. **光谱**：无常驻文字或滑杆；拖动透明棱镜，观察连续光谱柔和展开。保留原有光晕表现；离开后用一句“原来，光也记得你喜欢的颜色”接入星轨。键盘可用左右方向键。
3. **星轨**：只触碰前三颗星组成 W；2 和 5 自动以长短光延续，随后自动转场。长光移动并留下拖尾。
4. **纪念日**：双转盘到 **10 月 8 日**，两枚星盘旋转汇光，光散作星点，再连成宝石线框。持续转动逐渐发现“蓝宝石”“天秤与生日”“最爱的粉色”；每段含义留有阅读时间，再自然汇成祝福并进入回声。蓝宝石是这份礼物指定的诞生纪念，不按月份自动推算宝石。
5. **回声**：让三个愿望依次渡过星海。轻触愿望决定先后，它们会捎去开头的光、放慢来信或留下下一束光的轮廓；送达后仍继续帮助后面的愿望，效果可以组合。两端星光轮流来信与回应，第二程交换两岸视角。保留短按 / 至少 1 秒长按；每组答对自动送达，逐步读出 W25。答错保留已亮的部分，可重听，也可展开提示用短/长按钮回应。
6. **成形**：呈现由原始 Blender 完整几何弯成的闭合环形手链。保留全部网格和材质，拖动查看，点击环上的粉色蓝宝石。另有环形 USDZ 的 AR Quick Look 入口。
7. **回信**：模型淡出，星光自然重排为 Project W25 并停留，再直接变成 HBD, Leah。开场选出的三个愿望写进最后的祝福。背景旋律采用轻柔的《Happy Birthday》音型；按住文字至少 3 秒，激发闪光并散回首页。

按最新确认取消实物交付等待。体验可自主停留，不用倒计时强制凑满 15–20 分钟；实际时长需由真人试用校准。

## 保存与手机反馈

当前设备通过 localStorage 保存章节与选择。刷新会恢复未完成旅程；已完成的来访从 Project W25 首页开始。旧版完成记录会保留前三个愿望。关闭网页、切后台或取消触摸会中断长按，不能误触完成。

支持 Vibration API 的设备使用短/长震动。iPhone Safari 不支持任意时长的网页振动；轻触使用原生 switch 反馈的尽力兼容，能否触发取决于系统与 Safari。长信号同步显示光效，可手动开启音效。不可把这一版视作 iPhone 持续震动已实现。开启系统“减少动态效果”会减弱粒子移动与闪光。所有关键步骤另有点击或键盘方式。

## 模型与实现入口

- `components/game/journey.tsx`：章节、交互、祝福与结尾状态。
- `components/game/particles.tsx`：星空、文字重组、星光词汇。
- `components/game/model.tsx`：完整环形模型查看器、宝石热点及散开效果。
- `lib/journey.ts`：W25 时间序列、存档校验、重玩规则。
- `components/game/echo-relay.tsx` / `lib/echo-relay.ts` / `app/relay.css`：愿望组合、两端星光、自动送达与可暂停的摩斯接力。
- `docs/experience-review.md`：全程文字原则、情绪衔接及五款参考游戏的具体对应。
- `components/game/sapphire-scene.tsx` / `star-sapphire.tsx`：星盘汇光、星点线框、随旋转发现名字/天秤/粉色，最后汇成祝福。
- `components/game/prism-light.tsx` / `passing-meteor.tsx`：柔和连续色散、随机时机与方向的细流星。
- `lib/motion.ts` / `app/motion.css`：统一章节和文字的显隐节奏；流星不再逐句按固定周期播放。
- `components/game/model-surface.tsx`：随项目打包的模型查看器、加载重试与静态后备图；不依赖外部 CDN 脚本。
- `components/game/scene-clock.ts`：可暂停的场景计时，防止重渲染取消转场或后台跳章。
- `public/models/bracelet-ring.glb` / `bracelet-ring.usdz`：由原始 Blender 模型闭合成环，未减面，分别用于网页查看器和 iPhone AR Quick Look。
- `public/images/sky-photorealistic.png`：由 imagegen 生成的拟真星空底图，动态星点仍叠加在其上。
- `public/models/sapphire-star.glb`：来自 GU1893-v6 的完整宝石及四角星镶座，5 个网格、14,780 个三角形。
- `public/models/jewelry-metadata.json`：GU1893-v6 完整环形模型的几何数量、米制尺寸与实际宝石热点位置。手链含 155 个网格、113,411 个原始多边形和 226,234 个三角形，未减面。
- `docs/sapphire-redesign.md`：已实现的“星光凝成宝石”流程与模型导出说明。
- `lib/gift-config.ts`：礼物信息记录；章节文案与交互参数在上述源文件中。

日期以 10 月 8 日为准，颜色 #ffb3de，结尾收件人 Leah。

## 验证与自动部署

```sh
npm test
npm run typecheck
npm run build:pages
```

测试涵盖三愿望限制、七章存档、重温历史、损坏存档、旧版迁移、1 秒阈值、W25 间隔、祝福阅读时长，以及场景计时在重渲染、暂停和切换阶段后的行为。静态检查读取 GLB 验证完整几何、米制尺度、真实宝石热点及部署资源，不替代 iPhone 真机试用。

每次推送到 main，`.github/workflows/deploy-pages.yml` 会检查、构建并部署 `dist/pages`，访问：
https://avalonc.github.io/w25-signal/ 。

仓库 Settings → Pages → Source 需要设为 **GitHub Actions**。这是一次性的仓库设置；普通工作流令牌不能替管理员开启 Pages。先前的 `dist/client` 是服务端应用的客户端资源目录，缺少独立静态入口；第二版改为有完整 index.html 的 Pages 构建，并设置正确子路径。默认 `npm run build` 仍保留 Sites 原有服务端预览构建。

官方说明：[Vite 的 Pages 部署](https://vite.dev/guide/static-deploy.html#github-pages)、[Safari 原生 switch 反馈](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/)。
