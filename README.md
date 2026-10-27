# Daymark · 刻度

> 一次只看一件事。

倒数日 / 习惯 / 等待的日子，三件事收在同一只小伙伴身上。天数按累计算，中断不算失败，
形态只往上长——**没有排行榜，也不会因为断了而收回**。

纯前端、零后端、数据不出本机。

- 线上预览（v2）：https://ochprince.github.io/daymark/preview/
- 正式版（v1）：https://ochprince.github.io/daymark/
- 分支：`feat/v2`（v2 主线）、`docs/prototype-v2`（高保真原型）

---

## 现在做到哪了

### 已完成

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 今天页 | ✅ | 舞台卡三类事、蓄力 500ms 记一次、切换面板、新建入口 |
| 成长系统 | ✅ | 0/3/7/30/100 天五形态，累计不连续、永不退化；睡着与叫醒 |
| 进化过场 | ✅ | 形态升级才播，可跳过；关着 App 长出来的形态，打开时补播一次 |
| 徽章与图鉴 | ✅ | 12 枚徽章、4 物种 × 5 形态 + 特别篇；解锁排队弹窗 |
| 档案页 | ✅ | 成长之路、月历打戳、过去的章节、改名换色、结束这一章、删除 |
| 藏馆 | ✅ | 章节书架（书脊高度随天数）、图鉴、徽章、纸条 |
| 装扮 | ✅ | 四套风格包、主色、数字字体、纹理、开关、语言、导出备份 |
| 中英双语 | ✅ | 全部界面走 `t()`，日期格式按语言，英语作国际版兜底 |
| 买断分层 | ✅ | 免费 2 件事 / 软糖皮肤 / 藏馆前 3 本；$0.99 买断解除 |
| 分享卡 | ✅ | 9:16 卡片，Canvas 导出 1080×1920，优先系统分享 |
| 相片背景 | ✅ | IndexedDB 存图、压到 1600px，卡片文字区自动压暗 |
| 备忘与待办 | ✅ | 倒数日详情里可写一句备忘、勾待办清单 |
| 孵化仪式 | ✅ | 第一件事创建时轻点三下破壳，只播一次 |
| 提醒 / .ics | ✅ | 到点应用内提示，「加到日历」导出带 RRULE 的 .ics |
| 音效 | ✅ | 蓄力/落定/进化/盖章四声，跟着装扮页开关走 |
| 备份 | ✅ | 导出 JSON、导入恢复（换机用） |
| 原生壳 | 🟡 | Capacitor 6 配置与 iOS/Android 工程骨架就位，待真机联调 |
| 本地通知 | 🟡 | 桥已写好（权限 + 排期），还差提醒设置界面 |

### 还没做

完整清单见 [`docs/plan-v5-audit.md`](./docs/plan-v5-audit.md)（按「死链 / 交互 / 上架 / 工程 / 延伸」分档，每项带证据与落点）。最要紧的三件：

- reduce-motion 整条链路是死的：`reduceMotionOn()` 无调用点，CSS 又挂在早已改名的 `.phone` 上
- 装扮页换皮肤没有整屏预览
- 首次引导三步（welcome → 选蛋 → 命名）没有，只有一句空态

---

## 技术选型

| 层 | 选择 | 为什么 |
| --- | --- | --- |
| 构建 | Vite + TypeScript（严格模式） | 秒级构建，`tsc -b` 先于打包跑，类型错误拦在 CI 前 |
| 视图 | React 19 | 组件复用、状态可预测 |
| 状态 | `useSyncExternalStore` + 80 行本地 store | 不引入状态库；顺带获得多标签页同步 |
| 样式 | 原生 CSS + 设计令牌（含四套皮肤） | 皮肤差异只靠令牌，组件里不出现皮肤判断 |
| 字体 | Inter Variable（自托管） | 不走 CDN；中文交给系统字体 |
| 图标 / 插画 | 手写 SVG | 无图标库依赖，风格统一，可导出到 Canvas |
| 测试 | `node:test` + `tsx` | 零测试框架依赖；弱机器上不会因 worker 池 OOM |
| 原生 | Capacitor 6 | 上架 App Store 必须走二进制包，PWA 不能直接提交 |
| 部署 | GitHub Actions → Pages | 分支预览与正式站分开 |

