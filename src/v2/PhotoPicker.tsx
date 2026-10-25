/**
 * 换一张 / 去掉：一行行内控件，放在档案页设置或新建流程的第 2 步里。
 *
 * 只负责「选图 → 压缩入库 → 把 id 交出去」，存不存 id 由调用方决定（onChange）。
 * 图存不进去（不支持 / 压缩失败 / 配额满）时给一句 toast，然后把 id 当没有，
 * 绝不挡住后面的「记一件事」。
 *
 * 注意：这里不删旧 blob —— 面板可能被取消，事件还指着旧 photoId。
 * 清理孤儿图片交给 photos.prunePhotos(当前所有 photoId)。
 */
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { t } from '../lib/i18n'
import { getPhotoUrl, savePhoto } from '../lib/photos'
import './photo.css'

export type PhotoPickerProps = {
  /** 已经存下的相片 id */
  photoId?: string
  /** 选好 / 去掉之后回调；null 表示没有照片 */
  onChange: (id: string | null) => void
  /** 失败时的一句话（走 App 现有的 toast），不给就静默 */
  onToast?: (msg: string) => void
}

export function PhotoPicker({ photoId, onChange, onToast }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const alive = useRef(true)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // photoId 变了就去取 objectURL（photos.ts 里按 id 缓存，换回来也不会重复造）
  useEffect(() => {
    if (!photoId) {
      setUrl(null)
      return undefined
    }

    let cancelled = false
    void getPhotoUrl(photoId).then((next) => {
      if (!cancelled && alive.current) setUrl(next)
    })

    return () => {
      cancelled = true
    }
  }, [photoId])

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    // 清空 value：同一张照片再选一次也要能触发 change
    event.target.value = ''
    if (!file) return

    setBusy(true)
    try {
      const id = await savePhoto(file)
      if (!alive.current) return

      if (!id) {
        onToast?.(t('photo.failed'))
        return
      }

      const next = await getPhotoUrl(id)
      if (!alive.current) return
      setUrl(next)
      onChange(id)
      // 图存进去了但预览拿不到：让调用方仍持有 id，下次进来会重试
      if (!next) onToast?.(t('photo.failed'))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  function remove() {
    if (busy) return
    setUrl(null)
    onChange(null)
  }

  const label = busy ? t('photo.loading') : url ? t('photo.change') : t('photo.pick')

  return (
    <div className="photo-pick">
      <div className="photo-pick__row">
        {url ? (
          <span className="photo-pick__thumb">
            <img src={url} alt="" decoding="async" />
          </span>
        ) : null}

        <button
          className="photo-pick__btn"
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-busy={busy}
        >
          {label}
        </button>

        {photoId || url ? (
          <button className="photo-pick__remove" type="button" onClick={remove} disabled={busy}>
            {t('photo.remove')}
          </button>
        ) : null}
      </div>

      <p className="photo-pick__hint">{t('photo.hint')}</p>

      <input
        ref={inputRef}
        className="photo-pick__input"
        type="file"
        accept="image/*"
        onChange={(event) => {
          void pick(event)
        }}
        tabIndex={-1}
        aria-label={t('photo.pick')}
      />
    </div>
  )
}
