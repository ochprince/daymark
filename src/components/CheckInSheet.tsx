import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Sheet } from './Sheet'
import { Swatches } from './Swatches'
import { CADENCE_OPTIONS } from '../lib/checkins'
import type { CheckInCadence, CheckInDraft, CheckInEvent } from '../lib/types'

type Props = {
  mode: 'add' | 'edit'
  event?: CheckInEvent
  suggestedColor: number
  onClose: () => void
  onSubmit: (draft: CheckInDraft) => void
  onDelete?: () => void
}

/** 每种周期的说明：什么时候归零、历史里会留下什么 */
const CADENCE_HINT: Record<CheckInCadence, string> = {
  daily: '每天 0 点重新数，昨天的次数会存进历史',
  weekly: '每周一重新数，上一周的次数会存进历史',
  monthly: '每月 1 号重新数，上个月的次数会存进历史',
}

export function CheckInSheet({ mode, event, suggestedColor, onClose, onSubmit, onDelete }: Props) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [cadence, setCadence] = useState<CheckInCadence>(event?.cadence ?? 'daily')
  const [color, setColor] = useState(event ? event.color : suggestedColor)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true })
    }, 240)
    return () => window.clearTimeout(timer)
  }, [])

  const trimmed = title.trim()
  const canSubmit = trimmed.length > 0

  return (
    <Sheet label={mode === 'add' ? '记一件要打卡的事' : '编辑这件事'} onClose={onClose}>
      <h2 className="sheet__title">{mode === 'add' ? '记一件要打卡的事' : '编辑这件事'}</h2>
      <p className="sheet__sub">想多做几次的事写在这里，做一次按住两秒记一下，它会替你数着。</p>

      <form
        className="form"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault()
          if (!canSubmit) return
          onSubmit({ title: trimmed, color, cadence })
        }}
      >
        <label className="field">
          <span className="field__label">事件名称</span>
          <input
            ref={inputRef}
            className="input"
            value={title}
            onChange={(changeEvent) => setTitle(changeEvent.target.value)}
            placeholder="比如：喝水"
            maxLength={24}
            autoComplete="off"
            enterKeyHint="done"
          />
        </label>

        <div className="field">
          <span className="field__label">打卡周期</span>
          <div
            className="segmented"
            role="radiogroup"
            aria-label="打卡周期"
            style={{ '--segment-count': CADENCE_OPTIONS.length } as CSSProperties}
          >
            {CADENCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={cadence === option.value}
                className="segmented__item"
                data-selected={cadence === option.value}
                onClick={() => setCadence(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="field__hint">{CADENCE_HINT[cadence]}</span>
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
              删除这件事
            </button>
          ) : null}
        </div>

        <p className="form__note">数据只保存在这台设备的浏览器里，不会上传到任何服务器。</p>
      </form>
    </Sheet>
  )
}
