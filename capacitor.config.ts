/**
 * Capacitor 6 原生壳配置。
 *
 * 为什么这里不 `import type { CapacitorConfig } from '@capacitor/cli'`：
 * 本仓库的 node_modules 是共享的，@capacitor/* 只写在 package.json 里尚未安装，
 * 一旦 import 类型，`npx tsc -b`（tsconfig.node.json 包含本文件）会直接报
 * “Cannot find module”。等依赖装好之后，可以换成
 *   import type { CapacitorConfig } from '@capacitor/cli'
 *   const config: CapacitorConfig = { ... }
 * 语义完全一样，CLI 只要求默认导出一个对象。
 *
 * 改这里的任何一项都要跟着改 ios/ 与 android/ 里的原生文件（见 docs/native/INTEGRATION.md）。
 */
const config = {
  /** 与 App Store Connect 里建 App 时填的 Bundle ID 必须逐字一致 */
  appId: 'com.liangyi.daymark',
  appName: 'Daymark',
  /** vite build 的产物目录；`npx cap sync` 会把它拷进两个原生工程 */
  webDir: 'dist',

  server: {
    /**
     * Android 用 https://localhost，iOS 固定 capacitor://localhost（见 docs/native/INTEGRATION.md）。
     * 这两个 origin 是 localStorage 的隔离单位，上线后**不能改**，改了等于清空所有用户数据。
     */
    androidScheme: 'https',
    hostname: 'localhost',
    cleartext: false,
    /**
     * 白名单：只有这些域名允许在 WebView 内部导航。
     * 隐私政策 / 支持页放 GitHub Pages，留在应用内打开；其余外链一律交给系统浏览器
     * （Capacitor 对不在白名单里的链接默认就是 openExternal）。
     */
    allowNavigation: ['ochprince.github.io'],
  },

  ios: {
    /** WebView 不要自己加内边距：安全区由 CSS 的 env(safe-area-inset-*) 处理 */
    contentInset: 'never',
    /** 首帧之前 WebView 的底色，必须等于深色皮肤的底，否则闪白 */
    backgroundColor: '#08090C',
    /** 需要 Info.plist 里配 WKAppBoundDomains 才能开，我们没有，保持 false */
    limitsNavigationsToAppBoundDomains: false,
    /** 移动版 UA：避免 iPad 上被当成桌面站点 */
    preferredContentMode: 'mobile',
  },

  android: {
    backgroundColor: '#08090C',
    /** 没有任何 http 资源，禁止混合内容 */
    allowMixedContent: false,
    captureInput: true,
    /** 只在 debug 构建里从 JS 侧打开；这里保持关闭，排障时用 chrome://inspect */
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    SplashScreen: {
      /**
       * launchAutoHide: false —— 开屏图由前端在首帧绘制完成后手动 hide，
       * 否则 600ms 一到就露出还没画完的页面（冷启动最明显）。见 INTEGRATION.md。
       */
      launchShowDuration: 600,
      launchAutoHide: false,
      backgroundColor: '#08090C',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      /** DARK = 深色背景下用浅色字（Capacitor 的命名反直觉，见插件 definitions） */
      style: 'DARK',
      /** 让 WebView 一直铺到状态栏底下，颜色由前端按皮肤调 setStyle/setBackgroundColor */
      overlaysWebView: true,
      backgroundColor: '#08090C',
    },
    LocalNotifications: {
      /** Android 通知栏小图标：必须是纯白剪影，放在 android/app/src/main/res/drawable/ */
      smallIcon: 'ic_stat_daymark',
      iconColor: '#8B7BFF',
    },
  },
}

export default config
