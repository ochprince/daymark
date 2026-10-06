# Daymark · 刻度

> 记录一个值得纪念的日子，然后看它已经走过多少天。

添加的那一刻起开始计时，卡片上的数字按自然日自动往上走。是一个纯前端、零后端、数据不出本机的「正向倒数日」。

**在线地址**：https://ochprince.github.io/daymark/

---

## 功能

| 能力 | 说明 |
| --- | --- |
| 添加事件 | 底部悬浮按钮 → 填写名称 →（可选）改起始日期 → 选标记颜色 → 开始记录 |
| 天数计算 | 按**自然日**计算，跨过午夜自动 +1；当天添加即 0 天，昨天添加即 1 天 |
| 时间倒序 | 经历时间越长的排越上面；同一天添加的按创建时间排 |
| 辅助刻度 | 超过 31 天时显示「X 年 Y 个月 Z 天」（按自然月计算，非 30 天近似） |
| 里程碑 | 恰好踩中 7 / 30 / 100 / 365 / 1000 天等节点时，徽标会亮起一枚 ✦ |
| 编辑 | 点击卡片打开同一个表单，可改名称、起始日期、颜色 |
| 删除 | 卡片左滑露出删除；删除后 6 秒内可「撤销」 |
| 主题 | 深/浅双主题，默认跟随系统，手动切换后记住选择 |
| 离线 & 安装 | 有 Service Worker，支持「添加到主屏幕」当原生 App 用 |
| 重置与历史 | 「已经走过的日子」里点开某条记录，事件名称右边有「重置」：把起始日改回今天，保存后之前的天数清零，并作为一段历史归档；下次编辑时事件名称旁出现「历史」，里面按重置时间从近到远列出每一段坚持了多少天 |
| 倒数日 | 右侧页「还在等待的日子」：填一个未来的日子，按「还有 N 天」正序排；生日这类每年回来的日子选重复周期即可 |
| 节日 | 倒数日页点「+」→「节日」，按分组挑选法定节假日、中国传统节日与欧美节日；**点一下即加入列表**，再点一下移除 |
| 翻页 | 整页左右滑动即可在两页间切换，无限循环；落在卡片上的横向拖动仍只用于删除 |
| 本地存储 | 全部数据写在 `localStorage`，不联网、无账号、无埋点 |

## 技术选型

| 层 | 选择 | 为什么 |
| --- | --- | --- |
| 构建 | Vite 5 + TypeScript（严格模式） | 秒级冷启动，`tsc -b` 先于打包跑，类型错误拦在 CI 前 |
| 视图 | React 18 | 组件复用、状态可预测 |
| 状态 | `useSyncExternalStore` + 一个 60 行的本地 store | 不引入状态库；顺带获得多标签页 `storage` 事件同步 |
| 动效 | `motion`（Framer Motion 12） | 弹簧参数、`layout` 重排动画、拖拽手势开箱即用 |
| 样式 | 原生 CSS + 设计令牌（CSS 变量） | 单页应用不需要原子类框架，产物更小、可控性更高 |
| 字体 | Inter Variable（`@fontsource` 自托管） | 不走 Google Fonts CDN，国内直连可用；中文交给系统字体 |
| 图标 | 手写 SVG 组件 | 无图标库依赖，风格统一 |
| 测试 | `node:test` + `tsx` | Node 自带测试器，零测试框架依赖；弱机器上不会因 worker 池 OOM |
| 部署 | GitHub Actions → GitHub Pages | push 即发布，构建产物走 Pages 官方 artifact |

> 只用 4 个运行时依赖：`react`、`react-dom`、`motion`、`@fontsource-variable/inter`。

## 一些实现细节

- **天数口径**：先把两端都归零到本地 00:00 再相减，所以同一天任何时刻添加都是 0 天；跨夏令时用四舍五入吸收 ±1 小时的误差（见 `src/lib/days.ts`）。
- **年/月/日拆分**：按自然月逐月推进并做月末收敛（1 月 31 日 + 1 月 = 2 月 28 日），不是除以 30 的估算。
- **左滑删除**：`motion` 的 `drag="x"` + 弹簧回弹；拖动结束后浏览器还会补发一次 click，用 ref 挡掉，避免「滑完顺手打开了编辑」。
- **iOS 键盘**：底部弹层用 `visualViewport` 的 `height / offsetTop` 跟随软键盘，避免被键盘盖住（`src/lib/useVisualViewport.ts`）。
- **主题切换**：支持 View Transitions API 时用圆形擦除过渡，不支持则直接切换；`prefers-reduced-motion` 下全部动效关闭。
- **配色**：8 组精选强调色，深色主题用渐变文字，浅色主题换成同色系的实心墨色，保证对比度。
- **节日日期**：农历节日（春节、中秋、腊月节日……）用一份离线表（`src/lib/lunar-dates.ts`，覆盖农历 2024–2098），运行时不再依赖平台的农历实现；表由 `scripts/gen-lunar-dates.py` 用 lunardate 生成并抽查官方日期（**不要改用浏览器 ICU**：2027 春节 ICU 给 02-07，官方是 02-06，2030 年同样差一天）；复活节走 computus，清明用 21 世纪适用的节气近似式，母亲节/感恩节这类按「某月第 n 个星期几」算。
- **节日为什么记得住**：倒数日事件存 `festivalId`，下一次发生按节日规则重算（`nextOccurrence` 第四参），所以农历节日、复活节这类每年日期都在变的节日，跨年也不会算歪；手动改过日期就自动摘掉这个字段。

