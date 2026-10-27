import type { CSSProperties } from 'react'
import { Creature } from '../components/Creature'
import { t } from '../lib/i18n'
import type { Locale, MessageKey } from '../lib/i18n'
import { INTL_LOCALE, LOCALES, LOCALE_LABELS } from '../lib/i18n'
import { reduceMotionOn } from '../lib/prefs'
import type { PrefsState } from '../lib/prefs'
import { FREE_SKIN_PACKS } from '../lib/entitlement'
import { SKIN_PACKS, resolveNum, resolveTexture } from '../lib/skin'
import type { NumStyle, SkinPack, SkinState, TextureStyle } from '../lib/skin'
import { IconDress, IconMuseum, IconToday } from './icons'
import './dress.css'

export type DressPageProps = {
  skin: SkinState
  onSkin: (patch: Partial<SkinState>) => void
  prefs: PrefsState
  onPrefs: (patch: Partial<PrefsState>) => void
  locale: Locale
  onLocale: (locale: Locale) => void
  onExport: () => void
  onImport: (file: File) => void
  pro: boolean
  onUpgrade: () => void
}

const NUM_STYLES: readonly NumStyle[] = ['auto', 'round', 'serif', 'pixel', 'hand']
const TEXTURES: readonly TextureStyle[] = ['auto', 'plain', 'dots', 'grid', 'lines']

