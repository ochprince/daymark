import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CountdownCard } from './CountdownCard'
import type { CountdownView } from '../lib/days'

type Props = {
  views: CountdownView[]
  onOpen: (view: CountdownView) => void
}

export function CountdownList({ views, onOpen }: Props) {
  const reduced = useReducedMotion()

  return (
    <ul className="list">
      <AnimatePresence initial={false}>
        {views.map((view, index) => (
          <motion.li
            key={view.event.id}
            layout={!reduced}
            initial={reduced ? false : { opacity: 0, y: 16, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, x: -22 }}
            transition={{
              type: 'spring',
              stiffness: 380,
              damping: 34,
              delay: reduced ? 0 : Math.min(index, 8) * 0.035,
            }}
          >
            <CountdownCard
              view={view}
              onOpen={onOpen}
            />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
