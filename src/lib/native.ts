/**
 * 原生能力桥（Capacitor 6）。
 *
 * 为什么不用 `import { Haptics } from '@capacitor/haptics'`：
 * @capacitor/* 目前只写在 package.json 里、还没装进这台机器的 node_modules，
 * 一旦静态 import，`npx tsc -b` 会直接报 Cannot find module，Web 构建也会因为
 * 解析失败而挂掉。这里改走 Capacitor 的运行时桥 `window.Capacitor.Plugins`：
 * 它是原生 WebView 注入的（`cap sync` 之后才有），在浏览器里根本不存在，
 * 于是所有函数自然降级成 no-op 或浏览器原生实现。
 *
 * 依赖装好之后可以把实现换成正式 import，**对外签名不用改**——调用点已经写在
 * docs/native/INTEGRATION.md 里了。
 *
 * 三条纪律（和 src/lib/sfx.ts 一致）：
 * 1. 原生能力是锦上添花，任何一步都不许把应用弄崩，所以全部包 try/catch。
 * 2. 不读 localStorage / 不依赖 React —— 这个模块要能在 node 里直接跑单测。
 * 3. 开关（震动开没开）由调用方通过 setHapticsEnabled 推过来，这里不主动读偏好。
 */

/** 插件实例在运行时是个方法表；Capacitor 的代理对象就是这么用的 */
type PluginInstance = Record<string, ((args?: unknown) => unknown) | undefined>

type CapacitorGlobal = {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
  Plugins?: Record<string, PluginInstance | undefined>
}

export type NativePlatform = 'ios' | 'android' | 'web'

/** 与 Capacitor 的 ImpactStyle 同值：HEAVY / MEDIUM / LIGHT */
export type HapticImpact = 'light' | 'medium' | 'heavy'

export type ThemeName = 'dark' | 'light'

/** 与 src/lib/useTheme.ts 里的 THEME_COLORS 保持一致（那边是私有常量，这里不能 import） */
const STATUS_BAR_COLOR: Record<ThemeName, string> = { dark: '#08090C', light: '#F7F5F2' }
const STATUS_BAR_STYLE: Record<ThemeName, 'DARK' | 'LIGHT'> = { dark: 'DARK', light: 'LIGHT' }

let hapticsEnabled = true

function bridge(): CapacitorGlobal | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
}

function plugin(name: string): PluginInstance | undefined {
  const capacitor = bridge()
  if (!capacitor || !capacitor.Plugins) return undefined
  return capacitor.Plugins[name]
}

/**
 * 调一个插件方法。
 * 返回 null 表示「这个环境没有这个插件/方法」，调用方据此决定要不要降级；
 * 返回 Promise 表示已经交给原生端，失败一律静默吞掉（不弹错、不阻塞 UI）。
 */
function invoke(name: string, method: string, args?: unknown): Promise<unknown> | null {
  const target = plugin(name)
  const fn = target?.[method]
  if (typeof fn !== 'function') return null
  try {
    const result = fn.call(target, args) as Promise<unknown> | unknown
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      return (result as Promise<unknown>).catch(() => undefined)
    }
    return Promise.resolve(result)
  } catch {
    return null
  }
}

/** 是否跑在原生壳里（浏览器里恒为 false） */
export function isNative(): boolean {
  const capacitor = bridge()
  if (!capacitor?.isNativePlatform) return false
  try {
    return capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function platform(): NativePlatform {
  if (!isNative()) return 'web'
  const name = bridge()?.getPlatform?.()
  return name === 'ios' || name === 'android' ? name : 'web'
}

/* ------------------------------------------------------------------ *
 * 触感
 * ------------------------------------------------------------------ */

/** 把「设置 → 震动」开关推过来（AppV2 里订阅 prefsStore 即可） */
export function setHapticsEnabled(on: boolean): void {
  hapticsEnabled = on
}

export function isHapticsOn(): boolean {
  return hapticsEnabled
}

/**
 * 记一次打卡（蓄力蓄满）时来一下。
 * 原生端走 Taptic Engine 的 impact；浏览器端退化成 Vibration API（iOS Safari 没有，静默）。
 */
export function hapticTap(style: HapticImpact = 'light'): void {
  if (!hapticsEnabled) return
  if (!isNative()) {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(style === 'heavy' ? 18 : 8)
      }
    } catch {
      /* 震动失败无所谓 */
    }
    return
  }
  void invoke('Haptics', 'impact', { style: style.toUpperCase() })
}

