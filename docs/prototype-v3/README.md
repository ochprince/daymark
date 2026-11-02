# 刻度 Daymark · 原型 v3

**自己在走的日子 · 会动的宠物 · 小组件与灵动岛 · Pro**

## 核心差异点

### 1. 零打卡负担：自动计天数

坚持类事项（`type: 'since'`）不需要每天打卡，天数按日期自动累计（`DM.sinceDays`）。这一块刻意做轻：没有日子轨道、没有"没守住"流程，原型里不再单独设模块。

### 2. 会动的宠物：物理层与桌宠格式

宠物不是静态图标，而是活在屏幕上的生命：能走能坐能爬能掉下来，能拖拽能扔出去，能站在按钮、卡片、轨道上。

- **物理引擎**：重力 2200 px/s²，DOM 元素自动识别为平台，状态机驱动（站立/行走/坐下/睡觉/掉落/攀爬/拖拽/抛出）
- **Shimeji 格式**：解析 `actions.xml` 和 `shimeN.png` 序列帧，支持标准桌宠包
- **内置"麻糬"**：SVG 程序生成，十三个状态动画，无版权风险
- **事件响应**：`bus.on('charge')` 跳到计时按钮上陪伴，`on('log')` 撒爱心星星，`on('pet')` 撒娇

实现：`pets.js` + `pets.css`
- `#petLayer` 覆盖手机屏幕，`pointer-events: none` 但 `.pet-sprite` 为 `auto`
- 平台扫描：`PLAT_SEL` 选择器列表（`.hold`、`.growth`、`.stage-card`、`#tabbar`、`.card` 等）获取位置
- 拖拽：`pointerdown` 记录偏移，`pointermove` 更新位置，`pointerup` 采样速度扔出去
- 气泡：`.pet-say` 绝对定位在宠物上方，箭头 `::after` 用 `rotate(45deg)` 边框做

**许可证风险**：大部分 Shimeji 包是原神、崩铁、动漫角色的粉丝作品，有版权风险。应对：
1. 应用内只随附原创"麻糬"包（SVG 生成，安全）
2. 支持用户从 gitignored `pets-local/` 文件夹加载本地包（永不离开浏览器）
3. 真实 App 可引导用户从 DeviantArt、Pixiv 自行下载，在设备本地导入
4. Shimeji-ee 本身 GPL v3，不能照抄代码，只能学格式

### 3. 系统表面：小组件 · 灵动岛 · 锁屏 · 闹钟

iOS 14+ 小组件、iPhone 14 Pro 灵动岛、iOS 16 锁屏自定义、定时提醒。

实现：`system.js` + `system.css`
- **虚拟时钟**：`vsec()` 从 9:41 开始以 40× 速度走，方便演示
- **小组件**：三种尺寸 × 事项类型适配，坚持类显示天数，日常类显示今日进度，倒数类显示剩余天数
- **灵动岛**：闲时显示当前焦点天数百分比，日常计时时展开显示倒计时 + 宠物动画，完成时显示打勾动画
- **锁屏卡片**：当前焦点事项 + 宠物，浅色磨砂背景
- **闹钟提醒**：定时响起，卡片样式，显示宠物和提醒文案

### 4. Pro 订阅：免费核心 + 付费增值

免费版保留核心记录、宠物成长与藏馆、通知与小组件（同时 8 件事），Pro 解锁情绪层。

实现：`pro.js` + `pro.css`
- **付费墙**：`DM.pro.gate(source, fn)` 检查 `S.pro`，未订阅时打开付费页
- **订阅层级**：年度 ¥18（先试 7 天）/ 永久 ¥28（原型示意价）
- **Pro 权益**：更多宠物包、皮肤与配色、锁屏实时活动与灵动岛、闹钟式提醒、iCloud 同步、不限件数
- **设置页**：Pro 卡片显示订阅状态和恢复购买
- **宠物包页**：卡片式宫格，支持从本地导入

## 技术架构

### 文件结构

```
docs/prototype-v3/
├── index.html          # 入口，按序加载所有模块
├── core.js             # 全局状态 DM.S、事件总线、渲染循环、数据模型
├── creatures.js        # 宠物物种定义、成长阶段、SVG 资产
├── overlays.js         # 浮层系统：新建、详情、删除确认、送别
├── tabs.js             # 标签页：今天、箱子、时间线
├── demo.js             # 演示台：流程步骤、场景钩子、注释面板
├── pro.js              # Pro 模块：付费墙、设置、宠物包、统计、农历、提醒
├── system.js           # 系统表面：小组件、灵动岛、锁屏、闹钟
├── pets.js             # 会动的宠物：物理引擎、Shimeji 加载、拖拽
├── *.css               # 对应样式文件
└── pets-local/         # gitignored，用户本地导入的 Shimeji 包（不上传）
```

