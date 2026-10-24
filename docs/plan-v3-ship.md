# Daymark · 刻度 —— v3 交付计划：从原型到可上架的 App

> 2026-10-25 · 承接 [`plan-v2.md`](./plan-v2.md)（v2 交互与数据口径，不重复内容）+ [`product-direction.md`](./product-direction.md)（产品定位）。
>
> plan-v2 回答「v2 长什么样、数据怎么改」；**这份回答「怎么把它变成能在 App Store 卖的产品」**。
> 冲突时以 plan-v2 的业务口径为准，本文只补商业化、打包、国际化与发布工程。

---

## 1. 目标（用户 2026-10-25 定）

1. 把 `docs/prototype-v2` 的高保真原型变成**真实可用的功能**，替换现有 PWA 的三页结构。
2. 能**上架 App Store**，通过审核。
3. **面向国际用户**开放与销售：中英双语，英语为国际版主语言。
4. 定价 **$1** 级别的一次性买断；**提供免费版**，免费版部分功能阉割。
5. **做好广告接入的准备**（不强求首发就带广告）。

---

## 2. 三条硬结论（先对齐，否则会做无用功）

| # | 结论 | 依据 |
| --- | --- | --- |
| E1 | **PWA 不能直接上 App Store**。必须有一个原生外壳：用 Capacitor 打包现有的 React 应用，WebView 里跑同一套代码 | App Store 只收二进制包，Safari「添加到主屏幕」的 PWA 不在其列 |
| E2 | **数字功能必须走 IAP**，不能用自己的支付链接 | 审核指南 3.1.1；App Store 最低价位档是 **$0.99**，所以「1 美元」= Tier 1 / $0.99 |
| E3 | **WebView 壳有 4.2「功能单薄」被拒风险**，要靠原生能力与产品完整度抵消 | 指南 4.2 Minimum Functionality |

E3 的具体对冲（都要在客户端真的用上，不能只是声明）：

- 本地通知（提醒）、触感反馈、系统分享、相册选图、安全区与手势、离线优先、无浏览器痕迹（无地址栏 / 无滚动回弹冲突）。
- 后续再加一个 **iOS 小组件（WidgetKit）**：桌面直接看到「第 N 天」，这是纯网页做不到的、也是最强的「不是壳」证据。
- 应用名、图标、启动图、文案、空态全部原生级打磨，不出现「网页感」。

---

## 3. 技术架构（定）

```
daymark/
├── src/                 React + Vite（现有，v2 重构中）
│   ├── lib/             纯逻辑：days / growth / migrate / itemview / i18n …
│   ├── skins/           四套风格包令牌（CSS）
│   └── v2/              v2 页面与组件
├── ios/                 Capacitor iOS 工程（Xcode 项目，纳入版本库）
├── capacitor.config.ts
└── .github/workflows/
    ├── deploy-pages.yml     main → 网页版（保留：网页版是免费的引流入口）
    ├── preview-pages.yml    feat/** → 预览
    └── ios.yml              tag → macOS runner 归档 + TestFlight 上传
```

| 决策 | 取值 | 理由 |
| --- | --- | --- |
| 外壳 | **Capacitor 6**（`@capacitor/ios`） | 现有代码是成熟 React 应用；重写成 Swift 要数月，且要维护两套 |
| 原生能力 | `@capacitor/haptics`、`@capacitor/local-notifications`、`@capacitor/share`、`@capacitor/camera` | 同时构成 4.2 的功能证据 |
| 内购 | `@revenuecat/purchases-capacitor`（StoreKit 2 底层） | 收据校验、恢复购买、跨端 entitlement 都由它兜；月流水 < $2.5k 免费 |
| 广告 | `@capacitor-community/admob`，**首发默认关闭** | 先过审、先有留存数据；接口与版位先留好 |
| 构建 | GitHub Actions **macOS runner**（公开仓库免费）+ App Store Connect API Key + fastlane | 本机是 Linux，没有 Xcode；公开仓库的标准 runner 免费 |
| 数据 | 仍然**零后端、数据不出本机** | 与 plan-v2 约束一致；也省掉隐私合规的大部分工作量 |

**必须由你（账号持有人）完成的事**：注册 Apple Developer Program（$99/年，个人或公司主体）、创建 App Store Connect App、生成 App Store Connect API Key、提供隐私政策与支持页的公开 URL。工程侧我可以全部准备好，签名与提交要你的账号。

---

## 4. 商业化：免费版 / 完整版

一次性买断（非消耗型 IAP，`daymark.pro.lifetime`，$0.99）。不做订阅：单人工具、零服务器成本，订阅会被审核与用户双重嫌。

| 能力 | 免费 | 完整版 $0.99 |
| --- | --- | --- |
| 记录三类事（坚持 / 习惯 / 等待的日子） | **最多 3 件** | 不限 |
| 小伙伴养成、进化过场、章节、藏馆、图鉴、徽章 | ✅ | ✅ |
| 提醒（本地通知） | ✅ | ✅ |
| 风格包 | 软糖 1 套 | 纸本 / 夜航 / 像素 全解锁 |
| 相片背景 | ❌ | ✅ |
| 分享卡片 | 带小水印 | 无水印、全部模板 |
| 数据导出 / 导入备份 | ❌ | ✅ |
| 广告 | 底部一条（可关闭 7 天） | 无 |

原则：**阉割的是「表达」和「数量」，不是「陪伴」**。成长、进化、藏馆这些情绪价值对免费用户完整开放，否则产品留不住人，买断也卖不出去。

广告位只在「今天」页底部，且免费版才有；`src/lib/ads.ts` 统一收口（Web 端是空实现，原生端才接 AdMob），首发 `ADS_ENABLED = false`。

