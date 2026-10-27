import { getPrefs, reduceMotionOn } from './prefs'

/**
 * 减弱动效是否生效：用户手动打开，或系统开着。
 *
 * 这一层以前不存在——`reduceMotionOn()` 导出了却没人调，
 * CSS 又挂在早已改名的 `.phone` 上，等于开关和系统设置都没用。
 */
export function prefersReducedMotion(): boolean {
  return reduceMotionOn()
}

/** 给根节点加/去 reduce-motion 类，CSS 那一侧靠它生效 */
export function applyReduceMotion(): boolean {
  const on = reduceMotionOn(getPrefs())
  document.documentElement.classList.toggle('reduce-motion', on)
  return on
}
