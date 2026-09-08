# 星间来信 · A Signal Between Stars

一个面向手机浏览器的 W25 礼物引导游戏原型。

## 本地运行

```text
npm install
npm run dev
```

然后打开 `http://localhost:3000/`。

## 体验路径

1. 选择四个想带去未来的祝福。
2. 将频率调到目标位置，留下喜欢的颜色（当前为示例雾紫）。
3. 按编号连接星点，读出短光与长光。
4. 在三个光刻度收集 10 月 5 日与蓝宝石的记忆。
5. 用短光、长光还原 Morse：`W25`。
6. 组装设计结构图；可在 `lib/gift-config.ts` 接入真实 USDZ。
7. 启动最后投递，现实中交付手链，再由收件人确认“我已亲手收到”。

## 个性化与 USDZ

礼物信息集中在 `lib/gift-config.ts`，包括生日、蓝宝石、喜欢的颜色、祝福文案和 USDZ 路径。将真实模型放入 `public/models/bracelet.usdz` 并把 `usdzUrl` 设置为 `/models/bracelet.usdz`，在 iPhone Safari 中即可预留 AR Quick Look 入口。

游戏进度保存在当前设备的 localStorage；“重新开始”只清除本设备上的进度。
