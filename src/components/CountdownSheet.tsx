import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Sheet } from './Sheet'
import { Swatches } from './Swatches'
import {
  REPEAT_OPTIONS,
  dateInputValue,
  daysUntil,
  formatDate,
  nextOccurrence,
  parseDateInput,
  todayStart,
} from '../lib/days'
import type { CountdownDraft, CountdownEvent, Repeat } from '../lib/types'

type Props = {
  mode: 'add' | 'edit'
  event?: CountdownEvent
  suggestedColor: number
  onClose: () => void
  onSubmit: (draft: CountdownDraft) => void
  onDelete?: () => void
}

export function CountdownSheet({ mode, event, suggestedColor, onClose, onSubmit, onDelete }: Props) {
  const now = Date.now()
  const today = todayStart(now)
  const [title, setTitle] = useState(event?.title ?? '')
  const [dateValue, setDateValue] = useState(() =>
    dateInputValue(event ? event.startedAt : today),
  )
  const [repeat, setRepeat] = useState<Repeat>(event?.repeat ?? 'none')
  const [color, setColor] = useState(event ? event.color : suggestedColor)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true })
    }, 240)
    return () => window.clearTimeout(timer)
  }, [])

  const startedAt = parseDateInput(dateValue, today)
  // 日期已经过去时，必须有重复周期才能算出「下一个时间点」
  const mustRepeat = daysUntil(startedAt, now) < 0
  const next = nextOccurrence(startedAt, repeat, now)
  const remaining = daysUntil(next, now)
  const trimmed = title.trim()
  const canSubmit = trimmed.length > 0 && (!mustRepeat || repeat !== 'none')

  const hint = (() => {
    if (mustRepeat && repeat === 'none') return '这个日期已经过去，需要选一个重复周期才能算出下一个时间点'
    if (repeat === 'none') {
      return remaining === 0 ? '就是今天' : `${formatDate(next)} · 还有 ${remaining} 天`
    }
    return `下一个时间点 ${formatDate(next)} · 还有 ${remaining} 天`
  })()

  return (
    <Sheet label={mode === 'add' ? '记录一个倒数日' : '编辑这个倒数日'} onClose={onClose}>
      <h2 className="sheet__title">{mode === 'add' ? '记录一个倒数日' : '编辑这个倒数日'}</h2>
      <p className="sheet__sub">填一个未来的日子，它会告诉你还有多少天；每周的例会、生日纪念日这类会定期回来的日子，选上重复周期就行。</p>

      <form
        className="form"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault()
          if (!canSubmit) return
          onSubmit({ title: trimmed, startedAt, color, repeat })
        }}
      >
        <label className="field">
          <span className="field__label">事件名称</span>
          <input
            ref={inputRef}
            className="input"
            value={title}
            onChange={(changeEvent) => setTitle(changeEvent.target.value)}
            placeholder="比如：妈妈生日"
            maxLength={24}
            autoComplete="off"
            enterKeyHint="done"
          />
        </label>

        <label className="field">
          <span className="field__label">日期</span>
          <input
            className="date-input"
            type="date"
            value={dateValue}
            onChange={(changeEvent) => setDateValue(changeEvent.target.value)}
          />
          <span className="field__hint">{hint}</span>
        </label>

        <div className="field">
          <span className="field__label">重复周期</span>
          <div
            className="segmented"
            role="radiogroup"
            aria-label="重复周期"
            style={{ '--segment-count': REPEAT_OPTIONS.length } as CSSProperties}
          >
            {REPEAT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={repeat === option.value}
                className="segmented__item"
                data-selected={repeat === option.value}
                disabled={mustRepeat && option.value === 'none'}
                onClick={() => setRepeat(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">标记颜色</span>
          <Swatches value={color} onChange={setColor} />
        </div>

        <div className="form__actions">
          <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
            {mode === 'add' ? '开始倒数' : '保存修改'}
          </button>
          {mode === 'edit' && onDelete ? (
            <button type="button" className="btn btn--danger" onClick={onDelete}>
              删除这个倒数日
            </button>
          ) : null}
        </div>

        <p className="form__note">数据只保存在这台设备的浏览器里，不会上传到任何服务器。</p>
      </form>
    </Sheet>
  )
}
