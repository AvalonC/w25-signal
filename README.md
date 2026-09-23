# 星间来信 · Project W25

给 Leah 的星光旅程。接住一束光，带着三个愿望寻找颜色、生日与宝石，接通两岸，最后看走过的星路在真实手链上闭合。采用连续星空、柔和粉色与粒子文字，适配手机触摸和键盘操作。

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

打开 http://localhost:4173/w25-signal/ 。同一 Wi-Fi 下可以把 localhost 换成电脑的局域网地址，在 iPhone 上测试。AR Quick Look 请优先使用部署后的 HTTPS 地址；入口使用原生 `rel="ar"` 链接及单一图片子元素。图片使用完全透明的 PNG，不绘制底色、圆角、阴影或自制图标；AR 徽标完全由 iPhone Safari 显示，非 Safari 浏览器不会显示这个系统徽标。文字位于独立网格列，避开徽标区域；整行文字和图标区域均可触碰。

模型、AR 文件与后备图共用 `lib/model-assets.ts` 的版本地址。替换包的 revision 变化时同步更新，避免设备继续使用上一版资源缓存。当前为 `GU1893-v6-ring-r1`：从 V6 展开模型重新组装，镶座和宝石一起旋转 90° 朝向环外，扇形尾饰作为完整组件下垂；所有部件只做刚性变换，保留形状和全部面数。

## 当前可玩流程

开场：主星升起后先闪烁，轻点会得到远方的回应；随后光圈向外扩散，按住星星一秒让光圈蓄满。短按、移开、切后台或失焦会取消本次蓄光，不累积进度。成功后主星飞向愿望环节。重新开始与重温也会经历这段短引导；键盘支持按住空格或回车，减少动态模式保留静态光圈与进度。三个愿望聚拢成伴星，再带光走进星路。声音可以主动开启，开关选择会在当前设备记住。

1. **同行**：从散落的星光中聚拢三个愿望，化为主星身边的三颗伴星。
2. **星路**：拖动主星或轻触远处，可先去棱镜，也可先去生日星盘；两处都能随时返回与重访。
3. **两份发现**：棱镜保持无常驻文字的色散，粉色停留后散开，点亮半段路。星盘对齐 **10 月 8 日** 后旋转汇光，光化为星点和线框，标记宝石的位置。成果与当前位置会保存。
4. **相遇**：颜色和日期都找到后，把粉光拖进宝石轮廓，或轻触宝石。转到三个不同角度并各稳定停留 880 ms，依次发现“蓝宝石”“天秤与生日”“最爱的粉色”；反复乱转不会累积通关。全部发现后轻触出口粉光，带愿望前往回声。
5. **回声**：W 先由远方完整示范，玩家回应完整的 `.--`；2 的来信中途模糊，需要点击一颗同行愿望星帮助恢复；5 由远方和玩家交替发出五束短光。愿望可组合提供开头提示、慢速来信与下一束轮廓，但不会替玩家跳过回应。已接通路段持续发亮，主星跨到下一站。答错保留正确前缀，支持重听、键盘及短/长辅助按钮。这是单人两岸接力，没有联网双人模式。
6. **成形与交付**：把同行的光带到最后一个星点，星路闭合成环。实际 GLB 中的 13 个长短链节按 W25 分组点亮，可再次选看每一组；长链节里的三颗钻石共同代表一划。揭晓完成后仍需点击“让它来到眼前”，再进入可旋转的完整手链与 USDZ AR Quick Look。现实交付句“把目光从屏幕移开。最后一束光，正等着来到你手里。”之后，可点击“礼物已在身边，读完这封信”或触碰粉色宝石继续。
7. **回信与彩蛋**：模型化为保持原轮廓的星点，再重排为 Project W25。随后出现隐藏项目名 `Project N7A-3914`，用此前约定的 HANA 粉点规则（8 / 1 / 14 / 1，最后的 4 是干扰点）让粉点重新组成 W25；完成后才打开 HBD, Leah 的生日回信。声音开启时播放轻柔的生日旋律。按住星光至少 3 秒或轻触返回后，可以直接看手链与 AR、读生日回信、重温之前的选择，或选择新的愿望。

现实交付由玩家主动继续，没有强制等待倒计时。体验可以自主停留，实际时长需由真人试用校准。本轮只增加显示与交互，未修改已有 GLB 二进制、几何或材质。

## 保存与手机反馈

当前设备通过 localStorage 保存章节、选择、探索发现、送达顺序与声音偏好。可选的 `pathClosed` 记录星路揭晓是否已经完成，仍兼容 version 2 旧存档；没有该字段的旧第六章会先进入闭环揭晓。刷新恢复未完成旅程，已完成来访从 Project W25 首页开始，重访入口保留原来的三个愿望。关闭网页、切后台或取消触摸会中断长按，不能误触完成。

支持 Vibration API 的设备使用短/长震动。iPhone Safari 不支持任意时长的网页振动；轻触使用原生 switch 反馈的尽力兼容，能否触发取决于系统与 Safari。长信号同步显示光效，可手动开启音效。不可把这一版视作 iPhone 持续震动已实现。开启系统“减少动态效果”会减弱粒子移动与闪光。所有关键步骤另有点击或键盘方式。

