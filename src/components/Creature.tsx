import { useId, useMemo } from 'react'
import { badge as badgeSvg } from './creature-art'
import type { CreatureMood, CreatureOptions, CreatureSpecies } from './creature-art'
import { renderPetSvg } from '../v2/pets/petArt'

export type { CreatureMood, CreatureSpecies }

type CreatureProps = {
  species?: CreatureSpecies
  stage?: CreatureOptions['stage']
  mood?: CreatureMood
  size?: number
  extra?: CreatureOptions['extra']
  className?: string
  /** 读屏用的名字；不给就是纯装饰 */
  label?: string
}

/**
 * 小伙伴。
 *
 * 造型来自设计师给的正式素材（`src/v2/pets/svg/`，43 个 SVG），
 * 表情由 `data-face` 占位在运行时按 mood 换成真脸，clipPath id 按实例去重。
 * 以前这里画的是代码现生成的仿制造型——和桌宠那套不是同一只，所以卡片里
 * 一直是「旧版本」。现在两边共用同一套素材，卡片里和桌面上是同一只。
 */
export function Creature({
  species = 'sprout',
  stage = 0,
  mood = 'idle',
  size = 160,
  extra,
  className,
  label,
}: CreatureProps) {
  const rawId = useId()
  // useId 带冒号，SVG 的 id 里不合法，洗一遍
  const uid = rawId.replace(/[^A-Za-z0-9_-]/g, '')

  const html = useMemo(() => {
    const isEgg = stage === 'egg'
    // 旧接口的表情名（happy/wow）对到物理层的状态名（cheer/fall），渲染端只认后者
    const petMood = mood === 'happy' ? 'cheer' : mood === 'wow' ? 'fall' : mood
    return renderPetSvg({
      species,
      stage: isEgg ? 0 : (stage as 0 | 1 | 2 | 3 | 4),
      size,
      mood: petMood,
      uid,
      egg: isEgg,
      crack: extra?.crack,
      hold: extra?.hold,
    })
  }, [species, stage, mood, size, uid, extra])

  // 图鉴里没解锁的格子要剪影：直接把画出来的东西压成黑色轮廓
  const silhouette = extra?.silhouette ? { filter: 'brightness(0)', opacity: 0.18 } : undefined

  return (
    <span
      className={className ? `creature ${className}` : 'creature'}
      style={silhouette}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

type BadgeProps = {
  kind: string
  label?: string
  size?: number
  locked?: boolean
  className?: string
}

/** 藏馆徽章 */
export function Badge({ kind, label = '', size = 64, locked = false, className }: BadgeProps) {
  const html = useMemo(() => badgeSvg(kind, label, size, locked), [kind, label, size, locked])
  return (
    <span
      className={className ? `badge-wrap ${className}` : 'badge-wrap'}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
