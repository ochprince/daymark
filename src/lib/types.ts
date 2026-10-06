export type DayEvent = {
  /** 稳定 id，用于 React key / 编辑 / 撤销 */
  id: string
  /** 事件名称 */
  title: string
  /** 起始时刻（毫秒时间戳），天数从这一天的 00:00 起算 */
  startedAt: number
  /** 记录创建时刻，用于同一天创建时的排序 */
  createdAt: number
  /** 调色板索引 */
  color: number
  /** 重置过的历史：每段从起始日坚持到被重置那天为止，最新的排最前 */
  history?: Streak[]
}

/** 一段坚持记录：坚持了 days 天，在 endedAt 那天（本地 00:00）被重置 */
export type Streak = {
  /** 封存时卡片上的天数 */
  days: number
  /** 完成时间 —— 被重置的那一天 */
  endedAt: number
}

export type EventDraft = {
  title: string
  startedAt: number
  color: number
  history?: Streak[]
}

/** 重复周期：倒数日里，日期已经过去时必须选一种 */
export type Repeat = 'none' | 'monthly' | 'yearly'

export type CountdownEvent = {
  id: string
  title: string
  /** 首次发生的时刻（毫秒时间戳） */
  startedAt: number
  createdAt: number
  color: number
  repeat: Repeat
  /**
   * 来自「节日」列表时记下节日 id：农历节日、复活节、母亲节这类
   * 每年日期都在变的节日，下一次发生要按节日规则算，而不是按填写的月日。
   */
  festivalId?: string
}

export type CountdownDraft = {
  title: string
  startedAt: number
  color: number
  repeat: Repeat
  festivalId?: string
}
