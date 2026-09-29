import type { MutableRefObject } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

type Props = {
  direction: 'next' | 'prev'
  /** 按钮上的文字，指向目标页 */
  label: string
  onActivate: () => void
  /** 刚刚发生过拖动时，抑制浏览器补发的这次 click */
  draggedRef: MutableRefObject<boolean>
}

/**
 * 翻页手柄：点一下翻到另一页。
 * 左滑右滑的手势挂在整个页面上（见 usePager），这里只是一个入口提示。
 */
export function PagerHandle({ direction, label, onActivate, draggedRef }: Props) {
  return (
    <button
      type="button"
      className="pager-handle"
      data-direction={direction}
      aria-label={`翻到${label}`}
      onClick={() => {
        if (draggedRef.current) return
        onActivate()
      }}
    >
      {direction === 'prev' ? <ChevronLeftIcon className="pager-handle__chevron" /> : null}
      <span className="pager-handle__label">{label}</span>
      {direction === 'next' ? <ChevronRightIcon className="pager-handle__chevron" /> : null}
    </button>
  )
}
