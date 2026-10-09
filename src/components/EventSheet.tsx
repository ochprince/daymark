import { useEffect, useMemo, useRef, useState } from 'react'
import { Sheet } from './Sheet'
import { Swatches } from './Swatches'
import { SwipeCard } from './SwipeCard'
import { ChevronLeftIcon } from './icons'
import { dateInputValue, daysSince, formatDate, parseDateInput, todayStart } from '../lib/days'
import { closeStreak, sortStreaks, summarizeStreaks } from '../lib/streaks'
import type { DayEvent, EventDraft } from '../lib/types'

type Props = {
  mode: 'add' | 'edit'
  event?: DayEvent
  suggestedColor: number
  onClose: () => void
  onSubmit: (draft: EventDraft) => void
  onDelete?: () => void
  /** 左滑删掉一轮历史（按下标，重复条目也能精确删一条），可撤销 */
  onDeleteStreak?: (index: number) => void
}

export function EventSheet({
  mode,
  event,
  suggestedColor,
  onClose,
  onSubmit,
  onDelete,
  onDeleteStreak,
}: Props) {
  const today = useMemo(() => todayStart(Date.now()), [])
  const [title, setTitle] = useState(event?.title ?? '')
  const [dateValue, setDateValue] = useState(() => dateInputValue(event ? event.startedAt : today))
  const [color, setColor] = useState(event ? event.color : suggestedColor)
  // 弹层里两种视图：编辑表单 / 历史列表（带返回）
  const [view, setView] = useState<'edit' | 'history'>('edit')
  /** 历史列表里左滑露出来的那一条 */
  const [revealedStreak, setRevealedStreak] = useState<string | null>(null)
  /** 编辑视图量下来的内容高度：历史视图撑到同高，来回切换不会忽高忽低 */
  const contentRef = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (view !== 'edit') return
    const timer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true })
    }, 240)
    return () => window.clearTimeout(timer)
  }, [view])

  useEffect(() => {
    if (view !== 'edit') return
    const element = contentRef.current
    if (!element) return
    const height = element.getBoundingClientRect().height
    if (height > 0) setMeasured((prev) => (prev !== null && Math.abs(prev - height) < 1 ? prev : height))
  }, [view])

  const startedAt = parseDateInput(dateValue, today)
  const days = daysSince(startedAt, Date.now())
  const trimmed = title.trim()
  const canSubmit = trimmed.length > 0

  const history = useMemo(() => sortStreaks(event?.history ?? []), [event])
  const summary = useMemo(() => summarizeStreaks(history), [history])

  // 起始日被改到今天 = 清零：保存时把之前那一轮坚持封存进历史
  const archived =
    mode === 'edit' && event && days === 0 && startedAt !== event.startedAt
      ? closeStreak(event.startedAt, Date.now())
      : null

  return (
    <Sheet
      label={view === 'history' ? '历史' : mode === 'add' ? '记录一个日子' : '编辑这个日子'}
      onClose={onClose}
    >
      <div
        className={view === 'history' ? 'sheet__body sheet__body--fill' : 'sheet__body'}
        ref={contentRef}
        style={view === 'history' && measured ? { minHeight: measured } : undefined}
      >
      {view === 'history' ? (
        <>
          <div className="sheet__nav">
            <button type="button" className="btn btn--back" onClick={() => setView('edit')}>
              <ChevronLeftIcon className="icon-16" />
              返回
            </button>
            <h2 className="sheet__title">历史</h2>
          </div>
          <p className="sheet__sub">
            {summary.count > 1
              ? `共 ${summary.count} 轮 · 最长 ${summary.longest} 天 · 合计 ${summary.total} 天`
              : '每一轮是坚持到被重置那天的天数。'}
          </p>
          <div className="history">
            {history.map((streak, index) => {
              // key 只按内容生成会和「同一天结束、天数相同」的重复条目撞车，
              // 撞车时 React 会把两条当成同一个元素（滑开一条两条一起动），所以要带序号
              const rowId = `streak-${index}`
              return (
                <SwipeCard
                  key={rowId}
                  id={rowId}
                  className="history__row"
                  ariaLabel={`${streak.days} 天，${formatDate(streak.endedAt)} 结束`}
                  colorIndex={event?.color ?? 0}
                  revealed={revealedStreak === rowId}
                  onReveal={setRevealedStreak}
                  onDelete={() => {
                    setRevealedStreak(null)
                    onDeleteStreak?.(index)
                  }}
                >
                  <span className="history__days">
                    {streak.days}
                    <span className="history__unit">天</span>
                  </span>
                  <span className="history__date">{formatDate(streak.endedAt)} 结束</span>
                </SwipeCard>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <h2 className="sheet__title">{mode === 'add' ? '记录一个日子' : '编辑这个日子'}</h2>
          <p className="sheet__sub">时间从起始日开始累计，按自然日计算，跨过午夜自动 +1 天。</p>

          <form
            className="form"
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault()
              if (!canSubmit) return
              onSubmit({
                title: trimmed,
                startedAt,
                color,
                ...(archived
                  ? { history: [archived, ...history] }
                  : event?.history
                    ? { history }
                    : {}),
              })
            }}
          >
            <div className="field">
              <div className="field__head">
                <label className="field__label" htmlFor="event-title">
                  事件名称
                </label>
              </div>
              <div className="field__row">
                <input
                  id="event-title"
                  ref={inputRef}
                  className="input"
                  value={title}
                  onChange={(changeEvent) => setTitle(changeEvent.target.value)}
                  placeholder="比如：开始跑步"
                  maxLength={24}
                  autoComplete="off"
                  enterKeyHint="done"
                />
                {mode === 'edit' ? (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={days === 0}
                    aria-label="把起始日期改回今天，保存后之前的天数计入历史"
                    onClick={() => setDateValue(dateInputValue(today))}
                  >
                    重置
                  </button>
                ) : null}
              </div>
            </div>

            <div className="field">
              <div className="field__head">
                <label className="field__label" htmlFor="event-start">
                  起始日期
                </label>
                {mode === 'edit' && history.length > 0 ? (
                  <button
                    type="button"
                    className="field__chip"
                    onClick={() => {
                      setRevealedStreak(null)
                      setView('history')
                    }}
                  >
                    <span className="field__chip-dot" />
                    历史 · {history.length} 轮
                  </button>
                ) : null}
              </div>
              <input
                id="event-start"
                className="date-input"
                type="date"
                value={dateValue}
                max={dateInputValue(today)}
                onChange={(changeEvent) => setDateValue(changeEvent.target.value)}
              />
              <span className="field__hint">
                {days > 0
                  ? `${formatDate(startedAt)} 起算 · 已经过去 ${days} 天`
                  : `今天（${formatDate(startedAt)}）起算 · 天数从 0 开始`}
              </span>
            </div>

            <div className="field">
              <span className="field__label">标记颜色</span>
              <Swatches value={color} onChange={setColor} />
            </div>

            <div className="form__actions">
              <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
                {mode === 'add' ? '开始记录' : '保存修改'}
              </button>
              {mode === 'edit' && onDelete ? (
                <button type="button" className="btn btn--danger" onClick={onDelete}>
                  删除这个日子
                </button>
              ) : null}
            </div>

            <p className="form__note">数据只保存在这台设备的浏览器里，不会上传到任何服务器。</p>
          </form>
        </>
      )}
      </div>
    </Sheet>
  )
}