/** 进化 / 拿到徽章 / 仪式完成：成功型触感 */
export function hapticSuccess(): void {
  if (!hapticsEnabled) return
  if (!isNative()) return
  void invoke('Haptics', 'notification', { type: 'SUCCESS' })
}

/* ------------------------------------------------------------------ *
 * 状态栏与开屏图
 * ------------------------------------------------------------------ */

/**
 * 皮肤切换时调用，让状态栏的字色与底色跟着深/浅走。
 * 一次调两个方法：iOS 只认 setStyle（字色），Android 还要底色。
 */
export function setStatusBarTheme(theme: ThemeName): void {
  if (!isNative()) return
  void invoke('StatusBar', 'setStyle', { style: STATUS_BAR_STYLE[theme] })
  void invoke('StatusBar', 'setBackgroundColor', { color: STATUS_BAR_COLOR[theme] })
}

/** 首帧画完之后再收开屏图（capacitor.config.ts 里 launchAutoHide 是 false） */
export function hideSplash(): void {
  if (!isNative()) return
  void invoke('SplashScreen', 'hide')
}

/* ------------------------------------------------------------------ *
 * 分享
 * ------------------------------------------------------------------ */

export type SharePayload = {
  title?: string
  text?: string
  url?: string
  dialogTitle?: string
}

/**
 * 调系统分享面板。返回 false 表示这个环境没有原生分享（调用方自己退回到
 * navigator.share 或复制到剪贴板）。
 */
export async function shareText(payload: SharePayload): Promise<boolean> {
  if (!isNative()) return false
  const result = invoke('Share', 'share', payload)
  if (!result) return false
  try {
    await result
    return true
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ *
 * 本地通知（提醒）
 * ------------------------------------------------------------------ */

export type NotificationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

/**
 * 请求通知权限。**只在用户真的打开了某条提醒时才调**，
 * 不要在启动时弹（理由见 docs/native/INTEGRATION.md）。
 */
export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!isNative()) return 'unsupported'
  const status = invoke('LocalNotifications', 'checkPermissions')
  if (!status) return 'unsupported'
  try {
    const current = (await status) as { display?: string } | undefined
    if (current?.display === 'granted') return 'granted'
    if (current?.display === 'denied') return 'denied'
  } catch {
    return 'unsupported'
  }
  const asked = invoke('LocalNotifications', 'requestPermissions')
  if (!asked) return 'unsupported'
  try {
    const next = (await asked) as { display?: string } | undefined
    if (next?.display === 'granted') return 'granted'
    if (next?.display === 'denied') return 'denied'
    return 'prompt'
  } catch {
    return 'unsupported'
  }
}

export type ReminderDraft = {
  /** 用事件 id 的数字哈希，保证同一条记录重复排程时覆盖而不是叠加 */
  id: number
  title: string
  body: string
  /** 触发时刻（毫秒时间戳） */
  at: number
}

/** 排一条本地提醒。返回 false 表示没排上（没权限/不在原生壳里） */
export async function scheduleReminder(draft: ReminderDraft): Promise<boolean> {
  if (!isNative()) return false
  const permission = await ensureNotificationPermission()
  if (permission !== 'granted') return false
  const result = invoke('LocalNotifications', 'schedule', {
    notifications: [
      {
        id: draft.id,
        title: draft.title,
        body: draft.body,
        schedule: { at: new Date(draft.at), allowWhileIdle: true },
      },
    ],
  })
  if (!result) return false
  try {
    await result
    return true
  } catch {
    return false
  }
}

/** 取消一条提醒（删掉记录、或用户关掉提醒时调） */
export function cancelReminder(id: number): void {
  if (!isNative()) return
  void invoke('LocalNotifications', 'cancel', { notifications: [{ id }] })
}
