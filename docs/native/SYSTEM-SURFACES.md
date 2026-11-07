# 系统表面 · Web 模拟 → iOS 原生落地

v3 的四块系统表面（桌面小组件 / 灵动岛 / 锁屏卡 / 闹钟）先在 Web 里做成可复用的
模拟组件，目的是把**数据形状、状态机、文案和动效节奏**定下来，原生侧照着接系统 API。

- Web 实现：`src/v2/system/`，样式 `src/v2/system.css`，演示入口 `main.tsx?lab=sys`
- 演示时钟：`useSystemClock`（真实时间 / 40× 演示）
- 数据契约：`SystemItem`（`src/v2/system/model.ts`），由 `toSystemItem(ItemView, now)` 产出

> 一条原则：Web 组件只吃 `SystemItem + now`。原生侧不要重新算天数、进度、剩余时间，
> 全部按本文的字段口径来；算不出来或需要系统能力的，在下面「原生侧需要提供」里列清楚了。

## 1. 数据契约（App Group 共享）

App 与 Widget Extension / Live Activity Extension 通过 **App Group**（建议
`group.com.daymark.app`）共享一份 JSON。写入时机：任何事项增删改、打卡、跨天。

`SystemItem` 字段（与 `src/v2/system/model.ts` 一一对应）：

| 字段 | 类型 | 含义 | 原生侧来源 |
| --- | --- | --- | --- |
| `id` | String | 事项 id（对应 `ItemView.id`） | 业务库 |
| `kind` | enum | `since` 坚持 / `habit` 习惯 / `countdown` 倒数 | 业务库 |
| `title` | String | 标题 | 业务库 |
| `days` | Int | 主数字：坚持=已过天数；习惯=累计天数；倒数=剩余天数（0=今天，可为负） | 按 `daysSince` / `habitGrowthDays` / `daysUntil` 口径算好再写 |
| `startedAt` | Int64? | 坚持类起始锚点（算「已走过 X 年 X 月」） | `anchorAt ?? startedAt` |
| `color` | Int 0–7 | 调色板索引，映射 `--h-{n}` / 原生色板 | 业务库 |
| `species` | enum | `sprout` / `moon` / `drop` / `star` / `post` | 业务库 |
| `stage` | Int 0–4 | 展示形态（已并入历史最高，不倒退） | `displayStage(growth, peak)` |
| `count` | Int? | 习惯：本周期已记次数 | `countInPeriod` |
| `target` | Int? | 习惯：每周期目标，`null` = 不限 | 业务库 |
| `cadence` | enum? | `daily` / `weekly` / `monthly` | 业务库 |
| `week` | [Bool] ×7? | 最近 7 天（旧→今天）是否记过 | `weekFlags`，直接摊平写进 JSON |
| `streak` | Int? | 习惯：连续周期数 | `streakPeriods` |
| `date` | Int64? | 倒数：下一次发生时刻 | `nextOccurrence` |
| `memo` / `todo` / `repeat` | String? / [{text,done}]? / String? | 倒数：备忘、待办（最多展示 3 条）、重复文案 | 业务库 |

**不要**把 `days`、`count`、`week` 这类派生值交给原生现算：跨时区、跨夏令时、跨午夜时
两端口径必须一致，所以由 App 侧的纯函数算好写进 App Group，Extension 只读。

## 2. 组件 → 原生能力对照

