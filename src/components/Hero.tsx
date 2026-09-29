import { formatDate, formatWeekday } from '../lib/days'
import type { Summary } from '../lib/days'

type Props = {
  now: number
  summary: Summary
}

export function Hero({ now, summary }: Props) {
  return (
    <section className="hero">
      <p className="hero__eyebrow">
        <span className="hero__dot" />
        {formatDate(now)} · {formatWeekday(now)}
      </p>
      <h1 className="hero__title">已经走过的日子</h1>
      <p className="hero__stats">
        {summary.count > 0 ? (
          <>
            <span>共 {summary.count} 个刻度</span>
            <span className="hero__sep" />
            <span>最长 {summary.longest} 天</span>
          </>
        ) : (
          <span>记录一件事，然后看它长成多少天</span>
        )}
      </p>
    </section>
  )
}
