/**
 * 小伙伴说的话（气泡）。口径见 docs/plan-v2.md 第 11 节：
 * 具体、非功能性、不催促；工具信息（日期、次数）放副行，不卖萌。
 */
import { t } from './i18n'
import type { ItemView } from './itemview'

export type LineContext = {
  /** 刚记完一次 */
  justLogged?: boolean
  /** 刚把它叫醒 */
  justWoke?: boolean
  /** 刚被摸了一下：1–3 轮流 */
  pokeIndex?: number
}

export function bubbleLine(view: ItemView, ctx: LineContext = {}): string {
  if (ctx.justWoke) return t('line.habit.wake')
  if (ctx.pokeIndex !== undefined) {
    const pick = ctx.pokeIndex % 3
    return pick === 1 ? t('line.poke.2') : pick === 2 ? t('line.poke.3') : t('line.poke.1')
  }

  if (view.kind === 'since') {
    const d = view.days
    if (d >= 365) return t('line.since.year')
    if (d >= 100) return t('line.since.long', { n: d })
    if (d >= 30) return t('line.since.month')
    if (d >= 7) return t('line.since.week')
    if (d >= 1) return t('line.since.early')
    return t('line.since.start')
  }

  if (view.kind === 'countdown') {
    const d = view.days
    if (d === 0) return t('line.countdown.today')
    if (d <= 3) return t('line.countdown.soon', { n: d })
    if (d <= 7) return t('line.countdown.week')
    if (d > 7) return t('line.countdown.far', { n: d })
    return t('stage.countdown.past', { n: Math.abs(d) })
  }

  // 习惯
  if (view.mood === 'sleep') return t('line.habit.sleep')
  if (ctx.justLogged) return t('line.habit.done')
  if (view.count > 0) return t('line.habit.count', { n: view.count })
  if (view.cadence === 'weekly' || view.cadence === 'monthly') return t('line.habit.weekly')
  return t('line.habit.idle')
}

/** 记录之后的一句话（多次型会说出第几次） */
export function lineAfterLog(view: ItemView): string {
  return bubbleLine(view, { justLogged: true })
}
