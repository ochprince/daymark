import type { MutableRefObject } from 'react'
import { ChevronRightIcon } from './icons'

type Props = {
  /** 目标页名称，也用于无障碍标签 */
  label: string
  onActivate: () => void
  /** 刚刚发生过拖动时，抑制浏览器补发的这次 click */
  draggedRef: MutableRefObject<boolean>
}

/**
 * 翻页手柄：点一下翻到另一页。
 * 两页是循环的、始终朝同一个方向推进，所以箭头统一指向右。
 * 左滑右滑的手势挂在整个页面上（见 usePager），这里只是入口提示。
 */
export function PagerHandle({ label, onActivate, draggedRef }: Props) {
  return (
    <button
      type="button"
      className="pager-handle"
      aria-label={`翻到${label}`}
      onClick={() => {
        if (draggedRef.current) return
        onActivate()
      }}
    >
      <span className="pager-handle__label">{label}</span>
      <ChevronRightIcon className="pager-handle__chevron" />
    </button>
  )
}
