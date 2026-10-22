import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { DayEvent } from '../lib/types'
import { EventCard } from './EventCard'

type Props = {
  events: DayEvent[]
  now: number
  onOpen: (event: DayEvent) => void
  onHistory?: (event: DayEvent) => void
}

export function EventList({ events, now, onOpen, onHistory }: Props) {
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
            <EventCard
              event={event}
              now={now}
              onOpen={onOpen}
              onHistory={onHistory}
            />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
