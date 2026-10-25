/**
 * 分享卡片（屏幕上那一版，9:16）。
 *
 * 逻辑尺寸 1080×1920，用 transform: scale() 等比缩到预览框宽度，
 * 所以里面的字号都能按「设计稿像素」直接写。颜色、字体全部读皮肤令牌，
 * 因此外面必须有一层带 data-skin 的容器（不传就用根节点当前那套）。
 *
 * 导出 PNG 走 v2/share.tsx 的 renderSharePng，那边按同一套坐标用 Canvas 重画。
 */
import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { Creature } from '../components/Creature'
import { SHARE_SIZE } from '../lib/sharecard'
import type { ShareModel } from '../lib/sharecard'
import type { SkinPack } from '../lib/skin'
import './sharecard.css'

/** 角色画多大（设计稿像素） */
const ART_SIZE = 520

export type ShareCardProps = {
  model: ShareModel
  /** 外层皮肤；弹层里传当前皮肤，独立预览页传选中的那套 */
  skin?: SkinPack
  /** 弹层导出时用它读 CSS 变量（量到内层卡片才读得到 --c） */
  cardRef?: RefObject<HTMLDivElement>
  className?: string
}

export function ShareCard({ model, skin, cardRef, className }: ShareCardProps) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const scale = useFitScale(frameRef)

  const style = {
    '--c': `var(--h-${model.colorIndex})`,
    '--c2': `var(--h-${model.colorIndex}-2)`,
    transform: `scale(${scale})`,
  } as CSSProperties

  return (
    <div
      className={className ? `share-frame ${className}` : 'share-frame'}
      ref={frameRef}
      data-skin={skin}
    >
      <div className="share-frame__inner" style={style} ref={cardRef}>
        <article className="share-card" aria-label={`${model.title} · ${model.kindLabel}`}>
          <div className="share-card__top">
            <span className="share-card__brand">Daymark</span>
            <span className="share-card__date">{model.dateText}</span>
          </div>

          <div className="share-card__art">
            <Creature
              species={model.species}
              stage={model.stage}
              mood={model.mood}
              size={ART_SIZE}
            />
          </div>

          <span className="share-card__tag">{model.kindLabel}</span>

          <div
            className={model.isPhrase ? 'share-card__num is-phrase' : 'share-card__num'}
          >
            {model.lead ? <span className="lead">{model.lead}</span> : null}
            <span className="num">{model.number}</span>
            {model.unit ? <span className="unit">{model.unit}</span> : null}
          </div>

          <h2 className="share-card__title">{model.title}</h2>
          <p className="share-card__line">{model.subtitle}</p>

          {model.showGrowth ? (
            <div className="share-card__growth">
              <div className="g-row">
                <span>{model.growthLabel}</span>
                <b>{model.growthPct}%</b>
              </div>
              <div className="g-track">
                <i style={{ width: `${model.growthPct}%` }} />
              </div>
            </div>
          ) : null}

          <div className="share-card__foot">{model.footer}</div>
        </article>
      </div>
    </div>
  )
}

/**
 * 预览缩放：量预览框宽度 ÷ 设计稿宽度。
 * 用 ResizeObserver 而不是 window.resize，弹层内外、横竖屏切换都能跟上。
 */
function useFitScale(frameRef: RefObject<HTMLDivElement | null>): number {
  const [scale, setScale] = useState(0)

  useLayoutEffect(() => {
    const node = frameRef.current
    if (!node) return undefined
    const update = () => {
      const width = node.clientWidth
      if (width > 0) setScale(width / SHARE_SIZE.width)
    }
    update()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [frameRef])

  return scale
}
