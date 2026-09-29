import { motion, useReducedMotion } from 'motion/react'
import { MarkIcon } from './icons'

type Props = {
  title: string
  /** 两行正文，用 \n 分隔 */
  text: string
  cta: string
  onAdd: () => void
}

export function EmptyState({ title, text, cta, onAdd }: Props) {
  const reduced = useReducedMotion()
  const [line1, line2] = text.split('\n')

  return (
    <motion.section
      className="empty"
      initial={reduced ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30, delay: 0.06 }}
    >
      <MarkIcon className="empty__mark" />
      <h2 className="empty__title">{title}</h2>
      <p className="empty__text">
        {line1}
        {line2 ? (
          <>
            <br />
            {line2}
          </>
        ) : null}
      </p>
      <div className="empty__cta">
        <button type="button" className="btn btn--primary btn--inline" onClick={onAdd}>
          {cta}
        </button>
      </div>
    </motion.section>
  )
}
