import { useEffect, useState } from 'react'
import { CARD_PACK_ID, loadPetPacks, releaseLivePack, retainLivePack, type LivePack } from '../../lib/petpackStore'

/** 某张卡片指定的导入包。没指定时返回 null，继续画原来的 SVG。 */
export function useLivePack(packId: string | null | undefined): LivePack | null {
  const [live, setLive] = useState<LivePack | null>(null)

  useEffect(() => {
    void loadPetPacks()
  }, [])

  useEffect(() => {
    if (!packId || packId === CARD_PACK_ID) {
      setLive(null)
      return
    }
    const id = packId
    let cancelled = false
    let applied = false
    void retainLivePack(id).then((pack) => {
      if (cancelled) {
        releaseLivePack(id)
        return
      }
      applied = true
      setLive(pack)
    })
    return () => {
      cancelled = true
      if (applied) releaseLivePack(id)
    }
  }, [packId])

  return live
}
