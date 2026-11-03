/**
 * 小纸条：小伙伴偶尔塞给你的一句话。
 *
 * 规则（docs/plan-v2.md §6.9）：
 *   · 距上一张纸条 ≥ 3 天
 *   · 这个自然周里已经出了 < 2 张
 *   · 随机命中 30%
 * 三者都满足，舞台上那只手里就会多一张折起来的纸条 —— 点了才展开，不自动弹窗。
 *
 * 文案不重复：按已收张数往后取，取完从头循环。
 * 这里全是纯函数，随机数从外面传进来，测试才好写。
 */

/** 纸条文案：语气是小伙伴本人在说，不说教、不喊口号 */
export const NOTE_POOL: readonly string[] = [
  '今天的你，比自己以为的更努力一点。',
  '我数过了，你已经坚持了很久，别装作没看见。',
  '如果今天不太顺，就当我陪你坐一会儿。',
  '明天的事明天再说，先把今天过完。',
  '我又长大了一点点，都是你在喂我。',
  '你不在的时候，我把这里擦干净了。',
  '有时候慢一点也没关系，我又不会跑。',
  '想到你明天还会来，我今天就很开心。',
  '你说过的话我都记着，包括那些没说完的。',
  '累了就抬头看看，我一直在这儿。',
  '你不用一直很厉害，做自己就行。',
  '这一张，藏在今天里，等你发现。',
]

const DAY = 86_400_000

/** 自然周的编号（周一为一周之始），用来算「这周已经出了几张」 */
export function weekIndex(now: number): number {
  const date = new Date(now)
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  // getDay：周日 0，周一 1 …… 先把日期退回本周一
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return Math.floor(monday.getTime() / DAY)
}

export type NoteGate = {
  notes: readonly { at: number }[]
  notesThisWeek?: { week: number; count: number }
}

/**
 * 这次进前台，要不要给一张新纸条。
 * random 传 0–1 的随机数，便于测试。
 */
export function shouldOfferNote(state: NoteGate, now: number, random = Math.random): boolean {
  const last = state.notes[0]?.at
  if (typeof last === 'number' && now - last < 3 * DAY) return false

  const week = weekIndex(now)
  const thisWeek = state.notesThisWeek
  if (thisWeek && thisWeek.week === week && thisWeek.count >= 2) return false

  return random() < 0.3
}

/** 第 n 张纸条的文案：按已收数量往后取，取完循环 */
export function noteTextAt(index: number): string {
  const size = NOTE_POOL.length
  if (size === 0) return ''
  const at = ((Math.trunc(index) % size) + size) % size
  return NOTE_POOL[at]
}

/** 下一张纸条：第 (已收张数 + 1) 张 */
export function nextNoteText(state: { notes: readonly unknown[] }): string {
  return noteTextAt(state.notes.length)
}

/** 收下这张之后，本周计数怎么变 */
export function bumpWeek(
  thisWeek: { week: number; count: number } | undefined,
  now: number,
): { week: number; count: number } {
  const week = weekIndex(now)
  if (thisWeek && thisWeek.week === week) return { week, count: thisWeek.count + 1 }
  return { week, count: 1 }
}
