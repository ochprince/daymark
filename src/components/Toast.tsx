import { useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

export type ToastState = {
  id: number
  message: string
  action?: { label: string; run: () => void }
}

type Props = {
  toast: ToastState | null
  onDismiss: () => void
}

export function Toast({ toast, onDismiss }: Props) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(onDismiss, toast.action ? 6000 : 3200)
    return () => window.clearTimeout(timer)
  }, [toast, onDismiss])

  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          key={toast.id}
          className="toast"
          role="status"
          aria-live="polite"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 22, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        >
          <span className="toast__msg">{toast.message}</span>
          {toast.action ? (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                toast.action?.run()
                onDismiss()
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
