import type { MutableRefObject, PointerEventHandler } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

type Props = {
  direction: 'next' | 'prev'
  /** 按钮上的文字，指向目标页 */
  label: string
  onActivate: () => void
  draggedRef: MutableRefObject<boolean>
  handleProps: {
    onPointerDown: PointerEventHandler<HTMLElement>
    onPointerMove: PointerEventHandler<HTMLElement>
    onPointerUp: PointerEventHandler<HTMLElement>
    onPointerCancel: PointerEventHandler<HTMLElement>
  }
}

/**
 * 翻页手柄：既是「点一下翻页」的按钮，也是「从右往左滑」的手势起点。
 * 手势只在这个元素上生效，卡片上的滑动仍然只用来删除。
 */
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