/** 装扮：风格包、主色、数字字体、纹理，和其他偏好 */
export function DressPage({ skin, onSkin, prefs, onPrefs, locale, onLocale, onExport, onImport, pro, onUpgrade }: DressPageProps) {
  return (
    <div className="dress">
      <header className="dress-h">
        <h2>{t('dress.title')}</h2>
        <p>{t('dress.sub')}</p>
      </header>

      <div className="sec-title">
        {t('dress.previewTitle')} <small>{t('dress.previewHint')}</small>
      </div>
      <PreviewScreen skin={skin} prefs={prefs} locale={locale} />

      <div className="gallery">
        {SKIN_PACKS.map((pack) => (
          <button
            key={pack}
            type="button"
            className={`g-item ${skin.pack === pack ? 'is-on' : ''}`}
            onClick={() => {
              // 免费版只给软糖，点别的包就弹付费墙
              if (!pro && !(FREE_SKIN_PACKS as readonly string[]).includes(pack)) {
                onUpgrade()
                return
              }
              onSkin({ pack })
            }}
          >
            <MiniPhone pack={pack} />
            <b>{t(`dress.pack.${pack}` as MessageKey)}</b>
            <small>{t(`dress.pack.${pack}.tag` as MessageKey)}</small>
            <span className="applied">{t('dress.applied')}</span>
          </button>
        ))}
        <div className="coming">
          <span className="coming-plus">+</span>
          <span>{t('dress.more')}</span>
        </div>
      </div>

      <div className="g-dots">
        {SKIN_PACKS.map((pack) => (
          <i key={pack} className={skin.pack === pack ? 'on' : ''} />
        ))}
      </div>

      <div className="sec-title">
        {t('dress.custom')} <small>{t('dress.customHint')}</small>
      </div>

      <div className="card opt">
        <div className="opt-h">
          <span>{t('dress.accent')}</span>
          <small>{skin.accent === 'auto' ? t('dress.num.auto') : `${skin.accent}`}</small>
        </div>
        <div className="swatches">
          <button
            type="button"
            aria-label="auto"
            onClick={() => onSkin({ accent: 'auto' })}
            style={{
              width: 28,
              height: 28,
              borderRadius: 99,
              border: skin.accent === 'auto' ? '3px solid var(--ink)' : '2px solid var(--hair)',
              background: 'linear-gradient(135deg, var(--h-0) 0 50%, var(--h-3) 50% 100%)',
            }}
          />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`accent ${color}`}
              onClick={() => onSkin({ accent: color })}
              style={{
                width: 28,
                height: 28,
                borderRadius: 99,
                border: skin.accent === color ? '3px solid var(--ink)' : '2px solid var(--hair)',
                background: `var(--h-${color})`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="card opt">
        <div className="opt-h">
          <span>{t('dress.num')}</span>
        </div>
        <div className="numopts">
          {NUM_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              className={`numopt ${skin.num === style ? 'is-on' : ''}`}
              onClick={() => onSkin({ num: style })}
            >
              <b style={numPreview(style)}>8</b>
              <small>{t(`dress.num.${style}` as MessageKey)}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="card opt">
        <div className="opt-h">
          <span>{t('dress.texture')}</span>
        </div>
        <div className="texopts">
          {TEXTURES.map((texture) => (
            <button
              key={texture}
              type="button"
              className={`texopt ${skin.texture === texture ? 'is-on' : ''}`}
              onClick={() => onSkin({ texture })}
            >
              {t(`dress.tex.${texture}` as MessageKey)}
            </button>
          ))}
        </div>
      </div>

      {pro ? null : (
        <button className="card opt" type="button" onClick={onUpgrade} style={{ display: 'block', width: 'calc(100% - 32px)', textAlign: 'left' }}>
          <div className="opt-h" style={{ marginBottom: 0 }}>
            <span>{t('pro.title')}</span>
            <small>{t('pro.sub')}</small>
          </div>
        </button>
      )}

      <div className="sec-title">{t('dress.other')}</div>
      <div className="card list">
        <div className="li">
          <span className="grow">
            {t('dress.followSystem')}
            <small className="li-sub">{t('dress.pack.night.tag')}</small>
          </span>
          <button
            className={`toggle ${skin.followSystem ? 'on' : ''}`}
            type="button"
            aria-label={t('dress.followSystem')}
            onClick={() => onSkin({ followSystem: !skin.followSystem })}
          />
        </div>
        <div className="li">
          <span className="grow">
            {t('dress.sound')}
            <small className="li-sub">{t('dress.soundHint')}</small>
          </span>
          <button
            className={`toggle ${prefs.sound ? 'on' : ''}`}
            type="button"
            aria-label={t('dress.sound')}
            onClick={() => onPrefs({ sound: !prefs.sound })}
          />
        </div>
        <div className="li">
          <span className="grow">
            {t('dress.haptic')}
            <small className="li-sub">{t('dress.hapticHint')}</small>
          </span>
          <button
            className={`toggle ${prefs.haptic ? 'on' : ''}`}
            type="button"
            aria-label={t('dress.haptic')}
            onClick={() => onPrefs({ haptic: !prefs.haptic })}
          />
        </div>
        <div className="li">
          <span className="grow">
            {t('dress.reduceMotion')}
            <small className="li-sub">{t('dress.reduceHint')}</small>
          </span>
          <button
            className={`toggle ${prefs.reduceMotion ? 'on' : ''}`}
            type="button"
            aria-label={t('dress.reduceMotion')}
            onClick={() => onPrefs({ reduceMotion: !prefs.reduceMotion })}
          />
        </div>
        <div className="li">
          <span className="grow">
            {t('dress.language')}
            <small className="li-sub">{LOCALE_LABELS[locale]}</small>
          </span>
          <span className="chips">
            {LOCALES.map((code) => (
              <button
                key={code}
                type="button"
                className={`chip ${locale === code ? 'is-on' : ''}`}
                onClick={() => onLocale(code)}
              >
                {LOCALE_LABELS[code]}
              </button>
            ))}
          </span>
        </div>
        <div className="li">
          <span className="grow">
            {t('dress.dataNote')}
            <small className="li-sub">{t('dress.about')}</small>
          </span>
        </div>
        <button className="li" type="button" onClick={onExport}>
          <span className="grow">{t('dress.export')}</span>
          <small>›</small>
        </button>
        <label className="li" style={{ cursor: 'pointer' }}>
          <span className="grow">{t('dress.import')}</span>
          <small>›</small>
          <input
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0]
              // 先清空 value，同一个文件再选一次也能触发
              event.target.value = ''
              if (file) onImport(file)
            }}
          />
        </label>
        <button className="li" type="button" onClick={() => openDoc('privacy.html')}>
          <span className="grow">{t('dress.privacy')}</span>
          <small>›</small>
        </button>
        <button className="li" type="button" onClick={() => openDoc('support.html')}>
          <span className="grow">{t('dress.support')}</span>
          <small>›</small>
        </button>
      </div>
    </div>
  )
}

/**
 * 整屏预览：一块真 DOM 的缩小界面（顶栏 + stage-card 骨架 + tabbar）。
 *
 * 不是截图、也不是第二套样式：容器上带 data-skin / data-accent / data-num /
 * data-texture，里面全读令牌，所以换包、换主色、换字体、换纹理都是当场生效
 * （不用点保存），组件里也没有一处 if (skin === …)。
 */
