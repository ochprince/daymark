import { motion, useReducedMotion } from 'motion/react'
import { PlusIcon } from './icons'

type Props = {
  onClick: () => void
  label: string
}

export function Fab({ onClick, label }: Props) {
  const reduced = useReducedMotion()

  return (
    <div className="fab-wrap">
      <motion.button
        type="button"
        className="fab"
        aria-label={label}
        onClick={onClick}
        initial={reduced ? false : { opacity: 0, scale: 0.7, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 24, delay: 0.12 }}
        whileTap={{ scale: 0.9 }}
      >
        <PlusIcon />
      </motion.button>
    </div>
  )
}
