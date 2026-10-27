# v2 系统性排查 · 还差什么（2026-10-26）

> 排查口径：**只有真构建 + playwright 跑通过才算「做了」**。
> 分三档：✅ 验过 / 🟡 写了但没验 / ⛔ 环境做不了。
> 对照来源：`docs/prototype-v2/demo.js`（24 个场景）、`docs/plan-v2.md`（口径）、`docs/plan-v3-ship.md`（上架）、`docs/plan-v4-gaps.md`（上一轮差距表）。

---

## 〇、先更正一条我说错的话

上一次我讲「主题的组件级补丁缺得多，paper / pixel 只换了颜色没换形态」——**这是错的**，这次用选择器集合做了差集，实测：

| 皮肤 | 原型补丁数 | 我们补丁数 | 原型有、我们没有 |
|---|---|---|---|
| jelly | 1 | 1 | 0 |
| paper | 33 | 38 | 0 |
| night | 16 | 21 | 0 |
| pixel | 31 | 41 | 0 |

（`[data-theme='x'] .sel` vs `[data-skin='x'] .sel` 的集合差）

结论修正：**主题的 CSS 层不缺，我们的补丁还多出几条**。真正缺的是「能不能用、能不能看见」——也就是下一节那些死链。

---

## 一、P0：代码写着，但根本没连上（比「没做」更糟）

这类问题不查不知道，因为它看着像做完了。

- [x] **降级动效（reduce-motion）整条链路是死的** —— 已修 `16813f6`：类挂到 `<html>`、规则搬到被引入的 app.css、JS 侧统一读 `prefersReducedMotion()`。实测三种状态 animationName / transitionDuration 分别为 `bob`/`0.35s`、`none`/`1e-05s`、`none`/`1e-05s`。
  - 连带查出的新问题见下面「孤儿样式文件」。
  - `prefs.reduceMotion` 存在、`reduceMotionOn()` 也导出了，但**没有任何调用点**（全项目 grep 为 0）；
  - CSS 里唯一的规则是 `.phone.reduce-motion …`，而 v2 根节点早就改成 `.dm-screen`，**这条选择器匹配不到任何元素**；
  - 结果：用户开「减少动效」、或系统开了 reduce motion，动画一样全跑。
  - 落点：`src/lib/prefs.ts:59`、`src/v2/tabs.css:55`、根节点在 `src/v2/AppV2.tsx:442`。

- [x] **「跟随系统深色」是假开关**（已修 `8c2fa42`，实测 dark→night、light→jelly）

- [ ] **装扮页换皮肤没有整屏预览**：选包时只有三个色点，用户看不到换完什么样，只能先选再退出去看。

- [ ] **纹理 / 数字字体的 `auto` 没有对照表**：`num: auto`、`texture: auto` 各皮肤该落到哪个值，代码里没有 explicit 映射，靠 CSS 兜底，出一套新皮肤就没准了。
  - `[data-texture]` 规则只有 4 条、`[data-num]` 5 条，覆盖明显偏薄（`plain/dots/grid/lines` 四档 + `round/serif/pixel/hand` 四种）。

- [ ] **`src/v2/tabs.css` 是孤儿文件**：没有任何入口 `import` 它，里面的规则（含 `.dex` 五列网格修正、`.w-hero`/`.w-egg` 等）**从来没进过构建**。
  - 这次 reduce-motion 原本就写在里面，所以就算选择器对也不会生效。
  - 要么整体 import 进来跑一遍视觉回归，要么把有用的规则逐条迁到 app.css。

---

## 二、P0：原型有、我们还没有的交互

- [ ] **首次引导三步**：原型是 welcome → 选蛋 → 命名 → 孵化。我们只有一句空态 + 一个「+」，孵化仪式在**创建之后**才播。
- [ ] **`swipe-hint` 的循环 nudge / `hint-finger` 手指提示**：样式都移植了（`@keyframes nudge`、`tapHint`），组件里没用。
- [ ] **「说过了」没有撤销**：记一次有「撤销」（已做），倒数日点「说过了，明年见」直接 `markSaid` + toast，撤不回来。
- [ ] **藏馆多本翻页动画未验证**：上一本/下一本 + `flip-l/flip-r` 已写，**单本时控件隐藏已验**，多本翻页的中间帧没截到 → 现在算 🟡。

---

## 三、P1：上架与商店（基本都卡在人/设备）

- [ ] 真实 IAP 商品（`com.liangyi.daymark.pro`，$0.99 非消耗型）
- [ ] App Store Connect 应用档案、名称查重（Daymark 可能被占）、开发者主体
- [ ] 真机联调（iOS 安全区、状态栏、触感、系统分享）
- [ ] 商店截图重跑：主题与交互这轮改过，`docs/store/` 里的图已过期
- [ ] `manifest.webmanifest` 缺 `screenshots` 与 `shortcuts`（PWA 安装态展示会难看）
- [ ] 隐私问卷逐项答案复核（`docs/store/LISTING.md` 里有一版，需跟新增的相片/备份能力对一遍）

---

## 四、P1：工程质量

- [ ] **没有组件级测试**：200 个用例全在 `src/lib`（16 个测试文件），`src/v2` 的 23 个组件零覆盖，交互只能靠 playwright 手跑。
- [ ] **死代码**：`src/App.tsx`（689 行，v1 PWA）、`src/components/TopBar.tsx`（93 行）、`src/lib/useTheme.ts` 仍在仓库里，入口已切 `AppV2`。
- [ ] **可访问性没系统性过**：23 个 v2 组件里只有 12 个有 `aria-label`；没有键盘焦点样式、没有焦点陷阱检查、对比度只验过夜航气泡一处（15.42）。
- [ ] 27 处 `TODO/待办` 注释散在源码里，没有集中台账。

---

## 五、P2：能力延伸（环境阻塞或优先级低）

- [ ] WidgetKit 小组件（需要 Xcode target）
- [ ] 实时活动 / 灵动岛（见 `docs/taste/2026-10-25-yoyo.md`，同样需要 Xcode + ActivityKit）
- [ ] 多设备同步（与「零后端」口径冲突，暂不做）

---

## 六、已经过验证的部分（供对照，不用重做）

| 能力 | 证据 |
|---|---|
| 相片背景 | 选图 → IndexedDB → `photoId` 落库 → 卡片挂 `.pb__img` |
| 备忘 + 待办 | 失焦即存、回车新增、勾选 `done` 落库 |
| 孵化仪式 / 音效 / 当天庆祝 / 书飞进藏馆 | 各自实测截图 + 无 console error |
| 分享卡三模板 | 应用内导出 1080×1920，三种 tab 切换正常 |
| 提醒 + `.ics` | 142→200 用例覆盖 RRULE、UTC 断言 |
| 备份导入 | 导出→清空→导入全部回来 |
| 横滑/蓄力/摸摸/撤销 | 拖 -120 切换、+120 切回、40 不动；撤销后 `days={}`、`growthDays` 回退 |
| 四套皮肤切换 | jelly/paper/night 圆角 99px、pixel 0px；跟随系统 dark→night |

---

## 七、建议的下一步顺序

1. **修 reduce-motion 死链**（改动小、影响真用户，属于「承诺了没兑现」）
2. **装扮页整屏预览**（主题是卖点，看不见等于没有）
3. **首次引导三步 + 说过了可撤销**（原型的骨感体验缺两块）
4. **藏馆多本翻页验证并截图**（把 🟡 变 ✅）
5. **删死代码 + 补 a11y 清单**
6. **重跑商店截图**（等界面稳定后一次性出图）
