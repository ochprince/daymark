/**
 * 分享弹层：模板切换 + 预览 + 「保存图片」/「分享」。
 *
 * 用法（主控在 AppV2 里挂一个 state 就行，细节见 docs/share/INTEGRATION.md）：
 *
 *   {sheet === 'share' && focus ? (
 *     <ShareSheet view={focus} now={now} onClose={() => setSheet(null)} onShared={…} />
 *   ) : null}
 *
 * 三套模板（贴纸 / 相片 / 票根）由这里切换：tab 一改，预览（ShareCard 的 class 变体）
 * 和导出（renderSharePng 的 template 参数）同时跟着变，两边不会串。
 * 没有相片的事项，「相片」tab 置灰，点不动，并给一句提示。
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ItemView } from '../lib/itemview'
import { getLocale, subscribeLocale } from '../lib/i18n'
import { SHARE_TEMPLATES, buildShareModel, shareCaption, shareCopy, shareFileName } from '../lib/sharecard'
import type { ShareTemplate, ShareTextKey } from '../lib/sharecard'
import { getSkin, subscribe as subscribeSkin } from '../lib/skin'
import type { SkinPack } from '../lib/skin'
import { ShareCard } from './ShareCard'
import { canShareImage, downloadPng, shareCardPng, renderSharePng, themeFromElement } from './share'
import type { ShareOutcome } from './share'

export type ShareSheetProps = {
  /** 当前焦点事项 */
  view: ItemView
  /** 「今天」取哪一刻，跟 AppV2 里的 now 一致 */
  now?: number
  onClose: () => void
  /** 真的保存/分享成功之后回调一次（主控在这里解锁 share 徽章） */
  onShared?: () => void
  /** 强制某套皮肤（预览页用）；不给就跟当前皮肤 */
  skin?: SkinPack
  /** 打开时默认用哪套模板（默认贴纸） */
  initialTemplate?: ShareTemplate
}

type Phase = 'idle' | 'rendering'

/** 模板 → 文案 key（不用拼字符串，缺 key 时 tsc 会报） */
const TPL_LABEL: Record<ShareTemplate, ShareTextKey> = {
  sticker: 'share.tpl.sticker',
  photo: 'share.tpl.photo',
  ticket: 'share.tpl.ticket',
}

