export type Accent = {
  id: string
  name: string
  /** 渐变起始色（深色主题用） */
  from: string
  /** 渐变结束色（深色主题用） */
  to: string
  /** 浅色主题下的实心文字色，保证对比度 */
  ink: string
}

export const PALETTE: readonly Accent[] = [
  { id: 'amber', name: '琥珀', from: '#FFC46B', to: '#FF8A3D', ink: '#B4611A' },
  { id: 'coral', name: '珊瑚', from: '#FF9AA8', to: '#FF4D6D', ink: '#C22B4C' },
  { id: 'violet', name: '紫罗兰', from: '#BCA4FF', to: '#7C5CFC', ink: '#5F41D6' },
  { id: 'azure', name: '靛蓝', from: '#7CC0FF', to: '#3B82F6', ink: '#2563EB' },
  { id: 'teal', name: '青瓷', from: '#5EE2C8', to: '#12B39B', ink: '#0D8574' },
  { id: 'lime', name: '青柠', from: '#C3E86A', to: '#63A32C', ink: '#4C8123' },
  { id: 'rose', name: '玫红', from: '#FF9BC8', to: '#E8459B', ink: '#BF2A76' },
  { id: 'graphite', name: '石墨', from: '#C2CAD6', to: '#6B7688', ink: '#4B5563' },
]

export function accentFor(index: number): Accent {
  const total = PALETTE.length
  const safe = ((Math.trunc(index) % total) + total) % total
  return PALETTE[safe]
}

/** 从已用颜色里挑一个用得最少的，让新建的事件自动换色 */
export function pickColorIndex(usedColors: readonly number[]): number {
  const tally = new Array<number>(PALETTE.length).fill(0)
  for (const color of usedColors) {
    const safe = ((Math.trunc(color) % PALETTE.length) + PALETTE.length) % PALETTE.length
    tally[safe] += 1
  }
  let best = 0
  for (let index = 1; index < tally.length; index += 1) {
    if (tally[index] < tally[best]) best = index
  }
  return best
}
