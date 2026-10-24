import { useMemo } from 'react'
import { badge as badgeSvg, creature as creatureSvg } from './creature-art'
import type { CreatureMood, CreatureOptions, CreatureSpecies } from './creature-art'

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
 * 小伙伴。生成的是一段静态 SVG 字符串（无用户输入），所以用 innerHTML 渲染是安全的，
 * 也保住了原型里的分层与 class（动画全靠这些 class + 令牌）。
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
  const html = useMemo(
    () => creatureSvg({ species, stage, mood, size, extra }),
    [species, stage, mood, size, extra],
  )
  return (
    <span
      className={className ? `creature ${className}` : 'creature'}
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