function PreviewScreen({ skin, prefs, locale }: { skin: SkinState; prefs: PrefsState; locale: Locale }) {
  // 减弱动效：用户开关或系统设置任一为真，预览里的循环动画都停
  const reduce = reduceMotionOn(prefs)
  const days = 128
  const grown = 96
  return (
    <div className="dress-pv-box">
      <div
        className={reduce ? 'dress-preview reduce-motion' : 'dress-preview'}
        data-skin={skin.pack}
        data-accent={typeof skin.accent === 'number' ? String(skin.accent) : 'auto'}
        data-num={resolveNum(skin.pack, skin.num)}
        data-texture={resolveTexture(skin.pack, skin.texture)}
        role="img"
        aria-label={`${t('dress.previewTitle')} · ${t(`dress.pack.${skin.pack}` as MessageKey)}`}
        // 卡片里的配色跟主色走：真界面里 --c/--c2 由每件事自己的颜色给
        style={{ '--c': 'var(--accent)', '--c2': 'var(--accent-2)' } as CSSProperties}
      >
        <div className="pv-tex" aria-hidden="true" />

        <div className="pv-top">
          <div className="pv-top-l">
            <span className="pv-date">{dayLabel(locale)}</span>
            <span className="pv-greet">{t('greet.morning')}</span>
          </div>
          <span className="pv-avatar">
            <Creature species="sprout" stage={2} size={26} />
          </span>
        </div>

        <div className="pv-card">
          <div className="pv-card-top">
            <span className="pv-tag">{t('kind.since')}</span>
            <b className="pv-title">{t('dress.previewName')}</b>
          </div>

          <div className="pv-hero">
            <span className="pv-bubble">{t('line.since.long', { n: days })}</span>
            <span className="pv-cr">
              <Creature species="sprout" stage={3} size={64} />
            </span>
            <span className="pv-ground" aria-hidden="true" />
          </div>

          <div className="pv-num">
            <span className="pv-digits">{days}</span>
            <span className="pv-unit">{t('unit.daySuffix')}</span>
          </div>
          <div className="pv-sub">{t('stage.since.sub', { date: sinceLabel(locale, days) })}</div>

          <div className="pv-growth">
            <div className="pv-grow-h">
              <span>{t('growth.total', { n: grown })}</span>
              <b>62%</b>
            </div>
            <div className="pv-track">
              <i />
            </div>
          </div>

          <div className="pv-actions">
            <span className="pv-btn">{t('action.poke')}</span>
            <span className="pv-btn solid">{t('action.hold')}</span>
          </div>
        </div>

        <nav className="pv-tabs" aria-hidden="true">
          <i className="on">
            <IconToday size={14} />
            {t('tab.today')}
          </i>
          <i>
            <IconMuseum size={14} />
            {t('tab.museum')}
          </i>
          <i>
            <IconDress size={14} />
            {t('tab.dress')}
          </i>
        </nav>
      </div>
    </div>
  )
}

/** 顶栏日期：跟着当前语言走 */
function dayLabel(locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date())
  } catch {
    return ''
  }
}

/** 「从 X 起」里的 X：把预览里那个天数倒推出来，看起来才像真的 */
function sinceLabel(locale: Locale, days: number): string {
  try {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: 'short', day: 'numeric' }).format(
      new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    )
  } catch {
    return ''
  }
}

/** 打开随包发布的静态页（隐私政策 / 帮助）；在原生壳里是同源页面，不出应用 */
function openDoc(file: string): void {
  const base = import.meta.env.BASE_URL || '/'
  window.location.assign(`${base}${file}`)
}

function numPreview(style: NumStyle): CSSProperties {
  if (style === 'serif') return { fontFamily: 'Georgia, "Songti SC", serif' }
  if (style === 'pixel') return { fontFamily: 'ui-monospace, "SFMono-Regular", monospace', letterSpacing: '-1px' }
  if (style === 'hand') return { fontFamily: '"Kaiti SC", "Bradley Hand", cursive' }
  if (style === 'round') return { fontFamily: 'ui-rounded, "SF Pro Rounded", system-ui' }
  return {}
}

/** 缩略机：走的是同一套令牌，所以换包这里立刻跟着变 */
function MiniPhone({ pack }: { pack: SkinPack }) {
  return (
    <div className="mini" data-skin={pack} aria-hidden="true">
      <div className="mini-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Creature species="sprout" stage={2} size={38} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7 }}>{t('greet.morning')}</div>
            <div style={{ fontSize: 12, fontWeight: 800 }}>{t('dress.previewName')}</div>
          </div>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-num)',
            fontStyle: 'var(--num-style)',
            fontWeight: 'var(--num-w)',
            fontSize: 44,
            lineHeight: 1,
            marginTop: 10,
          }}
        >
          128
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{t('unit.day', { n: 128 })}</div>
        <div
          style={{
            marginTop: 12,
            height: 8,
            borderRadius: 99,
            background: 'var(--hair)',
            overflow: 'hidden',
          }}
        >
          <div style={{ width: '62%', height: '100%', background: 'var(--c2)' }} />
        </div>
      </div>
    </div>
  )
}
