import { motion, useReducedMotion } from 'motion/react'
import { MarkIcon } from './icons'

type Props = {
  onAdd: () => void
}

export function EmptyState({ onAdd }: Props) {
  const reduced = useReducedMotion()

  return (
    <motion.section
      className="empty"
      initial={reduced ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30, delay: 0.06 }}
    >
      <MarkIcon className="empty__mark" />
      <h2 className="empty__title">还没有任何刻度</h2>
      <p className="empty__text">
        记录一件想坚持的事，或者一个值得记住的日子。
        <br />
        从添加的这一刻起，它会自己一天天长起来。
      </p>
      <div className="empty__cta">
        <button type="button" className="btn btn--primary btn--inline" onClick={onAdd}>
          记录第一个日子
        </button>
      </div>
    </motion.section>
  )
}
