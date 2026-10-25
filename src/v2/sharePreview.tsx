/**
 * 分享卡片的独立预览页（构建会输出到 dist/share-preview.html，方便用静态服务器验收）。
 *
 * 打开方式：
 *   npm run dev
 *   open http://localhost:5190/share-preview.html?skin=jelly&kind=since&lang=zh&tpl=ticket
 *
 * 左栏是屏幕上那一版（ShareCard），右栏是 Canvas 画出来、真正会导出成 PNG 的那一版
 * （renderSharePng）。两栏并排就是为了肉眼确认两边长得一样。
 * 参数：skin=jelly|paper|night|pixel，kind=since|habit|countdown，lang=zh|en，
 *       tpl=sticker|ticket|photo，photo=1（造一张示例相片写进 IndexedDB），sheet=1（打开弹层）。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../skins/tokens.css'
import '../skins/custom.css'
import { stageOf } from '../lib/growth'
import { setLocale, type Locale } from '../lib/i18n'
import type { ItemView } from '../lib/itemview'
import { savePhoto } from '../lib/photos'
import { SHARE_TEMPLATES, buildShareModel } from '../lib/sharecard'
import type { ShareTemplate } from '../lib/sharecard'
import type { SkinPack } from '../lib/skin'
import { ShareCard } from './ShareCard'
import { ShareSheet } from './ShareSheet'
import { renderSharePng, themeFromElement } from './share'
import './sharecard.css'

const DAY = 86_400_000

/** 造一件示例事项：跟首页结构一致，方便对照 */
function mockView(kind: string, photoId: string | null): ItemView {
  const now = Date.now()
  const photo = photoId ?? undefined
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
        photoId: photo,
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
        photoId: photo,
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
      photoId: photo,
    },
  }
}

function asSkin(value: string | null): SkinPack {
  return value === 'paper' || value === 'night' || value === 'pixel' ? value : 'jelly'
}

function asTemplate(value: string | null): ShareTemplate {
  return value === 'ticket' || value === 'photo' ? value : 'sticker'
}

/**
 * 造一张示例相片并走真实的 savePhoto 管线写进 IndexedDB。
 * 这样「相片」模板读的是真库里的图（getPhotoUrl → objectURL），不是硬塞的 data URL。
 */
async function seedDemoPhoto(): Promise<string | null> {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 1600
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const sky = ctx.createLinearGradient(0, 0, 700, 1600)
  sky.addColorStop(0, '#1f2f5c')
  sky.addColorStop(0.45, '#6b4a86')
  sky.addColorStop(0.74, '#d9825f')
  sky.addColorStop(1, '#f4c98a')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 1200, 1600)

  // 一点亮块，方便看「压暗之后白字还读不读得清」
  ctx.globalAlpha = 0.22
  ctx.fillStyle = '#fff8e8'
  for (let index = 0; index < 26; index += 1) {
    const x = ((index * 197) % 1200) + 40
    const y = ((index * 331) % 1200) + 60
    ctx.beginPath()
    ctx.arc(x, y, 18 + (index % 5) * 12, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
  ctx.font = '700 92px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('DEMO PHOTO', 600, 760)
  ctx.font = '600 44px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
  ctx.fillText('1200 × 1600 · cover', 600, 840)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.92)
  })
  if (!blob) return null
  return savePhoto(blob)
}

export function SharePreview() {
  const params = new URLSearchParams(window.location.search)
  const skin = asSkin(params.get('skin'))
  const kind = params.get('kind') ?? 'since'
  const locale: Locale = params.get('lang') === 'en' ? 'en' : 'zh'
  const withSheet = params.get('sheet') === '1'
  const wantPhoto = params.get('photo') === '1'
  const [template, setTemplate] = useState<ShareTemplate>(asTemplate(params.get('tpl')))
  const [photoId, setPhotoId] = useState<string | null>(null)

  const cardRef = useRef<HTMLDivElement>(null)
  const [pngUrl, setPngUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const view = useMemo(() => mockView(kind, photoId), [kind, photoId])

  useEffect(() => {
    setLocale(locale)
  }, [locale])

  useEffect(() => {
    if (!wantPhoto) return undefined
    let alive = true
    void seedDemoPhoto().then((id) => {
      if (alive) setPhotoId(id)
    })
    return () => {
      alive = false
    }
  }, [wantPhoto])

  useEffect(() => {
    let url: string | null = null
    let alive = true
    const host = cardRef.current
    if (!host) return undefined
    const model = buildShareModel(view, { locale })
    renderSharePng(model, themeFromElement(host), template, { locale })
      .then((rendered) => {
        if (!alive) return
        url = URL.createObjectURL(rendered.blob)
        setPngUrl(url)
        setError(rendered.fellBack ? `fellBack → ${rendered.template}` : null)
      })
      .catch((reason: unknown) => {
        if (alive) setError(String(reason))
      })
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [view, locale, skin, template, tick])

  const model = buildShareModel(view, { locale })

  return (
    <div className="share-preview">
      <div className="share-preview__row">
        <figure className="share-preview__col">
          <figcaption>DOM（屏幕预览 · {template}）</figcaption>
          <ShareCard model={model} skin={skin} cardRef={cardRef} template={template} />
        </figure>
        <figure className="share-preview__col">
          <figcaption>Canvas → PNG 1080×1920</figcaption>
          {error ? <p className="share-preview__err">{error}</p> : null}
          {pngUrl ? <img className="share-preview__png" src={pngUrl} alt="exported share card" /> : null}
        </figure>
      </div>
      <div className="share-preview__bar">
        <span>
          skin={skin} kind={kind} lang={locale} photo={photoId ? 'yes' : 'no'}
        </span>
        {SHARE_TEMPLATES.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={template === item}
            onClick={() => setTemplate(item)}
          >
            {item}
          </button>
        ))}
        <button type="button" onClick={() => setTick((value) => value + 1)}>
          重新生成
        </button>
        {pngUrl ? (
          <a href={pngUrl} download={`preview-${kind}-${skin}-${template}.png`}>
            下载这张 PNG
          </a>
        ) : null}
      </div>
      {withSheet ? (
        <ShareSheet view={view} skin={skin} initialTemplate={template} onClose={() => undefined} />
      ) : null}
    </div>
  )
}

const container = document.getElementById('root')
if (container) createRoot(container).render(<SharePreview />)
