/** 小伙伴物种：每件事对应一只，倒数日用「信信」post */
export type Species = 'sprout' | 'moon' | 'drop' | 'star' | 'post'

/** 形态：0 壳宝宝 · 1（3 天）· 2（7 天）· 3（30 天）· 4（100 天） */
export type Stage = 0 | 1 | 2 | 3 | 4

export type DayEvent = {
  /** 稳定 id，用于 React key / 编辑 / 撤销 */
  id: string
  /** 事件名称 */
  title: string
  /** 起始时刻（毫秒时间戳），天数从这一天的 00:00 起算 */
  startedAt: number
  /**
   * 这一轮从哪一刻开始数 24 小时。
   * 重置（把起始日改成今天）时写入按下的那一刻，于是「满 24 小时才 +1」；
   * 手动挑的历史起始日没有这个值，就退回那一天的 00:00，跟原来一致。
   */
  anchorAt?: number
  /** 记录创建时刻，用于同一天创建时的排序 */
  createdAt: number
  /** 调色板索引 */
  color: number
  /** 重置过的历史：每段从起始日坚持到被重置那天为止，最新的排最前 */
  history?: Chapter[]
  /** 养成角色物种；老数据缺省按芽芽处理 */
  species?: Species
  /** 相片背景（IndexedDB 里的图片 id） */
  photoId?: string
}

/** 一段坚持记录：坚持了 days 天，在 endedAt 那天（本地 00:00）被重置 */
export type Streak = {
  /** 封存时卡片上的天数 */
  days: number
  /** 完成时间 —— 被重置的那一天 */
  endedAt: number
}

/** 一章：兼容老 Streak（只有 days / endedAt 的记录照常可读） */
export type Chapter = Streak & {
  /** 结束时留的一句话 */
  line?: string
  /** 结束时的形态（书页拍立得用） */
  stage?: Stage
  /** 本章起点；老数据没有，展示时用 endedAt - days 推算 */
  startedAt?: number
}

export type EventDraft = {
  title: string
  startedAt: number
  /** 重置那一刻的计时锚点；挑历史起始日时不给，退回那天的 00:00 */
  anchorAt?: number
  color: number
  history?: Chapter[]
  species?: Species
  photoId?: string | null
}

/** 重复周期：倒数日里，日期已经过去时必须选一种 */
export type Repeat = 'none' | 'weekly' | 'monthly' | 'yearly'

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
  /** 提醒规则 */
  remind?: Reminder
  /** 一句备忘 */
  memo?: string
  /** 待办清单 */
  todo?: TodoItem[]
  /** 已经「说过了」的那几次发生（发生日 00:00 的时间戳） */
  ackedFor?: number[]
  /** 说过了的历史：发生日期 + 留的一句话 */
  history?: { at: number; line?: string }[]
  /** 相片背景 */
  photoId?: string
}

export type TodoItem = { text: string; done: boolean }

export type CountdownDraft = {
  title: string
  startedAt: number
  color: number
  repeat: Repeat
  festivalId?: string
  remind?: Reminder
  memo?: string
  todo?: TodoItem[]
  photoId?: string | null
}

/** 打卡周期：决定计数什么时候归零、历史按什么粒度分桶 */
export type CheckInCadence = 'daily' | 'weekly' | 'monthly'

export type CheckInEvent = {
  id: string
  /** 事件名称，比如「喝水」 */
  title: string
  createdAt: number
  color: number
  cadence: CheckInCadence
  /** 每天的打卡次数：键是本地日期 yyyy-mm-dd，值是当天点了几下 */
  days: Record<string, number>
  /**
   * 每次打卡的时刻（毫秒）：键同样是 yyyy-mm-dd，值是按先后排好的时刻数组。
   * 老数据没有这一项，读的时候当空数组处理。
   */
  times?: Record<string, number[]>
  /** 养成角色物种 */
  species?: Species
  /** 每个周期的目标次数；空 = 不设上限 */
  target?: number | null
  /**
   * 累计有记录的天数（同一天记多次只算 1）。
   * days 只保留最近 240 个周期，长期用户按天推算会丢数，所以单独计数。
   */
  growthDays?: number
  /** 当前这一章的起点；空 = createdAt */
  chapterStartedAt?: number
  /** 已经结束的章节 */
  chapters?: Chapter[]
  /** 提醒规则 */
  remind?: Reminder
  /** 相片背景 */
  photoId?: string
}

export type CheckInDraft = {
  title: string
  color: number
  cadence: CheckInCadence
  species?: Species
  target?: number | null
  remind?: Reminder
  photoId?: string | null
}

export type Reminder =
  | { kind: 'none' }
  | { kind: 'daily'; time: string }
  | { kind: 'weekly'; weekdays: number[]; time: string }
  | { kind: 'before'; daysBefore: number; time: string }

export const NO_REMINDER: Reminder = { kind: 'none' }

/** 三类事的 kind，ItemView 的 key 前缀 */
export type ItemKind = 'since' | 'habit' | 'countdown'