## 一些实现细节

- **天数口径**：从计时锚点起算的完整 24 小时个数（`Math.floor`）。新建或重置时锚点就是那一刻，
  所以 15:30 建的记录要到第二天 15:30 才变 1；手动挑的历史起始日没有时刻，锚点退回当天 00:00，
  等同于自然日天数（见 `src/lib/days.ts` 的 `anchorOf` / `daysSince`）。
- **成长与天数不是一回事**：成长天数跨章节累计，所以坚持类的大数字（当前章第 N 天）可能小于
  卡片下方的成长天数——这是刻意的，不是 bug（`docs/plan-v2.md` 6.3）。
- **形态永不退化**：`displayStage = max(stageOf(growth), peakStage)`，峰值另存在收藏里。
- **习惯的成长要单独记**：`days` 只保留最近 240 个周期，累计成长必须走 `growthDays`。
- **年/月/日拆分**：按自然月逐月推进并做月末收敛（1 月 31 日 + 1 月 = 2 月 28 日），不是除以 30。
- **农历节日**：用离线表（`src/lib/lunar-dates.ts`，覆盖农历 2024–2098），运行时**不要改用浏览器 ICU**
  ——2027 春节 ICU 给 02-07，官方是 02-06，2030 年同样差一天。表由 `scripts/gen-lunar-dates.py` 生成。
- **iOS 键盘**：弹层用 `visualViewport` 跟随软键盘；输入框页面统一走 `usePinViewportWhileEditable`。
- **启动顺序**：`runMigration` 先写好 localStorage，再 `reload()` 各 store，否则读到模块加载时的旧值。

## 目录结构

```
daymark/
├── public/                  # 图标、manifest、Service Worker、隐私政策与帮助页
├── scripts/
│   ├── make-icons.py        # 生成 PWA / iOS / Android 图标与启动图
│   └── gen-lunar-dates.py   # 生成农历节日离线表
├── ios/ android/            # Capacitor 原生工程
├── src/
│   ├── main.tsx             # 入口：迁移 → 重读 store → 渲染 → 收启动图
│   ├── v2/
│   │   ├── AppV2.tsx        # 外壳：三 tab、焦点、过场、付费墙、分享
│   │   ├── TodayPage / StageCard / Switcher / AddSheet
│   │   ├── ProfilePage      # 档案页
│   │   ├── MuseumPage       # 藏馆（书架 / 图鉴 / 徽章 / 纸条）
│   │   ├── DressPage        # 装扮
│   │   ├── ShareSheet / ShareCard / PaywallSheet
│   │   └── *.css            # 原型视觉层
│   ├── lib/
│   │   ├── types.ts         # 数据模型
│   │   ├── migrate.ts       # v1 → v2 迁移（幂等）
│   │   ├── growth.ts        # 形态、累计成长、睡眠判定
│   │   ├── itemview.ts      # 三类事的统一视图与排序
│   │   ├── collection.ts    # 图鉴、徽章、纸条
│   │   ├── museum.ts        # 书架上的书
│   │   ├── skin.ts prefs.ts # 皮肤与偏好
│   │   ├── entitlement.ts   # 免费 / 买断口径
│   │   ├── purchase.ts      # IAP 桥
│   │   ├── native.ts        # 触感 / 通知 / 分享 / 状态栏桥
│   │   ├── sharecard.ts     # 分享模型与文案
│   │   ├── days.ts festivals.ts lunar-dates.ts
│   │   └── i18n/            # 中英文案表（类型强制对齐）
│   ├── skins/               # 四套皮肤令牌
│   └── components/          # 角色 SVG 与外壳
└── .github/workflows/       # 正式站、分支预览、iOS 发布
```

