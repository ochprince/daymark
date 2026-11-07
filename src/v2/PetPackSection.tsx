import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { t } from '../lib/i18n'
import type { ItemView } from '../lib/itemview'
import {
  CARD_PACK_ID,
  getPetPackSnapshot,
  importPetPack,
  loadPetPacks,
  removePetPack,
  subscribePetPacks,
  type PetPackMeta,
} from '../lib/petpackStore'
import { Pet } from './pets/Pet'
import type { PetArtSpecies } from './pets/petArt'
import { IconClose } from './icons'
import { StageCard } from './StageCard'

const STACK: readonly PetArtSpecies[] = ['sprout', 'moon', 'drop', 'star']
const noop = () => {}

/** 装扮里的萌宠包：导入之后在弹窗里左右滑卡片，换上就能看到预览。 */
export function PetPackSection({
  views,
  onAssign,
  onToast,
}: {
  views: readonly ItemView[]
  onAssign: (view: ItemView, packId: string | null) => void
  onToast: (text: string) => void
}) {
  const snapshot = useSyncExternalStore(subscribePetPacks, getPetPackSnapshot)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [picking, setPicking] = useState<string | null>(null)
  const picked = snapshot.packs.find((pack) => pack.id === picking) ?? null

  useEffect(() => {
    void loadPetPacks()
  }, [])

  return (
    <>
      <div className="sec-title">
        {t('dress.pets')} <small>{t('dress.pets.local')}</small>
      </div>
      <div className="card list">
        <div className="li petpack-row">
          <span className="petpack-mark" aria-hidden="true">
            <span className="petpack-stack">
              {STACK.map((species, index) => (
                <Pet key={species} species={species} stage={3} state="stand" size={34} hue={index + 1} />
              ))}
            </span>
          </span>
          <button className="grow petpack-pick" type="button" onClick={() => setPicking(CARD_PACK_ID)}>
            <span>{t('dress.pets.card')}</span>
            <small className="li-sub">{t('dress.pets.card.sub')}</small>
          </button>
        </div>
        {snapshot.packs.map((pack) => (
          <div className="li petpack-row" key={pack.id}>
            <span className="petpack-mark">
              {pack.thumbUrl ? <img className="petpack-thumb" src={pack.thumbUrl} alt="" /> : null}
            </span>
            <button className="grow petpack-pick" type="button" onClick={() => setPicking(pack.id)}>
              <span>{pack.name}</span>
              <small className="li-sub">{describe(pack)}</small>
            </button>
            {pack.builtin ? null : (
            <button
              className="petpack-remove"
              type="button"
              onClick={() => {
                void removePetPack(pack.id).then(() => {
                  for (const view of views) {
                    if (view.petPackId === pack.id) onAssign(view, null)
                  }
                  if (picking === pack.id) setPicking(null)
                  onToast(t('dress.pets.removed', { name: pack.name }))
                })
              }}
            >
              {t('dress.pets.remove')}
            </button>
            )}
          </div>
        ))}
        <button className="li" type="button" onClick={() => inputRef.current?.click()}>
          <span className="grow">
            {t('dress.pets.import')}
            <small className="li-sub">{t('dress.pets.import.hint')}</small>
          </span>
          <small>›</small>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          style={{ display: 'none' }}
          onChange={(event) => {
            const files = event.target.files ? Array.from(event.target.files) : []
            event.target.value = ''
            if (!files.length) return
            void importPetPack(files).then((result) => {
              if (!result.ok) {
                onToast(t(`dress.pets.err.${result.error}`))
                return
              }
              setPicking(result.id)
              onToast(t('dress.pets.imported', { name: result.name }))
            })
          }}
        />
      </div>
      {picking ? (
        <PackSheet
          pack={picked}
          reset={picking === CARD_PACK_ID}
          views={views}
          onAssign={onAssign}
          onToast={onToast}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </>
  )
}

function PackSheet({
  pack,
  reset = false,
  views,
  onAssign,
  onToast,
  onClose,
}: {
  pack: PetPackMeta | null
  /**
   * 以「卡片里的小伙伴」打开：预览的是没换包的那只，按钮不是「换上」而是
   * 「一键还原」——它一次改掉所有卡片，所以要点两下（4 秒内不点就恢复）。
   */
  reset?: boolean
  views: readonly ItemView[]
  onAssign: (view: ItemView, packId: string | null) => void
  onToast: (text: string) => void
  onClose: () => void
}) {
  const railRef = useRef<HTMLDivElement | null>(null)
  const [index, setIndex] = useState(0)
  const [sure, setSure] = useState(false)
  const sureTimer = useRef<number | null>(null)
  const view = views[index]
  const assigned = views.filter((item) => item.petPackId)
  const using = reset ? !view?.petPackId : !!view && view.petPackId === pack?.id
  const disabled = reset ? assigned.length === 0 : !view || using

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (sureTimer.current !== null) window.clearTimeout(sureTimer.current)
    }
  }, [onClose])

  function scrollTo(next: number) {
    const rail = railRef.current
    if (!rail) return
    rail.scrollTo({ left: next * rail.clientWidth, behavior: 'smooth' })
    setIndex(next)
  }

  function onScroll() {
    const rail = railRef.current
    const slides = rail?.querySelectorAll<HTMLElement>('.petpack-slide')
    if (!rail || !slides?.length) return
    const mid = rail.scrollLeft + rail.clientWidth / 2
    let best = 0
    let bestDistance = Number.POSITIVE_INFINITY
    slides.forEach((slide, i) => {
      const center = slide.offsetLeft + slide.offsetWidth / 2
      const distance = Math.abs(center - mid)
      if (distance < bestDistance) {
        bestDistance = distance
        best = i
      }
    })
    setIndex(best)
  }

  function act() {
    if (reset) {
      // 第一下只是问一句：这一步会把每张卡片的包一起撤掉，点错很难补回来
      if (!sure) {
        setSure(true)
        if (sureTimer.current !== null) window.clearTimeout(sureTimer.current)
        sureTimer.current = window.setTimeout(() => {
          sureTimer.current = null
          setSure(false)
        }, 4000)
        return
      }
      if (sureTimer.current !== null) window.clearTimeout(sureTimer.current)
      for (const item of assigned) onAssign(item, null)
      onToast(t('dress.pets.restoredAll'))
      onClose()
      return
    }
    if (!view || using || !pack) return
    onAssign(view, pack.id)
    onToast(t('dress.pets.assigned', { card: view.title, name: pack.name }))
  }

  const title = reset ? t('dress.pets.card') : (pack?.name ?? '')
  const previewId = reset ? CARD_PACK_ID : pack?.id
  const sub = reset
    ? t('dress.pets.restore.sub')
    : views.length > 1
      ? t('dress.pets.swipe')
      : t('dress.pets.preview')
  const label = reset
    ? sure
      ? t('dress.pets.restore.sure')
      : t('dress.pets.restore')
    : using
      ? t('dress.pets.onCard')
      : t('dress.pets.swap')

  return (
    <div className="petpack-ov">
      <div className="dim" onClick={onClose} />
      <div className="sheet petpack-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" />
        <div className="sheet-h">
          <h3>{title}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close')}>
            <IconClose />
          </button>
        </div>
        <p className="sheet-sub">{sub}</p>
        {views.length === 0 ? (
          <p className="petpack-empty">{t('dress.pets.noCards')}</p>
        ) : (
          <>
            <div className="petpack-rail" ref={railRef} onScroll={onScroll}>
              {views.map((item) => (
                <div className="petpack-slide" key={item.key}>
                  <StageCard view={item} previewPackId={previewId} onLog={noop} onPoke={noop} onProfile={noop} />
                </div>
              ))}
            </div>
            {views.length > 1 ? (
              <div className="petpack-nav">
                <button type="button" onClick={() => scrollTo(index - 1)} disabled={index <= 0}>
                  {t('dress.pets.prev')}
                </button>
                <span>
                  {index + 1} / {views.length}
                </span>
                <button type="button" onClick={() => scrollTo(index + 1)} disabled={index >= views.length - 1}>
                  {t('dress.pets.next')}
                </button>
              </div>
            ) : null}
            <button
              className={`petpack-apply${sure ? ' sure' : ''}`}
              type="button"
              disabled={disabled}
              onClick={act}
            >
              {disabled && reset ? t('dress.pets.already') : label}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function describe(pack: { frameCount: number; dance: boolean; hug: boolean }): string {
  const bits = [t('dress.pets.frames', { n: pack.frameCount })]
  if (pack.dance) bits.push(t('dress.pets.dance'))
  if (pack.hug) bits.push(t('dress.pets.hug'))
  return bits.join(' · ')
}