## 目录结构

```
daymark/
├── public/                  # 图标、manifest、Service Worker
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── icon-*.png
├── scripts/
│   └── make-icons.py        # 用浏览器把 SVG 标记渲染成各尺寸 PNG 图标
├── src/
│   ├── components/          # Background / TopBar / Hero / EventCard / CountdownCard / SwipeCard
│   │                        # Sheet / EventSheet / CountdownSheet / FestivalSheet / AddMenu / Toast / Fab
│   ├── lib/
│   │   ├── days.ts          # 天数、日期格式化、年/月/日拆分、下次发生、排序（含单元测试）
│   │   ├── festivals.ts     # 节日目录与日期规则（含单元测试）
│   │   ├── lunar-dates.ts   # 农历节日 → 公历日期的离线表
│   │   ├── usePager.ts      # 整页翻页手势 + 无限循环轨道
│   │   ├── storage.ts       # localStorage 读写 + 订阅
│   │   ├── palette.ts       # 强调色与自动配色
│   │   ├── useNow.ts        # 会自己走动的「现在」
│   │   ├── useTheme.ts      # 主题与 View Transitions
│   │   └── useVisualViewport.ts
│   ├── App.tsx
│   ├── index.css            # 设计令牌 + 全部样式
│   └── main.tsx
├── .github/workflows/
│   ├── deploy-pages.yml     # main → 根路径
│   └── preview-pages.yml    # 分支预览 → /preview/
└── vite.config.ts
```

## 本地开发

| 命令 | 作用 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run dev` | 本地开发，http://localhost:5190 |
| `npm test` | 跑日期与节日的单元测试（26 个用例） |

重新生成农历表（改了覆盖范围时）：

```bash
pip install lunardate
python3 scripts/gen-lunar-dates.py
```
| `npm run build` | 类型检查 + 生产构建到 `dist/` |
| `npm run preview` | 预览构建产物 |
| `npm run typecheck` | 只做类型检查 |
| `python3 scripts/make-icons.py` | 重新生成 PWA 图标（需要 playwright + chromium） |

## 部署

推送到 `main` 即自动部署：`npm ci` → `npm test` → `npm run build` → 上传 `dist` → 发布到 Pages。

首次在别的账号/仓库复用时，需要到仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。

### 分支预览

`feat/festival` 分支推上去后由 `preview-pages.yml` 发布到 **https://ochprince.github.io/daymark/preview/**：
主站内容始终取自 `main`（不受预览影响），当前分支构建到 `/preview/` 子路径并带上「预览」标识。
审核通过后合并回 `main`，正式部署由 `deploy-pages.yml` 接管。

> 预览与正式版同源，共用同一份 `localStorage`——预览里添加的条目也会出现在正式版中。

`vite.config.ts` 里 `base` 按 `process.env.CI` 切换：本地是 `/`，GitHub Actions 里是 `/daymark/`，所以本地调试和线上子路径互不干扰。

## 数据

```ts
type DayEvent = {
  id: string          // crypto.randomUUID()
  title: string       // 事件名称
  startedAt: number   // 起始时刻（天数从这天 00:00 起算）
  createdAt: number   // 创建时刻，用于同一天排序
  color: number       // 调色板索引
  history?: {         // 重置归档：每段坚持了多少天、哪天被重置
    days: number
    endedAt: number
  }[]
}

type CountdownEvent = {
  id: string
  title: string
  startedAt: number   // 首次发生的时刻
  createdAt: number
  color: number
  repeat: 'none' | 'monthly' | 'yearly'
  festivalId?: string // 来自节日列表时记下，跨年按节日规则重算
}
```

存储键：`daymark.events.v1`、`daymark.countdowns.v1`、`daymark.theme.v1`。

数据只在这台设备的浏览器里。换设备、清缓存即丢失——这是刻意的取舍：不要账号、不要服务器、不要联网权限，也就不用为隐私写任何承诺。

## License

MIT
