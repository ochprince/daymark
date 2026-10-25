/**
 * 分享卡片（屏幕上那一版，9:16）。
 *
 * 逻辑尺寸 1080×1920，用 transform: scale() 等比缩到预览框宽度，
 * 所以里面的字号都能按「设计稿像素」直接写。颜色、字体全部读皮肤令牌，
 * 因此外面必须有一层带 data-skin 的容器（不传就用根节点当前那套）。
 *
 * 三套模板全靠 class 变体（.share-card.tpl-sticker / .tpl-ticket / .tpl-photo），
 * 组件里不写 `if (skin === …)`，皮肤差异走令牌、模板差异走 class：
 * - 票根的虚线 / 缺口 / ADMIT ONE / 日期 + 序列号这几块 DOM 一直都在，靠 CSS 显隐，
 *   这样切模板不需要重新挂载角色动画。
 * - 相片模板的底图是 <img> + object-fit: cover，导出时 share.tsx 用 sharefit.coverCrop
 *   算同一块裁剪矩形，两边看到的构图一致。
 *
 * 导出 PNG 走 v2/share.tsx 的 renderSharePng，那边按同一套坐标用 Canvas 重画。
 */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { Creature } from '../components/Creature'
import { getLocale, subscribeLocale } from '../lib/i18n'
import { getPhotoUrl } from '../lib/photos'
import { SHARE_SIZE, shareCopy } from '../lib/sharecard'
import type { ShareModel, ShareTemplate } from '../lib/sharecard'
import { ticketSerial } from '../lib/sharefit'
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
  /** 卡面模板，默认贴纸 */
  template?: ShareTemplate
}

export function ShareCard({ model, skin, cardRef, className, template = 'sticker' }: ShareCardProps) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const scale = useFitScale(frameRef)
  const locale = useSyncExternalStore(subscribeLocale, getLocale)
  // 只有相片模板才去 IndexedDB 取 objectURL；其它模板不碰照片
  const photoUrl = usePhotoUrl(template === 'photo' ? model.photoId : null)

  const style = {
    '--c': `var(--h-${model.colorIndex})`,
    '--c2': `var(--h-${model.colorIndex}-2)`,
    transform: `scale(${scale})`,
  } as CSSProperties

  const classes = ['share-card', `tpl-${template}`]
  const serial = `NO. ${ticketSerial(`${model.slug}|${model.key}`, model.stamp)}`

  return (
    <div
      className={className ? `share-frame ${className}` : 'share-frame'}
      ref={frameRef}
      data-skin={skin}
    >
      <div className="share-frame__inner" style={style} ref={cardRef}>
        <article className={classes.join(' ')} aria-label={`${model.title} · ${model.kindLabel}`}>
          {/* 相片模板的底图（其它模板 display:none，不会去下载图） */}
          <div className="share-card__photo" aria-hidden="true">
            {photoUrl ? <img src={photoUrl} alt="" /> : null}
          </div>
          <div className="share-card__scrim" aria-hidden="true" />

          {/* 票根的框、打孔线与缺口：纯装饰 */}
          <span className="share-card__ticket-frame" aria-hidden="true" />
          <span className="share-card__hole is-top" aria-hidden="true" />
          <span className="share-card__hole is-bottom" aria-hidden="true" />
          <span className="share-card__admit">{shareCopy('share.tpl.admit', undefined, locale)}</span>
          <span className="share-card__stamp">{model.stamp}</span>
          <span className="share-card__serial">{serial}</span>

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

/** 相片 id → objectURL（photos.ts 里按 id 缓存，切模板回来不会重复造） */
function usePhotoUrl(photoId: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!photoId) {
      setUrl(null)
      return undefined
    }
    let alive = true
    void getPhotoUrl(photoId).then((next) => {
      if (alive) setUrl(next)
    })
    return () => {
      alive = false
    }
  }, [photoId])

  return url
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