export function ShareSheet({ view, now, onClose, onShared, skin, initialTemplate = 'sticker' }: ShareSheetProps) {
  const locale = useSyncExternalStore(subscribeLocale, getLocale)
  const currentSkin = useSyncExternalStore(subscribeSkin, getSkin)
  const cardRef = useRef<HTMLDivElement>(null)
  const blobRef = useRef<{ blob: Blob; cacheKey: string } | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [template, setTemplate] = useState<ShareTemplate>(initialTemplate)

  const model = buildShareModel(view, { now, locale })
  const caption = shareCaption(view)[locale]
  const hasPhoto = Boolean(model.photoId)
  const fileName = shareFileName(view, now, template)
  // 同一张卡只画一次：模板、文件名（含日期）任一变就重画
  const cacheKey = `${template}|${fileName}`

  // Esc 关闭：跟其它弹层一个手感
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // 换了一件事就没必要留着上一张图，模板也退回贴纸
  useEffect(() => {
    blobRef.current = null
    setMessage(null)
    setTemplate(initialTemplate)
  }, [view.key, initialTemplate])

  // 没有相片却停在相片模板上（例如刚把照片删了）：退回贴纸
  useEffect(() => {
    if (!hasPhoto && template === 'photo') setTemplate('sticker')
  }, [hasPhoto, template])

  /** 同一张卡只画一次，保存和分享共用 */
  const ensureBlob = useCallback(async (): Promise<Blob> => {
    const cached = blobRef.current
    if (cached && cached.cacheKey === cacheKey) return cached.blob
    const host = cardRef.current
    if (!host) throw new Error('share card is not mounted')
    const rendered = await renderSharePng(model, themeFromElement(host), template, { locale })
    // 相片模板没有相片时 renderSharePng 会画贴纸并在返回值里说明，这里同步回 tab 与提示
    if (rendered.fellBack) {
      setTemplate(rendered.template)
      setMessage(shareCopy('share.tpl.photoOff', undefined, locale))
    }
    blobRef.current = { blob: rendered.blob, cacheKey }
    return rendered.blob
  }, [cacheKey, locale, model, template])

  /** 分享结果 → 提示文案 + 算不算「成功」 */
  const describeOutcome = useCallback(
    (outcome: ShareOutcome, shareable: boolean): { text: string | null; success: boolean } => {
      if (outcome === 'shared') return { text: shareCopy('share.shared', undefined, locale), success: true }
      if (outcome === 'dismissed') return { text: null, success: false }
      if (outcome === 'failed') return { text: shareCopy('share.failed', undefined, locale), success: false }
      // downloaded：能分享却没弹面板 → 说明系统不给文件；完全不能分享 → 给长按提示
      return {
        text: shareCopy(shareable ? 'share.saved' : 'share.noShare', undefined, locale),
        success: true,
      }
    },
    [locale],
  )

  const run = useCallback(
    async (action: 'save' | 'share') => {
      if (phase !== 'idle') return
      setPhase('rendering')
      setMessage(null)
      try {
        const blob = await ensureBlob()
        if (action === 'save') {
          downloadPng(blob, fileName)
          setMessage(shareCopy('share.saved', undefined, locale))
          onShared?.()
        } else {
          const shareable = canShareImage(new File([blob], fileName, { type: 'image/png' }))
          const result = describeOutcome(await shareCardPng(blob, fileName, caption), shareable)
          if (result.text) setMessage(result.text)
          if (result.success) onShared?.()
        }
      } catch {
        setMessage(shareCopy('share.failed', undefined, locale))
      } finally {
        setPhase('idle')
      }
    },
    [caption, describeOutcome, ensureBlob, fileName, locale, onShared, phase],
  )

  const busy = phase === 'rendering'

  return (
    <div
      className="share-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={shareCopy('share.title', undefined, locale)}
      onClick={onClose}
    >
      <div className="share-overlay__top" onClick={(event) => event.stopPropagation()}>
        <span className="share-overlay__title">{shareCopy('share.title', undefined, locale)}</span>
        <button
          type="button"
          className="share-overlay__x"
          aria-label={shareCopy('share.close', undefined, locale)}
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="share-overlay__stage" onClick={(event) => event.stopPropagation()}>
        <ShareCard
          model={model}
          skin={skin ?? currentSkin.pack}
          cardRef={cardRef}
          template={template}
        />
      </div>

      <div
        className="share-overlay__tpls"
        role="tablist"
        aria-label={shareCopy('share.title', undefined, locale)}
        onClick={(event) => event.stopPropagation()}
      >
        {SHARE_TEMPLATES.map((item) => {
          const off = item === 'photo' && !hasPhoto
          return (
            <button
              key={item}
              type="button"
              role="tab"
              className="share-overlay__tpl"
              data-tpl={item}
              aria-selected={template === item}
              disabled={off || busy}
              title={off ? shareCopy('share.tpl.photoOff', undefined, locale) : undefined}
              onClick={() => {
                // 置灰的相片 tab 不响应，防止预览和导出各停一套
                if (off) return
                blobRef.current = null
                setTemplate(item)
                setMessage(null)
              }}
            >
              {shareCopy(TPL_LABEL[item], undefined, locale)}
            </button>
          )
        })}
      </div>

      <p className="share-overlay__hint">{shareCopy('share.hint', undefined, locale)}</p>
      {hasPhoto ? null : (
        <p className="share-overlay__note">{shareCopy('share.tpl.photoOff', undefined, locale)}</p>
      )}

      <div className="share-overlay__acts" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="share-overlay__btn ghost"
          disabled={busy}
          onClick={() => void run('save')}
        >
          {busy ? shareCopy('share.rendering', undefined, locale) : shareCopy('share.save', undefined, locale)}
        </button>
        <button
          type="button"
          className="share-overlay__btn"
          disabled={busy}
          onClick={() => void run('share')}
        >
          {shareCopy('share.share', undefined, locale)}
        </button>
      </div>

      <div className="share-overlay__toast" role="status" aria-live="polite">
        {message ?? ''}
      </div>
    </div>
  )
}
