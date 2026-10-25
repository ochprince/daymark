/**
 * 设备本地偏好：音效、震动、减弱动效。
 * 和皮肤分开存——皮肤是「长什么样」，这里是「怎么响、怎么抖」。
 */
import { createJsonStore } from './jsonStore'

export type PrefsState = {
  sound: boolean
  haptic: boolean
  /** 跟随系统「减弱动态效果」，用户也可以手动打开 */
  reduceMotion: boolean
}

export const PREFS_STORAGE_KEY = 'daymark.prefs.v1'

export const DEFAULT_PREFS: PrefsState = {
  sound: true,
  haptic: true,
  reduceMotion: false,
}

export function normalizePrefs(input: unknown): PrefsState {
  if (typeof input !== 'object' || input === null) return { ...DEFAULT_PREFS }
  const value = input as Partial<PrefsState>
  return {
    sound: typeof value.sound === 'boolean' ? value.sound : DEFAULT_PREFS.sound,
    haptic: typeof value.haptic === 'boolean' ? value.haptic : DEFAULT_PREFS.haptic,
    reduceMotion:
      typeof value.reduceMotion === 'boolean' ? value.reduceMotion : DEFAULT_PREFS.reduceMotion,
  }
}

export const prefsStore = createJsonStore<PrefsState>({
  key: PREFS_STORAGE_KEY,
  normalize: normalizePrefs,
})

export const subscribe = prefsStore.subscribe

export function getPrefs(): PrefsState {
  return prefsStore.get()
}

export function setPrefs(patch: Partial<PrefsState>): void {
  prefsStore.patch(patch)
}

export function reloadPrefs(): void {
  prefsStore.reload()
}

/** 系统是否开了减弱动效 */
export function systemReduceMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 实际生效的减弱动效：用户手动打开，或系统开着 */
export function reduceMotionOn(prefs: PrefsState = getPrefs()): boolean {
  return prefs.reduceMotion || systemReduceMotion()
}
