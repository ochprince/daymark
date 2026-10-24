/**
 * v2 界面唯一的数据入口：订阅三类事 + 收藏 + 焦点，算出统一的 ItemView。
 * 页面组件只读这里，不再各自判断「这是第几页」。
 */
import { useMemo, useSyncExternalStore } from 'react'
import { buildItemViews, viewByKey, type ItemView } from '../lib/itemview'
import { getCollection, subscribe as subscribeCollection } from '../lib/collection'
import { getFocusKey, subscribeFocus } from '../lib/focus'
import { getCheckIns, subscribe as subscribeCheckIns } from '../lib/checkins'
import { getCountdowns, subscribe as subscribeCountdowns } from '../lib/countdowns'
import { getEvents, subscribe as subscribeEvents } from '../lib/storage'

export type V2Data = {
  views: ItemView[]
  /** 当前焦点；没有数据时为 null */
  focus: ItemView | null
  focusKey: string
}

export function useV2Data(now: number): V2Data {
  const events = useSyncExternalStore(subscribeEvents, getEvents)
  const countdowns = useSyncExternalStore(subscribeCountdowns, getCountdowns)
  const checkins = useSyncExternalStore(subscribeCheckIns, getCheckIns)
  const collection = useSyncExternalStore(subscribeCollection, getCollection)
  const savedFocus = useSyncExternalStore(subscribeFocus, getFocusKey)

  const views = useMemo(
    () => buildItemViews({ events, countdowns, checkins }, now, { peakStage: collection.peakStage }),
    [events, countdowns, checkins, now, collection.peakStage],
  )

  // 焦点被删掉时先退到第一件，再由页面把新的 key 写回存储
  const focus = viewByKey(views, savedFocus) ?? views[0] ?? null
  return { views, focus, focusKey: savedFocus }
}