## 模型与实现入口

- `components/game/journey.tsx`：开场、愿望、探索入口与后半程状态。
- `components/game/guiding-light.tsx`：首次接光与选择愿望之后的主动出发。
- `components/game/path-sky.tsx` / `star-path-journey.tsx`：共享星路、愿望伴星、自由顺序、生日汇光与粉光入石。
- `lib/star-path.ts` / `docs/star-path.md`：探索状态、存档迁移与完整主线说明。
- `components/game/particles.tsx` / `components/game/wish-sky.tsx`：星空、环境粒子聚成愿望、伴星环绕与飞行交接。
- `components/game/cipher-reveal.tsx` / `lib/hana-cipher.ts`：Project N7A-3914 的 HANA 粉点彩蛋和 W25 揭示。
- `components/game/model.tsx`：完整环形模型查看器、宝石热点及散开效果。
- `lib/journey.ts`：W25 时间序列、存档校验、重玩规则。
- `components/game/echo-relay.tsx` / `lib/echo-relay.ts` / `app/relay.css`：愿望组合、两端星光、自动送达与可暂停的摩斯接力。
- `components/game/path-closure.tsx` / `lib/path-closure.ts`：星路闭环、实际链节的 W25 对应、主动进入手链。
- `docs/experience-review.md`：全程文字原则、情绪衔接及五款参考游戏的具体对应。
- `components/game/sapphire-scene.tsx` / `star-sapphire.tsx`：星盘汇光、星点线框、随旋转发现名字/天秤/粉色，最后汇成祝福。
- `components/game/prism-light.tsx` / `passing-meteor.tsx`：柔和连续色散、随机时机与方向的细流星。
- `lib/motion.ts` / `app/motion.css`：统一章节和文字的显隐节奏；流星不再逐句按固定周期播放。
- `components/game/model-surface.tsx`：随项目打包的模型查看器、加载重试与静态后备图；不依赖外部 CDN 脚本。
- `components/game/scene-clock.ts`：可暂停的场景计时，防止重渲染取消转场或后台跳章。
- `public/models/bracelet-ring.glb` / `bracelet-ring.usdz`：由原始 Blender 模型闭合成环，未减面；当前 `GU1893-v6-ring-r2` 修正了真实扣具穿扣关系，用于网页查看器和 iPhone AR Quick Look。
- `public/model-clasp-detail.png` / `model-clasp-top.png`：真实扣具穿扣特写，用于模型资源核验。
- `public/images/sky-photorealistic.png`：由 imagegen 生成的拟真星空底图，动态星点仍叠加在其上。
- `public/models/sapphire-star.glb`：来自 GU1893-v6 的完整宝石及四角星镶座，5 个网格、14,780 个三角形。
- `public/models/jewelry-metadata.json`：完整环形模型的几何数量、米制尺寸、实际宝石热点及朝外法线。手链含 155 个网格、113,411 个原始多边形和 226,234 个三角形，未减面。
- `scripts/export-jewelry.py` / `scripts/ring_assembly.py`：从 V6 展开模型按完整部件组装，禁止逐顶点弯曲；导出同步的 GLB、USDZ、后备图和星光采样。`public/models/bracelet-assembly-validation.json` 记录全部部件的刚性变换及边长误差。
- `docs/sapphire-redesign.md`：早期宝石成形与模型导出记录；当前发现机制以 `docs/star-path.md` 为准。
- `lib/gift-config.ts`：礼物信息记录；章节文案与交互参数在上述源文件中。

日期以 10 月 8 日为准，颜色 #ffb3de，结尾收件人 Leah。

## 验证与自动部署

```sh
npm test
npm run typecheck
npm run build:pages
```

测试涵盖愿望与旧存档、探索顺序、角度停留发现、摩斯三轮、错误前缀、隐藏与帮助暂停、实际 GLB 链节对应、闭环主动继续与通关重访。390px 浏览器已从开场走到 HBD, Leah；宝石与闭环画面已检查 320、390、1440px，模型非空、热点对齐且没有横向溢出；减少动态、声音记忆与重访刷新也已复核。静态检查读取 GLB 验证几何、尺度与热点，不代表 iPhone 真机触控、流畅度或系统 AR 已验证。

每次推送到 main，`.github/workflows/deploy-pages.yml` 会检查、构建并部署 `dist/pages`，访问：
https://avalonc.github.io/w25-signal/ 。

仓库 Settings → Pages → Source 需要设为 **GitHub Actions**。这是一次性的仓库设置；普通工作流令牌不能替管理员开启 Pages。先前的 `dist/client` 是服务端应用的客户端资源目录，缺少独立静态入口；第二版改为有完整 index.html 的 Pages 构建，并设置正确子路径。默认 `npm run build` 仍保留 Sites 原有服务端预览构建。

官方说明：[Vite 的 Pages 部署](https://vite.dev/guide/static-deploy.html#github-pages)、[Safari 原生 switch 反馈](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/)。
