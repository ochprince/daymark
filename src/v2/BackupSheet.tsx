import { t } from '../lib/i18n'
import type { MessageKey } from '../lib/i18n'
import type { BackupSummary } from '../lib/backup'

export type BackupSheetProps = {
  summary: BackupSummary
  onCancel: () => void
  onConfirm: () => void
}

/**
 * 恢复前先让用户看清「这份备份里有多少东西」。
 * 覆盖式恢复不能撤销，所以默认按钮是「先不用」，恢复按钮放在主位但需要主动点。
 */
export function BackupSheet({ summary, onCancel, onConfirm }: BackupSheetProps) {
  const date = new Date(summary.exportedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const parts: Array<{ key: MessageKey; count: number }> = [
    { key: 'kind.since', count: summary.events },
    { key: 'kind.habit', count: summary.checkins },
    { key: 'kind.countdown', count: summary.countdowns },
  ]

  return (
    <div className="ov" style={{ zIndex: 70 }}>
      <div className="dim" onClick={onCancel} />
      <div className="sheet paywall" role="dialog" aria-modal="true">
        <div className="sheet-h">{t('backup.title')}</div>
        <p className="sheet-sub">{t('backup.exportedAt', { date })}</p>

        <ul className="paywall-list">
          {parts.map((part) => (
            <li key={part.key}>
              <span className="paywall-tick" aria-hidden="true">
                ·
              </span>
              {`${t(part.key)} · ${part.count}`}
            </li>
          ))}
          {summary.badges > 0 ? (
            <li>
              <span className="paywall-tick" aria-hidden="true">
                ·
              </span>
              {`${t('museum.tab.badges')} · ${summary.badges}`}
            </li>
          ) : null}
        </ul>

        <p className="sheet-sub" style={{ marginTop: 4 }}>
          {t('backup.confirm')}
          <br />
          {t('backup.replace')}
        </p>

        <button className="btn block" type="button" onClick={onConfirm}>
          {t('backup.restore')}
        </button>
        <button className="link-row" type="button" onClick={onCancel}>
          {t('backup.cancel')}
        </button>
      </div>
    </div>
  )
}