---

## 5. 国际化

- 文案表 `src/lib/i18n/`（zh / en），**新界面一律走 `t()`，不写死中文字符串**；老界面的中文在重写时逐个替换。
- 语言解析：用户显式选择 → 设备语言 → **英语兜底**（国际版主语言）。
- 日期、数字、星期走 `Intl`，随语言切换。
- 内容侧要本地化的地方：节日面板（西方节日对英语用户才是常识）、默认习惯预设（喝水 / 跑步 / 读书…）、分享卡片文案。
- App Store 上架信息双语：`zh-Hans` + `en-US` 两套名称、副标题、描述、关键词、截图。

---

## 6. 阶段与当前状态

图例：✅ 已完成 · 🚧 进行中 · ⬜ 未开始

### P0 · 骨架与数据（✅ 已完成，2026-10-25）

| # | 任务 | 状态 |
| --- | --- | --- |
| P0-1 | 类型扩展（species / stage / chapter / reminder / target / growthDays…）+ `migrate.ts` + 单测 | ✅ |
| P0-2 | `growth.ts`：形态门槛、永不退化、growthDays 增减、睡着判定 | ✅ |
| P0-3 | `collection` store（图鉴 / 徽章 / 纸条 / peakStage / seenStage） | ✅ |
| P0-4 | `ItemView` 统一视图 + 排序 + 焦点落点 | ✅ |
| P0-5 | 底部 tab 导航、退役三页横滑 | ⬜ |
| P0-6 | 焦点存取 + 切换面板 | ⬜ |
| P0-7 | i18n 基础设施（zh/en 文案表、日期本地化） | ✅ |
| P0-8 | 角色 SVG 移植（`Creature.tsx` / `Badge.tsx`）、四套风格包令牌 | ✅ |

测试基线：91 个单测全绿；`npm run build` 通过。

### P1 · 舞台与核心循环（下一步）

舞台卡（三种形态）、蓄力记一次、摸摸它、睡着与叫醒、进化过场、徽章弹窗、新建三步 + 孵化、欢迎页 / 空态。

### P2 · 档案、仪式、藏馆、分享、相片

档案页、告别仪式、去旅行、藏馆四页、章节书页、分享卡片（Canvas）、相片背景（IndexedDB）。

### P3 · 风格包、提醒、节日

装扮页与画廊、四套包上线、`.ics` 导出、本地通知提醒、节日彩蛋。

### P4 · 原生外壳与商业化

Capacitor iOS 工程、触感 / 通知 / 分享 / 相册接入、RevenueCat IAP、免费版限额、广告位收口、`ios.yml` 构建流水线。

### P5 · 上架

图标与启动图、App Store 截图（6.9"/6.5"）、隐私清单（PrivacyInfo.xcprivacy）、隐私政策与支持页、TestFlight 内测、提审、被拒修改。

### P6 · 发布后

小组件、年度回顾、广告开启（如需要）、数据看板（无埋点前提下的本地统计）。

---

## 7. 上架检查清单（P5 用）

- [ ] Apple Developer Program 账号（你）
- [ ] App Store Connect 建立 App，Bundle ID `com.liangyi.daymark`（或你定的）
- [ ] App 名称查重：**「Daymark」在 App Store 大概率被占用**，需要备选（英文：Daymarker / Tickmark / Little Days；中文：刻度）
- [ ] 图标 1024×1024 无透明、无圆角
- [ ] 截图：6.9"（iPhone 16 Pro Max）、6.5"（iPhone 11 Pro Max/XS Max）、中文 + 英文各一套
- [ ] 隐私政策 URL + 支持 URL（可放 GitHub Pages）
- [ ] 隐私营养标签：不收集数据；**若启用 AdMob 则要如实勾选广告标识符**，并加 ATT 弹窗
- [ ] `PrivacyInfo.xcprivacy`：声明用到的 Required Reason API（UserDefaults、文件时间戳等）
- [ ] 年龄分级 4+；无账号、无 UGC，因此不需要登录与举报机制
- [ ] IAP 商品在 App Store Connect 建好、提交审核、「恢复购买」入口可达
- [ ] 审核备注写清：离线工具、数据只存本机、无服务器
- [ ] TestFlight 至少一轮自测（真机 iPhone，深浅两色）

---

## 8. 待决问题（需要你拍板）

| # | 问题 | 我的建议 | 最晚 |
| --- | --- | --- | --- |
| Q-A | 免费版限额用「3 件事」还是「1 件事 + 全功能试用 7 天」？ | 3 件事：可感知完整价值，又不至于替代买断 | P4 开工前 |
| Q-B | 首发要不要带广告？ | 不带。先过审 + 攒评分，广告留开关，上线 2–4 周后按留存决定 | P4 |
| Q-C | App Store 名称 | 先查重，准备 2 个备选；中文用「刻度」 | P5 前 |
| Q-D | Bundle ID 与开发者主体 | 量译（成都）科技有限公司 or 个人账号。公司账号审核更快、可多成员 | P5 前 |
| Q-E | 网页版是否继续免费开放 | 继续，但只给「记录 + 3 件事」的基础能力，完整版引导到 App | P5 |
| Q-F | 小组件做不做进首发 | 不做首发，P6 第一项。它是 4.2 最强的对冲，但会拖 3–5 天 | P6 |

---

## 9. 工作方式

- 分支：`feat/v2`（当前）。大功能合并前先跑预览站给人看；用户已拍板的小改动直接上 `main`。
- 每次提交保持可构建：`npm test` 与 `npm run build` 必须绿。
- 逻辑与视觉分两次提交（被否掉时只回滚一个）。
- 这个目录下所有文案、注释、提交说明用中文；**用户可见文案走 i18n 表**。
