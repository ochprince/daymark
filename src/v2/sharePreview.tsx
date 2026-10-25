/**
 * 分享卡片的独立预览页（只在 dev 里用，构建不会打进产物）。
 *
 * 打开方式：
 *   npm run dev
 *   open http://localhost:5190/share-preview.html?skin=jelly&kind=since&lang=zh
 *
 * 左栏是屏幕上那一版（ShareCard），右栏是 Canvas 画出来、真正会导出成 PNG 的那一版
 * （renderSharePng）。两栏并排就是为了肉眼确认两边长得一样。
 * 参数：skin=jelly|paper|night|pixel，kind=since|habit|countdown，lang=zh|en，sheet=1 打开弹层。
 */
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../skins/tokens.css'
import '../skins/custom.css'
import { stageOf } from '../lib/growth'
import { setLocale, type Locale } from '../lib/i18n'
import type { ItemView } from '../lib/itemview'
import { buildShareModel } from '../lib/sharecard'
import type { SkinPack } from '../lib/skin'
import { ShareCard } from './ShareCard'
import { ShareSheet } from './ShareSheet'
import { renderSharePng, themeFromElement } from './share'
import './sharecard.css'

const DAY = 86_400_000

/** 造一件示例事项：跟首页结构一致，方便对照 */
function mockView(kind: string): ItemView {
  const now = Date.now()
  if (kind === 'habit') {
    return {
      key: 'habit:preview',
      kind: 'habit',
      id: 'preview',
      title: '每天读十页书',
      color: 4,
      species: 'moon',
      stage: stageOf(128),
      growth: 128,
      mood: 'happy',
      count: 2,
      target: 3,
      cadence: 'daily',
      event: {
        id: 'preview',
        title: '每天读十页书',
        createdAt: now - 128 * DAY,
        color: 4,
        cadence: 'daily',
        days: {},
        times: {},
        species: 'moon',
        target: 3,
      },
    }
  }
  if (kind === 'countdown') {
    return {
      key: 'countdown:preview',
      kind: 'countdown',
      id: 'preview',
      title: '去看海',
      color: 3,
      species: 'post',
      stage: 0,
      growth: 0,
      mood: 'idle',
      days: 12,
      next: now + 12 * DAY,
      event: {
        id: 'preview',
        title: '去看海',
        startedAt: now + 12 * DAY,
        createdAt: now - 30 * DAY,
        color: 3,
        repeat: 'none',
      },
    }
  }
  return {
    key: 'since:preview',
    kind: 'since',
    id: 'preview',
    title: '戒烟',
    color: 1,
    species: 'sprout',
    stage: stageOf(128),
    growth: 128,
    mood: 'idle',
    days: 128,
    event: {
      id: 'preview',
      title: '戒烟',
      startedAt: now - 128 * DAY,
      createdAt: now - 128 * DAY,
      color: 1,
    },
  }
}

function asSkin(value: string | null): SkinPack {
  return value === 'paper' || value === 'night' || value === 'pixel' ? value : 'jelly'
}

export function SharePreview() {
  const params = new URLSearchParams(window.location.search)
  const skin = asSkin(params.get('skin'))
  const kind = params.get('kind') ?? 'since'
  const locale: Locale = params.get('lang') === 'en' ? 'en' : 'zh'
  const withSheet = params.get('sheet') === '1'

  const view = useRef(mockView(kind)).current
  const cardRef = useRef<HTMLDivElement>(null)
  const [pngUrl, setPngUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setLocale(locale)
  }, [locale])

  useEffect(() => {
    let url: string | null = null
    let alive = true
    const host = cardRef.current
    if (!host) return undefined
    const model = buildShareModel(view, { locale })
    renderSharePng(model, themeFromElement(host))
      .then((blob) => {
        if (!alive) return
        url = URL.createObjectURL(blob)
        setPngUrl(url)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (alive) setError(String(reason))
      })
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [view, locale, skin, tick])

  const model = buildShareModel(view, { locale })

  return (
    <div className="share-preview">
      <div className="share-preview__row">
        <figure className="share-preview__col">
          <figcaption>DOM（屏幕预览）</figcaption>
          <ShareCard model={model} skin={skin} cardRef={cardRef} />
        </figure>
        <figure className="share-preview__col">
          <figcaption>Canvas → PNG 1080×1920</figcaption>
          {error ? <p className="share-preview__err">{error}</p> : null}
          {pngUrl ? <img className="share-preview__png" src={pngUrl} alt="exported share card" /> : null}
        </figure>
      </div>
      <div className="share-preview__bar">
        <span>
          skin={skin} kind={kind} lang={locale}
        </span>
        <button type="button" onClick={() => setTick((value) => value + 1)}>
          重新生成
        </button>
        {pngUrl ? (
          <a href={pngUrl} download={`preview-${kind}-${skin}.png`}>
            下载这张 PNG
          </a>
        ) : null}
      </div>
      {withSheet ? (
        <ShareSheet view={view} skin={skin} onClose={() => undefined} />
      ) : null}
    </div>
  )
}

const container = document.getElementById('root')
if (container) createRoot(container).render(<SharePreview />)