| Web 组件 / 形态 | iOS 能力 | 关键 API | 原生侧需要提供 |
| --- | --- | --- | --- |
| `Widget size="sm"` | WidgetKit · `.systemSmall` | `TimelineProvider` + `entry` | `SystemItem` 快照；点击 `widgetURL` 深链回事项 |
| `Widget size="md"` | WidgetKit · `.systemMedium` | 同上，多一行 `formatSpan` 文案 | `startedAt` / `days`（算「已走过 X 年 X 月」） |
| `Widget size="lg"` | WidgetKit · `.systemLarge` | 同上 + 形态进度（`stagePercent`） | `stage` 与 `growth`（或直接给 `stagePercent`） |
| `Widget kind="since"` | 只读卡片 | `Text(entry.days, format: .number)` | 天数；无需刷新（天数在 timeline 里按天跳） |
| `Widget kind="habit"` | 可交互小组件（iOS 17+） | `Button(intent:)` + `AppIntent` | 打卡写入 App Group；返回新的 `count` / `week` |
| `Widget kind="countdown"` | 只读卡片 + 旅途进度 | `Gauge` / 自定义 `Canvas` | `date`（下一次发生）、`days` |
| `DynamicIsland state="idle"` | Live Activity · compact / minimal | `ActivityAttributes.ContentState` | 焦点事项 id + `days` + 当天零点时间戳（算 `dayPercent`） |
| `DynamicIsland state="charging"` | Live Activity · expanded | `ProgressView(timerInterval:)`、`Text(timerInterval:)` | 计时 `startedAt` + `totalSeconds`；**不要**推每秒更新 |
| `DynamicIsland state="done"` | Live Activity 结束态 | `Activity.end(...)` + 打勾动画 | 结束原因（完成 / 用户关闭）+ 最终 `days` |
| `LockCard` | Live Activity 锁屏卡片（iOS 16.1+） | `ActivityConfiguration` 的 `lockScreen` 视图 | 同上 `ContentState`；磨砂背景用 `.activityBackgroundTint` + 系统材质 |
| `AlarmCard` | AlarmKit 全屏闹钟（iOS 26+） | `AlarmManager.schedule` / `AlarmPresentation` | 提醒时刻、标题、音效策略；**必须**先取得用户授权 |
| 全局「今天已走 %」 | 自走时间文本 | `Text(timerInterval:)` / `ProgressView(timerInterval:)` | 当天 00:00 与次日 00:00 两个时间戳（跨夏令时也对） |

## 3. 逐组件说明

### 3.1 小组件 `Widget.tsx`

```ts
<Widget size="sm" | "md" | "lg" kind="since" | "habit" | "countdown" data={SystemItem | null} />
```

- 三尺寸三类型共 9 种组合，Web 用 CSS 的 `.is-sm/.is-md/.is-lg` × `.is-since/.is-habit/.is-countdown` 表达，
  原生对应 `supportedFamilies` × 三种 `entry` 视图；**不要**为 9 种组合写 9 个 Provider。
- 习惯类的环形按钮就是 iOS 17 的 Interactive Widget：`Button(intent: LogHabitIntent(id:))`。
  点击后 `AppIntent` 直接写 App Group 并 `WidgetCenter.shared.reloadTimelines(ofKind:)`。
- 商业分层按个数，不按尺寸：免费 1 个小组件，小 / 中 / 大任选；订阅可以再放多个。
  口径见 `docs/plan-v6-v3.md` 第四节。Web 原型不做拦截，只做视觉。
- 空态（`data = null`）文案 `sys.empty`，原生显示同一句 + 一枚蛋形态小伙伴。

### 3.2 灵动岛 `DynamicIsland.tsx`

```ts
<DynamicIsland state="idle" | "charging" | "done" item={SystemItem | null} timer={{ startedAt, totalSeconds }} />
```

| 状态 | 尺寸（Web） | 原生呈现 | 备注 |
| --- | --- | --- | --- |
| `idle` | 302×44 | `.compact`（leading 小伙伴 + trailing 天数）+ `.minimal` | 底部 2px 进度条 = 当天已走，原生用 `ProgressView(timerInterval:)` 自走 |
| `charging` | 360×104 | `.expanded` | 倒计时 `Text(timerInterval:)`、进度环 `ProgressView(timerInterval:)`、小伙伴做呼吸动画 |
| `done` | 244×44 | 结束态 | 先播打勾（0.4s），再 `Activity.end`；打勾不要依赖推送 |

- Web 的宽度过渡 `0.35s cubic-bezier(.34,1.56,.64,1)` 是 iOS 展开动效的近似；
  `.reduce-motion` 下瞬间切换，原生对应 `UIAccessibility.isReduceMotionEnabled` 时跳过动画。
- 灵动岛只有 iPhone 14 Pro 及以上有；其他机型 `compact/minimal` 走锁屏 Live Activity。
- 计时不要靠 push 每秒更新：`ContentState` 只写 `startedAt` 与 `totalSeconds`，
  系统自己走；只在暂停 / 完成 / 用户操作时 `update`。

