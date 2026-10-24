/** v2 界面用的图标：线条统一 2.2px、圆头，尺寸跟着字号走 */
type IconProps = { size?: number; className?: string }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export function IconToday({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.4V12l3 1.8" />
    </svg>
  )
}

export function IconMuseum({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 9.5 12 4l8 5.5" />
      <path d="M6 10v8M10 10v8M14 10v8M18 10v8" />
      <path d="M4 19.5h16" />
    </svg>
  )
}

export function IconDress({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3.6a8.4 8.4 0 1 0 0 16.8c2 0 3-1.2 3-2.6 0-2.4-3.6-2.2-3.6-4.2 0-1.2 1-2 2.4-2 1.2 0 2 .5 2.6 1.2" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconPlus({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  )
}

export function IconDown({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6 9.5 12 15l6-5.5" />
    </svg>
  )
}

export function IconBell({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.2 1.5 5.2H5s1.5-1.2 1.5-5.2Z" />
      <path d="M10 18.4a2.2 2.2 0 0 0 4 0" />
    </svg>
  )
}

export function IconCheck({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  )
}

export function IconClose({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  )
}
