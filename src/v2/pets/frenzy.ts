/**
 * 连戳三下之后该干什么。
 *
 * 没有客人：它自己走出去（debut）。
 * 有客人在场：送主人出门会变成两只抢同一个桌宠图层，而且串门这件事就白串了——
 * 所以改成「喊它俩一起玩」，主人不出门。
 */
export function frenzyKind(visiting: boolean): 'play' | 'debut' {
  return visiting ? 'play' : 'debut'
}