### 扩展点

模块通过注册表挂接到核心，无需修改其他文件：

- `DM.VIEWS[tab]` 函数返回标签页 HTML
- `DM.VIEW_AFTER[tab]` 渲染后回调，绑定事件
- `DM.OV[type]` 函数返回浮层 HTML
- `DM.OV_AFTER[type]` 浮层渲染后回调
- `DM.ACT[name]` 动作处理器，`data-act="name"` 触发
- `DM.onRender` 数组，每次渲染后执行
- `DM.FLOWS` 演示流程定义
- `DM.NOTES` 场景注释内容
- `DM.sceneHooks` 场景识别钩子
- `DM.bus.on(type, fn)` 事件订阅

### 数据模型

```javascript
S = {
  simDay: 20006,           // 模拟日期，原点 1970-01-01
  tab: 'today',            // 当前标签页
  its: [...],              // 事项数组
  focus: 'smoke',          // 当前焦点事项 ID
  ovs: [],                 // 浮层堆栈
  step: null,              // 演示步骤 ID
  pro: 'trial',            // 订阅状态：null / 'trial' / 'year' / 'life'
  proUntil: 20013,         // 试用/订阅到期日
  ...
}

it = {
  id: 'smoke',
  type: 'since',           // 'since' / 'habit' / 'countdown'
  name: '戒烟',
  start: 19926,            // 开始日期
  prev: null,              // 上一章结束日期
  species: 'sprout',       // 物种：sprout / moon / drop / star / post
  hue: 'mint',             // 色相：mint / sky / grape / lemon / coral
  stage: 2,                // 成长阶段 0-4
  charge: 7200,            // 已充能时长（秒）
  chapters: [...],         // 历史章节
  ...
}
```

### 色相系统

5 个色相（mint、sky、grape、lemon、coral），每个有 `--h-X` 和 `--h-X-2` 两级颜色，在 `proto.css` 里按主题定义。

使用：`style="${DM.hueStyle(it.hue)}"` 注入 `--c` 和 `--c2`。宠物 SVG 的填充全靠这两个变量，渲染宠物的外层元素必须带上，否则会渲染成黑色。

### 事件总线

```javascript
DM.bus.on('charge', ({ id, r }) => { /* 计时开始/进行中，r 是进度 0-1 */ })
DM.bus.on('log', ({ id }) => { /* 完成一次计时 */ })
DM.bus.on('pet', ({ id, x, y }) => { /* 点击宠物 */ })
DM.bus.on('focus', ({ id }) => { /* 焦点切换 */ })
```

## 演示台使用

左侧流程面板选择演示主题，点击步骤跳转场景，右侧注释面板显示设计意图和操作提示。

关键流程：
- **P · 会动的宠物**：物理交互 → 拖拽扔 → 事件响应 → 换装
- **W · 系统表面**：小组件 → 灵动岛 → 锁屏 → 闹钟
- **$ · Pro 订阅**：付费墙 → 设置页 → 宠物包商店

## 构建与测试

**无构建步骤**：纯 HTML/CSS/JS，直接用浏览器打开 `index.html`。

**本地服务器**（支持 `pets-local/` 加载）：

```powershell
cd docs/prototype-v3
python -m http.server 8080
# 访问 http://localhost:8080
```

**自动化测试**：

```powershell
node C:\Users\Administrator\AppData\Local\Temp\cdp\shot.cjs out.png "DM.demo.ensureSeed(); DM.demo.today('smoke')"
```

使用 Chrome DevTools Protocol 无头截图，验证加载无错误。

## 已知限制

1. **`file://` CORS**：本地 Shimeji 包需要 http 服务器
2. **版权风险**：大部分桌宠包是粉丝作品，只能用户自行导入
3. **性能**：物理引擎未优化，多个宠物可能卡顿
4. **移动端**：触摸事件已支持，但未在真机测试
5. **无障碍**：缺少 ARIA 标注和键盘导航

## 下一步

- [ ] 真机测试（iOS Safari）
- [ ] 无障碍审计（VoiceOver）
- [ ] 性能优化（RAF 节流、平台缓存）
- [ ] 更多宠物包（确保版权安全）
- [ ] 数据持久化（localStorage → IndexedDB）
- [ ] 真实 API 对接准备
