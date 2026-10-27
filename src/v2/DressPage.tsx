import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { t } from '../lib/i18n'
import type { Locale, MessageKey } from '../lib/i18n'
import { INTL_LOCALE, LOCALES, LOCALE_LABELS } from '../lib/i18n'
import type { PrefsState } from '../lib/prefs'
import { FREE_SKIN_PACKS, previewUnlocked } from '../lib/entitlement'
import { playSfx } from '../lib/sfx'
import { choosePack, SKIN_PACKS } from '../lib/skin'
import type { NumStyle, SkinPack, SkinState, TextureStyle } from '../lib/skin'
import type { SinceView } from '../lib/itemview'
import type { DayEvent } from '../lib/types'
import { StageCard } from './StageCard'
import './dress.css'

export type DressPageProps = {
  skin: SkinState
  /** 真正生效的那套：跟随系统时和 skin.pack 可能不同 */
  appliedPack: SkinPack
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
export function DressPage({ skin, appliedPack, onSkin, prefs, onPrefs, locale, onLocale, onExport, onImport, pro, onUpgrade }: DressPageProps) {
  // 画廊与预览对齐原型：横滑到哪一张，松手就换上（点击也算一次落定）
  const galleryRef = useRef<HTMLDivElement | null>(null)
  const settleTimer = useRef(0)
  const [center, setCenter] = useState(() => Math.max(0, SKIN_PACKS.indexOf(appliedPack)))
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef(0)

  function showToast(text: string) {
    setToast(text)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 1800)
  }

  useEffect(
    () => () => {
      window.clearTimeout(settleTimer.current)
      window.clearTimeout(toastTimer.current)
    },
    [],
  )

  // 首次进来把画廊滚到当前这套（原型也是这样，避免「选中的在屏幕外」）
  useEffect(() => {
    const gal = galleryRef.current
    if (!gal) return
    const item = gal.querySelectorAll<HTMLElement>('.g-item')[Math.max(0, SKIN_PACKS.indexOf(appliedPack))]
    if (!item) return
    // 先关掉吸附再定位，否则首次定位会被 snap 动画带偏
    gal.style.scrollSnapType = 'none'
    gal.scrollLeft = item.offsetLeft + item.offsetWidth / 2 - gal.clientWidth / 2
    requestAnimationFrame(() => {
      gal.style.scrollSnapType = ''
    })
    // 只在挂载时定位一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 换一套：免费版碰到锁着的包就弹付费墙 */
  function applyPack(pack: SkinPack) {
    if (!pro && !(FREE_SKIN_PACKS as readonly string[]).includes(pack)) {
      onUpgrade()
      return false
    }
    onSkin(choosePack(skin, pack))
    playSfx('tap')
    return true
  }

  function pickPack(pack: SkinPack) {
    setCenter(Math.max(0, SKIN_PACKS.indexOf(pack)))
    if (applyPack(pack)) showToast(t('dress.switched', { name: t(`dress.pack.${pack}` as MessageKey) }))
  }

  /** 松手落定：看哪一张停在正中，就换上哪一张 */
  function onGalleryScroll() {
    window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      const gal = galleryRef.current
      if (!gal) return
      const index = centeredIndex(gal)
      setCenter(index)
      const pack = SKIN_PACKS[index]
      if (!pack || (pack === appliedPack && !skin.followSystem)) return
      // 锁着的包只让看，不换上；点它才弹付费墙
      if (!pro && !(FREE_SKIN_PACKS as readonly string[]).includes(pack)) return
      onSkin(choosePack(skin, pack))
      playSfx('tap')
      showToast(t('dress.switched', { name: t(`dress.pack.${pack}` as MessageKey) }))
    }, 140)
  }

  return (
    <div className="dress">
      <header className="dress-h">
        <h2>{t('dress.title')}</h2>
        <p>{t('dress.sub')}</p>
      </header>

      <div className="gallery" ref={galleryRef} onScroll={onGalleryScroll}>
        {SKIN_PACKS.map((pack) => (
          <button
            key={pack}
            type="button"
            className={`g-item ${appliedPack === pack ? 'is-on' : ''}`}
            onClick={() => pickPack(pack)}
          >
            <MiniPhone pack={pack} locale={locale} />
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
        {SKIN_PACKS.map((pack, index) => (
          <i key={pack} className={center === index ? 'on' : ''} />
        ))}
      </div>
      <p className="g-hint">{t('dress.swipeHint')}</p>

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

      {pro ? (
        previewUnlocked ? (
          <div className="card opt" style={{ padding: '13px 18px' }}>
            <div className="opt-h" style={{ marginBottom: 0 }}>
              <span>{t('dress.previewUnlock')}</span>
              <small>{t('dress.previewUnlockHint')}</small>
            </div>
          </div>
        ) : null
      ) : (
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

      {toast ? (
        <div className="toast dress-toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  )
}

/** 预览里的这「一件事」：虚构的数据，交给真的 StageCard 去渲染 */
function previewView(): SinceView {
  const startedAt = Date.now() - 128 * 24 * 60 * 60 * 1000
  const title = t('dress.previewName')
  const event: DayEvent = {
    id: 'preview',
    title,
    startedAt,
    createdAt: startedAt,
    color: 1,
    species: 'sprout',
    history: [],
  }
  return {
    kind: 'since',
    key: 'since:preview',
    id: 'preview',
    title,
    color: 1,
    species: 'sprout',
    stage: 4,
    growth: 128,
    mood: 'idle',
    days: 128,
    event,
  }
}

/** 顶栏日期：跟着当前语言走 */
function dayLabel(locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date())
  } catch {
    return ''
  }
}

/** 画廊：哪一张停在正中（原型同款算法） */
function centeredIndex(gal: HTMLElement): number {
  const mid = gal.scrollLeft + gal.clientWidth / 2
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  gal.querySelectorAll<HTMLElement>('.g-item').forEach((el, index) => {
    const distance = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid)
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  })
  return best
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

/** 预览只读：卡片上的按住、横滑、点击都不接 */
const noop = () => {}

/**
 * 缩略机：照原型 miniPhone 的做法——400px 宽的虚拟屏里放真的 .t-head + StageCard，
 * 再整体 scale(0.485) 塞进 200×356 的窗口。不是另画一张小图，所以卡片内容、
 * 圆角、描边、阴影都和换到真机上一模一样。
 */
function MiniPhone({ pack, locale }: { pack: SkinPack; locale: Locale }) {
  const view = useMemo(() => previewView(), [locale])
  return (
    <div className="mini" data-skin={pack} aria-hidden="true">
      <div className="mini-inner">
        <header className="t-head">
          <div>
            <div className="t-date">{dayLabel(locale)}</div>
            <div className="t-greet">{t('greet.morning')}</div>
          </div>
        </header>
        <StageCard view={view} onLog={noop} onSayDone={noop} onPoke={noop} onProfile={noop} />
      </div>
    </div>
  )
}

