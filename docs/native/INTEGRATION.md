# 前端接入清单（原生壳）

`src/lib/native.ts` 是唯一入口。它在浏览器里全部是安全的 no-op，
在原生 WebView 里走 `window.Capacitor.Plugins`（`npx cap sync` 之后才存在）。
**调用点全部 try/catch 过，失败不影响主流程。**

## 1. 触感（Haptics）

| 时机 | 调用 | 说明 |
| --- | --- | --- |
| 蓄力记一次落定（`onLog` 成功之后） | `hapticTap('medium')` | 不要让每一帧都触发 |
| 进化过场开始 | `hapticSuccess()` | 只在形态升级时，低频 |
| 切换焦点 / 点按钮 | 不调用 | 省电，也避免廉价感 |

接入位置：`src/v2/AppV2.tsx` 的 `onLog` 回调末尾。

```ts
import { hapticTap } from '../lib/native'
// onLog 里：tapCheckIn 之后
hapticTap('medium')
```

开关：装扮页的「轻震」写在 `daymark.prefs.v1`（`prefs.haptic`）。
应用启动时把偏好推给桥：`setHapticsEnabled(getPrefs().haptic)`，
用户切换开关时再推一次。

## 2. 状态栏与首帧

- 皮肤变化后调 `setStatusBarTheme('dark' | 'light')`；
  判断依据是当前皮肤包：`night` → dark，其余 → light。
- 启动图在首页渲染完第一帧后调 `hideSplash()`。
  调用点在 `src/main.tsx` 里 `root.render(...)` 之后，用 `requestAnimationFrame` 包一层。

## 3. 本地通知

- **权限只在用户第一次打开「提醒」开关时申请**，不要启动就弹。
- `ensureNotificationPermission()` → `'granted'` 才调 `scheduleReminder()`。
- 每件事存自己的通知 id（用事件的 hash 或自增 id），改时间先 `cancelReminder(id)`。
- 通知内容走 i18n，切语言要重排已有提醒（下一版做）。

## 4. 系统分享

`shareText()` 给不支持 Web Share 的旧 WebView 兜底。
分享卡优先用 `navigator.share({files})`（本地已实现），失败再走桥。

## 5. 存储

- Web 用 `localStorage`（key 前缀 `daymark.`）。
- 原生 WebView 的 `localStorage` 落在 WKWebView 的容器里，**卸载 App 会一起没**。
  所以：不引入 Preferences 插件，保持 localStorage 单一来源；换机靠「导出备份」。
- `capacitor://localhost`（iOS）/ `https://localhost`（Android）是 origin，
  **上线后不能改**，改了等于清空所有用户数据。

## 6. 构建

```bash
npm run build:native      # CAPACITOR_BUILD=1 的 web 构建
npx cap sync ios          # 拷贝 dist + 同步插件
cd ios/App && pod install # 首次
open ios/App/App.xcworkspace
```

## 7. 还没做的（下一版）

- 小组件（WidgetKit）：需要在 Xcode 里加 Extension target，用 App Group 读数据。
- 提醒的重复规则（每天/每周）目前只排一次性通知。
- 备份导入（现在只能导出）。
