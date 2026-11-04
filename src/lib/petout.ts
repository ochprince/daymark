/**
 * 桌宠在外 / 在家，要记得住。
 *
 * 它出门之后刷新一下页面，本来会乖乖回到卡片里——用户拖了半天、
 * 看它跳出去，一刷新就没了，像白玩。这里只存「在外面」这件事和它出去时是谁，
 * 颜色/形态/物种跟着一起存，刷新后不会变成卡片里临时那一只。
 */

const KEY = 'daymark.petout.v1'

export type PetOutSnapshot = {
  out: boolean
  from: string | null
  species: string | null
  stage: number | null
  hue: number | null
}

const EMPTY: PetOutSnapshot = { out: false, from: null, species: null, stage: null, hue: null }

/** 读回来的东西一律当真数据校验：本地存储被手动改坏了，也不能让页面起不来 */
export function parsePetOut(raw: string | null): PetOutSnapshot {
  if (!raw) return EMPTY
  try {
    const data = JSON.parse(raw) as Partial<PetOutSnapshot> | null
    if (!data || typeof data !== 'object') return EMPTY
    return {
      out: data.out === true,
      from: typeof data.from === 'string' ? data.from : null,
      species: typeof data.species === 'string' ? data.species : null,
      stage: typeof data.stage === 'number' ? data.stage : null,
      hue: typeof data.hue === 'number' ? data.hue : null,
    }
  } catch {
    return EMPTY
  }
}

export function getPetOut(): PetOutSnapshot {
  try {
    return parsePetOut(localStorage.getItem(KEY))
  } catch {
    return EMPTY
  }
}

export function savePetOut(next: PetOutSnapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 存储满了 / 隐私模式：记不住就算了，不影响当前这一局
  }
}
