import type { MutableRefObject, PointerEventHandler } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

type Props = {
  direction: 'next' | 'prev'
  /** 按钮上的文字，指向目标页 */
  label: string
  onActivate: () => void
  /** 刚刚发生过拖动时，抑制浏览器补发的这次 click */
  draggedRef: MutableRefObject<boolean>
  handleProps: {
    onPointerDown: PointerEventHandler<HTMLElement>
    onPointerMove: PointerEventHandler<HTMLElement>
    onPointerUp: PointerEventHandler<HTMLElement>
    onPointerCancel: PointerEventHandler<HTMLElement>
  }
}

/** 翻页手柄：可点，也可以从这里往左右滑（手势区其实覆盖整个上部区域） */
export function PagerHandle({ direction, label, onActivate, draggedRef, handleProps }: Props) {
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
      {...handleProps}
    >
      {direction === 'prev' ? <ChevronLeftIcon className="pager-handle__chevron" /> : null}
      <span className="pager-handle__label">{label}</span>
      {direction === 'next' ? <ChevronRightIcon className="pager-handle__chevron" /> : null}
    </button>
  )
}
