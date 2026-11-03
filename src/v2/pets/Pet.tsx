import { useId, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { petSvg, type PetSpecies, type PetStage, type PetState } from './art'

export type PetProps = {
  species: PetSpecies
  stage: PetStage
  state: PetState
  /** 视觉高度（px）；脚底大约在 93% 处 */
  size?: number
  /** 配色索引 0–7，对应 --h-N / --h-N-2 */
  hue?: number
}

/** 没有皮肤令牌时的兜底色：宁可花色不对，也不能落成黑剪影 */
const HUE_FALLBACK: readonly [string, string][] = [
  ['#ffe07a', '#e0a020'],
  ['#ffb4a2', '#e5664b'],
  ['#cdb9ff', '#7a5ae0'],
  ['#a8d8ff', '#3d8fe0'],
  ['#8fe3c0', '#2fa77a'],
  ['#cfe89a', '#6f9c3a'],
  ['#ffc0d8', '#e0568f'],
  ['#cbc5d8', '#6f6880'],
]

/**
 * 一只萌宠。纯 SVG（程序生成，不引图片）；颜色靠外层带的 --c / --c2，
 * 没给色号时默认薄荷，并且每一档都带 hex 兜底，避免落到黑色。
 */
export function Pet({ species, stage, state, size = 88, hue = 4 }: PetProps) {
  const rawId = useId()
  const uid = useMemo(() => `pet${rawId.replace(/[^a-zA-Z0-9]/g, '')}`, [rawId])
  const html = useMemo(
    () => petSvg({ species, stage, state, size, uid }),
    [species, stage, state, size, uid],
  )
  const index = ((Math.round(hue) % 8) + 8) % 8
  const [light, dark] = HUE_FALLBACK[index]
  const style = {
    '--c': `var(--h-${index}, ${light})`,
    '--c2': `var(--h-${index}-2, ${dark})`,
    width: `${size}px`,
    height: `${size}px`,
  } as CSSProperties

  return (
    <span
      className="pet"
      style={style}
      data-pet-species={species}
      data-pet-stage={stage}
      data-pet-state={state}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
