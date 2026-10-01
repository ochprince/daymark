import { motion, useReducedMotion } from 'motion/react'
import { FestivalIcon, PencilIcon } from './icons'

type Props = {
  onPick: (choice: 'festival' | 'custom') => void
  onClose: () => void
}

/**
 * 新增入口的浮动选项框：贴在右下角「+」按钮上方，从按钮那一角长出来。
 * 现在只有倒数日页用得上（走过的日子页只有「自定义」一种）。
 */
export function AddMenu({ onPick, onClose }: Props) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className="menu-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClose}
    >
      <div className="menu-shell">
        <motion.div
          className="menu"
          role="menu"
          aria-label="新增"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 6 }}
          transition={{ type: 'spring', stiffness: 460, damping: 32 }}
          onClick={(clickEvent) => clickEvent.stopPropagation()}
        >
          <button type="button" role="menuitem" className="menu__item" onClick={() => onPick('festival')}>
            <span className="menu__icon menu__icon--festival" aria-hidden="true">
              <FestivalIcon />
            </span>
            <span className="menu__text">
              <span className="menu__title">节日</span>
              <span className="menu__sub">法定节假日、中西方传统节日</span>
            </span>
          </button>
          <button type="button" role="menuitem" className="menu__item" onClick={() => onPick('custom')}>
            <span className="menu__icon" aria-hidden="true">
              <PencilIcon />
            </span>
            <span className="menu__text">
              <span className="menu__title">自定义</span>
              <span className="menu__sub">写下自己的日子</span>
            </span>
          </button>
        </motion.div>
      </div>
    </motion.div>
  )
}
