import type { ItemView } from '../../lib/itemview'
import { Creature } from '../../components/Creature'
import { PackSprite } from './PackSprite'
import { useLivePack } from './useLivePack'

/**
 * 列表 / 档案里的小头像。
 *
 * 这张卡换了导入包之后，主卡片是 Blue，列表里却还画着原来那只——
 * 一眼看过去像没换成功。所以凡是要显示「这只长什么样」的地方都走这里：
 * 有包就画包的 stand 帧，没有才回到默认小伙伴。
 */
export function PetThumb({
  view,
  size,
  pose = 'stand',
}: {
  view: ItemView
  size: number
  pose?: string
}) {
  const live = useLivePack(view.petPackId)
  /*
   * Shimeji 的序列帧四周留白很大（128 的图里人只占中间一条），
   * 同一 size 摆进列表，会比默认那只小一圈。所以包要放大一点，
   * 小头像放得更多，档案头像只补一点点，免得顶出圆角框。
   */
  if (live) return <PackSprite pose={pose} frames={live.frames} size={Math.round(size * (size < 60 ? 1.3 : 1.12))} />
  return (
    <Creature
      species={view.species}
      stage={Math.min(4, view.stage) as 0 | 1 | 2 | 3 | 4}
      size={size}
    />
  )
}