### 几条硬规矩

1. **不要写死中文**：新界面一律走 `t()`，中英 key 由类型强制对齐。
2. **组件里不许出现 `if (skin === …)`**：差异只通过 CSS 令牌表达。
3. **不拿走用户已经写下的东西**：降级只挡新增，数据永远可读、可导出。

## 本地开发

| 命令 | 作用 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run dev` | 本地开发 |
| `npm test` | 单测（node:test + tsx） |
| `npm run build` | 类型检查 + 生产构建 |
| `npx tsc -b` | 只做类型检查 |
| `npm run build:native` | 给 Capacitor 用的构建 |
| `python3 scripts/make-icons.py` | 重新生成图标（需要 playwright + chromium） |

**测试约定**：测试命令必须带引号的递归 glob（`'src/**/*.test.ts'`）；
断言中文文案前先 `setLocaleForTest('zh')`，CI 设备语言是 en。

## 上架

```bash
npm run build:native
python3 scripts/check-native.py     # 上架前自检：配置 / 隐私清单 / 图标 / 截图尺寸
npx cap sync ios
cd ios/App && pod install && open App.xcworkspace
```

- 商店文案与截图：`docs/store/LISTING.md`、`docs/store/{zh,en}/`（6.7")、`docs/store/6.5/`
- 清单：[`docs/native/APP-STORE-CHECKLIST.md`](docs/native/APP-STORE-CHECKLIST.md)
- 前端接入点：[`docs/native/INTEGRATION.md`](docs/native/INTEGRATION.md)
- 隐私政策与帮助页：`public/privacy.html` · `public/support.html`（随包发布）

## 部署

推送到 `main` 走正式站；推送到任意 `feat/**` 分支由 `preview-pages.yml` 发布到
**/daymark/preview/**（主站内容始终取自 `main`）。

> 预览与正式版同源，共用同一份 `localStorage`——预览里添加的条目也会出现在正式版中。

首次在别的账号复用时，需要到仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。

## 数据

```ts
type DayEvent = {
  id: string
  title: string
  startedAt: number
  anchorAt?: number      // 这一轮从哪一刻起算 24 小时
  createdAt: number
  color: number
  species?: Species      // v2：小伙伴
  history?: { days: number; endedAt: number; stage?: Stage; line?: string }[]
}

type CountdownEvent = {
  id: string
  title: string
  startedAt: number
  createdAt: number
  color: number
  repeat: 'none' | 'weekly' | 'monthly' | 'yearly'
  festivalId?: string
  ackedFor?: number[]    // v2：说过「就是今天」的日子
  history?: { at: number; line?: string }[]
}

type CheckInEvent = {
  id: string
  title: string
  createdAt: number
  color: number
  cadence: 'daily' | 'weekly' | 'monthly'
  days: Record<string, number>       // yyyy-mm-dd → 当天次数，只留最近 240 个周期
  times?: Record<string, number[]>
  growthDays?: number                // v2：跨周期累计成长
  chapters?: { days: number; endedAt: number; stage?: Stage; line?: string }[]
  chapterStartedAt?: number
}
```

存储键（全部 `daymark.` 前缀）：
`events.v1` `countdowns.v1` `checkins.v1` `collection.v1` `skin.v1` `prefs.v1`
`focus.v1` `locale.v1` `entitlement.v1` `theme.v2`（旧）`migrated.v2`

打卡按天存桶：卡片上的数是「当前周期内的天数之和」，历史是「按周期把桶加起来」——
所以每周 / 每月切换只改变分桶方式，原始记录不动。

每次打卡还会在 `times` 里记下时刻（毫秒），撤销时从尾部收走一个，两者始终同进同退。

数据只在这台设备上。换设备、清缓存即丢失——这是刻意的取舍：不要账号、不要服务器、
不要联网权限，也就不用为隐私写任何承诺。想留底请用「装扮 → 导出备份」。

## License

MIT
