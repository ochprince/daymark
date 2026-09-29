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
}

export type EventDraft = {
  title: string
  startedAt: number
  color: number
}
