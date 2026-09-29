import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useDragControls } from 'motion/react'
import type { CSSProperties } from 'react'
import { PALETTE } from '../lib/palette'
import { dateInputValue, daysSince, formatDate, parseDateInput, todayStart } from '../lib/days'
import { useVisualViewport } from '../lib/useVisualViewport'
import type { DayEvent, EventDraft } from '../lib/types'
import { CheckIcon, CloseIcon } from './icons'

type DragInfo = {
  offset: { x: number; y: number }
  velocity: { x: number; y: number }
}

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
  const [dateValue, setDateValue] = useState(() =>
    dateInputValue(event ? event.startedAt : today),
  )
  const [color, setColor] = useState(event ? event.color : suggestedColor)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragControls = useDragControls()
  const viewport = useVisualViewport(true)

  useEffect(() => {
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true })
    }, 240)
    return () => window.clearTimeout(timer)
  }, [])

  const startedAt = parseDateInput(dateValue, today)
  const preview = daysSince(startedAt, Date.now())
  const trimmed = title.trim()
  const canSubmit = trimmed.length > 0

  // 软键盘弹出时，fixed 的弹层要跟着可视区域走，否则会被键盘盖住
  const keyboardOpen = viewport !== null && window.innerHeight - viewport.height > 80
  const overlayStyle: CSSProperties | undefined = keyboardOpen
    ? { top: viewport.offsetTop, bottom: 'auto', height: viewport.height }
    : undefined

  return (
    <motion.div
      className="sheet-overlay"
      style={overlayStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClose}
    >
      <motion.div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'add' ? '记录一个日子' : '编辑这个日子'}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 34 }}
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_event, info: DragInfo) => {
          if (info.offset.y > 110 || info.velocity.y > 700) onClose()
        }}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <div className="sheet__head">
          <div
            className="sheet__grab"
            role="presentation"
            onPointerDown={(pointerEvent) => dragControls.start(pointerEvent)}
          />
          <div className="sheet__handle" />
          <button type="button" className="sheet__close" aria-label="关闭" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <h2 className="sheet__title">{mode === 'add' ? '记录一个日子' : '编辑这个日子'}</h2>
        <p className="sheet__sub">
          时间从起始日开始累计，按自然日计算，跨过午夜自动 +1 天。
        </p>

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
              {preview > 0
                ? `${formatDate(startedAt)} 起算 · 已经过去 ${preview} 天`
                : `今天（${formatDate(startedAt)}）起算 · 天数从 0 开始`}
            </span>
          </label>

          <div className="field">
            <span className="field__label">标记颜色</span>
            <div className="swatches">
              {PALETTE.map((accent, index) => (
                <button
                  key={accent.id}
                  type="button"
                  className="swatch"
                  data-selected={index === color}
                  aria-label={accent.name}
                  aria-pressed={index === color}
                  style={
                    {
                      '--swatch-from': accent.from,
                      '--swatch-to': accent.to,
                    } as CSSProperties
                  }
                  onClick={() => setColor(index)}
                >
                  <span className="swatch__dot">
                    {index === color ? (
                      <span className="swatch__check">
                        <CheckIcon />
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
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
      </motion.div>
    </motion.div>
  )
}
