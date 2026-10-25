/**
 * 相片底图：把照片铺在卡片底下，文字区自动压暗 + 模糊，保证任何照片上都读得清。
 *
 * 用法（主控接线）：
 *
 *   <section className={photoId ? 'stage-card has-photo' : 'stage-card'}>
 *     <PhotoBackdrop url={url}>{卡片内容}</PhotoBackdrop>
 *   </section>
 *
 * 设计要点：
 * - 一帧里只有两件事：底图那一层（绝对定位，不吃布局）和 children（照旧走原来的流式布局）。
 *   所以把它套在任何「position: relative; overflow: hidden」的卡片里都不会打乱排版。
 * - 没有 url 时整层都不渲染，只把 children 原样交回去 —— 退回纯色皮肤，不留空壳。
 * - 文字颜色靠覆盖 --ink / --ink2 / --ink3 / --num-color 这几个令牌变白，
 *   组件里没有一处按皮肤分支（皮肤差异全在 CSS 令牌）。
 * - 底图默认按舞台卡的内边距「出血」（负外边距 + 内边距补回），
 *   换到别的地方用就把 --pb-bleed-x / --pb-bleed-top / --pb-bleed-bottom 置 0。
 */
import type { ReactNode } from 'react'
import './photo.css'

export type PhotoBackdropProps = {
  /** 相片的 objectURL；null 表示没有照片 */
  url: string | null
  children?: ReactNode
}

export function PhotoBackdrop({ url, children }: PhotoBackdropProps) {
  if (!url) return <>{children}</>

  return (
    <div className="pb">
      <div className="pb__layer" aria-hidden="true">
        <img className="pb__img" src={url} alt="" decoding="async" draggable={false} />
        <span className="pb__scrim" />
        <span className="pb__veil" />
      </div>
      <div className="pb__body">{children}</div>
    </div>
  )
}
