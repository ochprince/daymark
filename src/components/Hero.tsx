import type { ReactNode } from 'react'
import { formatDate, formatWeekday } from '../lib/days'

type Props = {
  now: number
  title: string
  stats: ReactNode
  /** 右上角的翻页手柄 */
  action?: ReactNode
  /** 总页数与当前页，用于下方的翻页指示点 */
  pages: number
  active: number
}

export function Hero({ now, title, stats, action, pages, active }: Props) {
  return (
    <section className="hero">
      <p className="hero__eyebrow">
        <span className="hero__dot" />
        {formatDate(now)} · {formatWeekday(now)}
      </p>
      <div className="hero__row">
        <h1 className="hero__title">{title}</h1>
        {action}
      </div>
      <p className="hero__stats">{stats}</p>
      {pages > 1 ? (
        <div className="pager-dots" aria-hidden="true">
          {Array.from({ length: pages }, (_, index) => (
            <span key={index} className="pager-dots__dot" data-active={index === active} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
