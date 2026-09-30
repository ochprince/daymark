import { useEffect } from 'react'
import { motion, useDragControls } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'
import { useVisualViewport } from '../lib/useVisualViewport'
import { CloseIcon } from './icons'

type DragInfo = {
  offset: { x: number; y: number }
  velocity: { x: number; y: number }
}

type Props = {
  /** 无障碍名称，也是弹层的标题语义 */
  label: string
  onClose: () => void
  children: ReactNode
  /** 额外修饰类名（例如节日弹层的固定头部 + 内部滚动） */
  className?: string
}

/** 底部弹层外壳：遮罩、下拉关闭、Esc、软键盘跟随。表单内容由调用方传入。 */
export function Sheet({ label, onClose, children, className }: Props) {
  const dragControls = useDragControls()
  const viewport = useVisualViewport(true)

  useEffect(() => {
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

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
        className={className ? `sheet ${className}` : 'sheet'}
        role="dialog"
        aria-modal="true"
        aria-label={label}
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
        {children}
      </motion.div>
    </motion.div>
  )
}
