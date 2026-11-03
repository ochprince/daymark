import { useId, useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { PetStage, PetState } from './art'
import type { PetArtSpecies } from './petArt'
import { petHueVars, renderPetSvg } from './petArt'

export type PetProps = {
  species: PetArtSpecies
  stage: PetStage
  state: PetState
  /** 视觉高度（px）；脚底大约在 93% 处 */
  size?: number
  /** 配色索引 0–7，对应 --h-N / --h-N-2 */
  hue?: number
}

/**
 * 一只萌宠：设计师出的正式 SVG（src/v2/pets/svg/，以原始文本内联注入）。
 *
 * 颜色走外层这两个变量：先吃当前皮肤的 --h-N 令牌，令牌缺失时用 hueVars() 的
 * 真实色值兜底（宁可花色不对，也不能落成黑剪影）。素材根节点里的 --c / --c2
 * 已在 petArt.ts 里剥掉，所以这里注入的值一定生效。
 *
 * 状态动画靠 svg 上的 `pet-art--s{state}` + `data-state`（见 pets.css）；
 * reduced-motion 下静止，由 .reduce-motion .pet-art 关掉 animation。
 */
export function Pet({ species, stage, state, size = 88, hue = 4 }: PetProps) {
  const rawId = useId()
  const uid = useMemo(() => `pet${rawId.replace(/[^a-zA-Z0-9]/g, '')}`, [rawId])
  const html = useMemo(
    () => renderPetSvg({ species, stage, size, hue, mood: state, uid }),
    [species, stage, size, hue, state, uid],
  )
  const index = ((Math.round(hue) % 8) + 8) % 8
  const vars = petHueVars(index)
  const style = {
    '--c': `var(--h-${index}, ${vars['--c']})`,
    '--c2': `var(--h-${index}-2, ${vars['--c2']})`,
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
