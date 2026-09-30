type IconProps = { className?: string }

export function PlusIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5.5v13M5.5 12h13" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function SunIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.1" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3.2v2.1M12 18.7v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M3.2 12h2.1M18.7 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function MoonIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20.2 14.3A8.3 8.3 0 0 1 9.7 3.8a8.5 8.5 0 1 0 10.5 10.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.8 6.6h14.4M9.6 6.6V5.3c0-.7.6-1.3 1.3-1.3h2.2c.7 0 1.3.6 1.3 1.3v1.3M7.1 6.6l.8 11.4c.05.9.8 1.6 1.7 1.6h4.8c.9 0 1.65-.7 1.7-1.6l.8-11.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.4 10.4v5.3M13.6 10.4v5.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.7 9.6 17 19 6.9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SparkIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.6l1.9 5.1 5.1 1.9-5.1 1.9L12 17.6l-1.9-5.1L5 10.6l5.1-1.9L12 3.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M18.6 16.4l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z" fill="currentColor" />
    </svg>
  )
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9.5 5.5 16 12l-6.5 6.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function RepeatIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 9.2A3.2 3.2 0 0 1 8.2 6h9.3m0 0-2.6-2.6M17.5 6l-2.6 2.6M19 14.8A3.2 3.2 0 0 1 15.8 18H6.5m0 0 2.6 2.6M6.5 18l2.6-2.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 品牌标记：三级上升的刻度柱 */
export function MarkIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="daymark-mark" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#8B7BFF" />
          <stop offset="100%" stopColor="#4F8DFF" />
        </linearGradient>
      </defs>
      <rect x="3.2" y="14.4" width="4.4" height="6.4" rx="2.2" fill="url(#daymark-mark)" opacity="0.55" />
      <rect x="9.8" y="9.6" width="4.4" height="11.2" rx="2.2" fill="url(#daymark-mark)" opacity="0.8" />
      <rect x="16.4" y="4" width="4.4" height="16.8" rx="2.2" fill="url(#daymark-mark)" />
    </svg>
  )
}
