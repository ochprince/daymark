import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { CheckInEvent } from '../lib/types'
import { CheckInCard } from './CheckInCard'

type Props = {
  events: CheckInEvent[]
  now: number
  onTap: (event: CheckInEvent) => void
  onOpenHistory: (event: CheckInEvent) => void
  onEdit: (event: CheckInEvent) => void
}

export function CheckInList({
  events,
  now,
  onTap,
  onOpenHistory,
  onEdit,
}: Props) {
  const reduced = useReducedMotion()

  return (
    <ul className="list">
      <AnimatePresence initial={false}>
        {events.map((event, index) => (
          <motion.li
            key={event.id}
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
            <CheckInCard
              event={event}
              now={now}
              onTap={onTap}
              onOpenHistory={onOpenHistory}
              onEdit={onEdit}
            />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