### 3.3 锁屏卡 `LockCard.tsx`

```ts
<LockCard item={SystemItem | null} clock={SystemClock} />
```

- 磨砂底：Web 用 `backdrop-filter: blur(22px) saturate(160%)`；原生用
  `.activityBackgroundTint(.clear)` + 系统材质，**不要**自己画模糊（耗电且和系统不一致）。
- 内容顺序固定：当前焦点 → 标题 → 天数（`sys.lock.day`）→ 副行（倒数日期 / 习惯今日进度 / 当天百分比）→ 小伙伴。
- 锁屏是单色语境：原生 lock screen accessory（圆形 / 矩形）必须只用 `foregroundStyle(.primary/.secondary)`，
  不要传彩色资产；彩色只保留在长条卡（Live Activity）里。

### 3.4 闹钟卡 `AlarmCard.tsx`

```ts
<AlarmCard item={SystemItem | null} scene="countdown" | "reminder" onSnooze={} onDismiss={} />
```

- 原生对应 iOS 26 AlarmKit：`AlarmManager` 排程，`AlarmPresentation` 提供全屏样式；
  穿透静音 / 专注是系统行为，App 不能自己实现。
- 首次使用必须先弹授权（原型里的 `alarmAuth` 覆盖层）；拒绝则回退到普通本地通知
  （`src/lib/reminder.ts` 现有模型 + `.ics` 导出不变）。
- 两个按钮语义：`再等 10 分钟` = `snooze(600)`；`知道了` = `stop()` 并写一次「已处理」，
  避免同一提醒二次响。
- 声音/震动由系统闹钟负责，Web 模拟只做视觉与按钮回调。

## 4. 时钟：为什么 Web 要一个可注入的 hook

`useSystemClock` 默认真实时间；`mode: 'demo'` 时从当天 9:41 起、40× 速进，
用来在 36 分钟内演示「走完一整天」（跨午夜后天数自动 +1）。

原生侧不需要这个倍速：Live Activity 和 Widget 的时间文本都用
`Text(timerInterval:startDate:countsDown:)` / `ProgressView(timerInterval:)`，
由系统渲染，锁屏后也继续走。**唯一需要 App 提供的是两个绝对时间戳**：
当天 00:00 与次日 00:00（`startOfLocalDay` / `nextLocalMidnight`）。

## 5. 刷新与预算

| 场景 | Web 模拟 | 原生做法 |
| --- | --- | --- |
| 小组件天数跨天 | 时钟 tick 重算 | Timeline 每天 00:00 一个 entry（`.after(midnight)`），不要 15 分钟一刷 |
| 打卡后立即更新 | `useState` 覆盖 `count` | `AppIntent` 写 App Group + `reloadTimelines` |
| 倒计时 / 计时 | 每 200ms tick | `Text(timerInterval:)` 自走，零刷新 |
| 完成 / 结束 | 状态机 `charging → done` | `Activity.update` 一次结束态，再 `end` |

## 6. 权限与限制清单

- Live Activity：需要 `NSSupportsLiveActivities`；单次活动最长 8 小时，之后系统转入锁屏残留 4 小时。
- 灵动岛：仅 iPhone 14 Pro 及以上；其余机型不要展示「灵动岛」字样。
- AlarmKit：需要用户显式授权；被拒绝时静默回退本地通知。
- App Group：Widget / Live Activity Extension 与主 App 必须同一个 group，
  否则 `SystemItem` 读不到，表现为「小组件一直显示旧数字」。

## 7. 验收对照（原生侧照着勾）

- [ ] 小 / 中 / 大三种尺寸，三种 kind 的数字与 Web 截图逐字一致
- [ ] 习惯小组件点一下不打开 App 也能 +1
- [ ] 灵动岛 idle → charging → done 三态宽度/高度过渡与 Web 一致（0.35s）
- [ ] 锁屏卡在浅色壁纸上仍是磨砂，文字对比度 ≥ 4.5:1
- [ ] 闹钟穿透静音，`再等 10 分钟` 后 10 分钟再响
- [ ] 跨午夜：天数 +1，`今天已走` 归零，无需打开 App
