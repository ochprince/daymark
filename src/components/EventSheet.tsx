import { useEffect, useMemo, useRef, useState } from 'react'
import { Sheet } from './Sheet'
import { Swatches } from './Swatches'
import { dateInputValue, daysSince, formatDate, parseDateInput, todayStart } from '../lib/days'
import type { DayEvent, EventDraft } from '../lib/types'

type Props = {
  mode: 'add' | 'edit'
  event?: DayEvent
  suggestedColor: number
  onClose: () => void
  onSubmit: (draft: EventDraft) => void
  onDelete?: () => void
}

export function EventSheet({ mode, event, suggestedColor, onClose, onSubmit, onDelete }: Props) {
  const today = useMemo(() => todayStart(Date.now()), [])
  const [title, setTitle] = useState(event?.title ?? '')
  const [dateValue, setDateValue] = useState(() => dateInputValue(event ? event.startedAt : today))
  const [color, setColor] = useState(event ? event.color : suggestedColor)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true })
    }, 240)
    return () => window.clearTimeout(timer)
  }, [])

  const startedAt = parseDateInput(dateValue, today)
  const days = daysSince(startedAt, Date.now())
  const trimmed = title.trim()
  const canSubmit = trimmed.length > 0

  return (
    <Sheet label={mode === 'add' ? '记录一个日子' : '编辑这个日子'} onClose={onClose}>
      <h2 className="sheet__title">{mode === 'add' ? '记录一个日子' : '编辑这个日子'}</h2>
      <p className="sheet__sub">时间从起始日开始累计，按自然日计算，跨过午夜自动 +1 天。</p>

      <form
        className="form"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault()
          if (!canSubmit) return
          onSubmit({ title: trimmed, startedAt, color })
        }}
      >
        <label className="field">
          <span className="field__label">事件名称</span>
          <input
            ref={inputRef}
            className="input"
            value={title}
            onChange={(changeEvent) => setTitle(changeEvent.target.value)}
            placeholder="比如：开始跑步"
            maxLength={24}
            autoComplete="off"
            enterKeyHint="done"
          />
        </label>

        <label className="field">
          <span className="field__label">起始日期</span>
          <input
            className="date-input"
            type="date"
            value={dateValue}
            max={dateInputValue(today)}
            onChange={(changeEvent) => setDateValue(changeEvent.target.value)}
          />
          <span className="field__hint">
            {days > 0 ? `${formatDate(startedAt)} 起算 · 已经过去 ${days} 天` : `今天（${formatDate(startedAt)}）起算 · 天数从 0 开始`}
          </span>
        </label>

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
    </Sheet>
  )
}
