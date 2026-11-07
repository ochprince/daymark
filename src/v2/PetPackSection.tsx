import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { t } from '../lib/i18n'
import type { ItemView } from '../lib/itemview'
import {
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

  function resetAll() {
    const assigned = views.filter((view) => view.petPackId)
    if (!assigned.length) {
      onToast(t('dress.pets.already'))
      return
    }
    for (const view of assigned) onAssign(view, null)
    onToast(t('dress.pets.restoredAll'))
  }

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
          <button className="grow petpack-pick" type="button" onClick={resetAll}>
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
          multiple
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
          {...{ webkitdirectory: '', directory: '' }}
        />
      </div>
      {picked ? (
        <PackSheet
          pack={picked}
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
  views,
  onAssign,
  onToast,
  onClose,
}: {
  pack: PetPackMeta
  views: readonly ItemView[]
  onAssign: (view: ItemView, packId: string | null) => void
  onToast: (text: string) => void
  onClose: () => void
}) {
  const railRef = useRef<HTMLDivElement | null>(null)
  const [index, setIndex] = useState(0)
  const view = views[index]

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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

  const using = !!view && view.petPackId === pack.id

  return (
    <div className="petpack-ov">
      <div className="dim" onClick={onClose} />
      <div className="sheet petpack-sheet" role="dialog" aria-modal="true" aria-label={pack.name}>
        <div className="grab" />
        <div className="sheet-h">
          <h3>{pack.name}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close')}>
            <IconClose />
          </button>
        </div>
        <p className="sheet-sub">{views.length > 1 ? t('dress.pets.swipe') : t('dress.pets.preview')}</p>
        {views.length === 0 ? (
          <p className="petpack-empty">{t('dress.pets.noCards')}</p>
        ) : (
          <>
            <div className="petpack-rail" ref={railRef} onScroll={onScroll}>
              {views.map((item) => (
                <div className="petpack-slide" key={item.key}>
                  <StageCard view={item} previewPackId={pack.id} onLog={noop} onPoke={noop} onProfile={noop} />
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
              className="petpack-apply"
              type="button"
              disabled={!view || using}
              onClick={() => {
                if (!view || using) return
                onAssign(view, pack.id)
                onToast(t('dress.pets.assigned', { card: view.title, name: pack.name }))
              }}
            >
              {using ? t('dress.pets.onCard') : t('dress.pets.swap')}
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
