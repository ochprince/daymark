import { useEffect, useRef, useState } from 'react'
import { Creature, type CreatureMood } from '../../components/Creature'
import { createBody, fallTo, hop, riseTo, step, walkTo, type CardBody } from './cardSim'
import type { PetArtSpecies } from './petArt'
import type { PetStage } from './art'

type Props = {
  species: PetArtSpecies
  stage: PetStage
  mood: 'idle' | 'happy' | 'wow' | 'sleep'
  /** 外层已经算好的姿势类：tilt / look / …，这里只负责位置 */
  poseClass: string
  size?: number
  /** 睡着或打盹时不该再走来走去 */
  still: boolean
  /** 它不在家（出门了）就停摆 */
  away: boolean
  /** 连点 / 摸摸：每加一就蹦一下 */
  pokeNonce: number
  /** 派对帽之类的附加件原样透传给 Creature */
  extra?: { hold?: 'party' }
}

/**
 * 卡片里这只的「世界」：一条地面、两堵墙（卡片左右），
 * 不踩平台、不拖拽、出不了卡片——规则和外面那只同一套物理，
 * 只是世界小得多。位置由这里负责，姿势仍交给外层的 CSS 类。
 */
export function CardPet({
  species,
  stage,
  mood,
  poseClass,
  size = 158,
  still,
  away,
  pokeNonce,
  extra,
}: Props) {
  /** 它自己挑的小姿势：坐着 / 伸懒腰 / 开心蹦，位置仍由物理那套管 */
  const [pose, setPose] = useState<'' | 'sit' | 'cheer'>('')
  /** 正在走 / 正腾空：都只是为了让 mood 跟着状态变，动画本身走外面那套 pz-* */
  const [moving, setMoving] = useState(false)
  const [airborne, setAirborne] = useState(false)
  const poseRef = useRef<'' | 'sit' | 'cheer'>('')
  poseRef.current = pose
  const hostRef = useRef<HTMLDivElement | null>(null)
  const moverRef = useRef<HTMLDivElement | null>(null)
  /** 点它的热区：跟着它一起挪，否则它走开了还只能在原地戳中 */
  const hitRef = useRef<HTMLDivElement | null>(null)
  const bodyRef = useRef<CardBody>(createBody())
  const pokeRef = useRef(pokeNonce)
  const stillRef = useRef(still)
  const awayRef = useRef(away)

  stillRef.current = still
  awayRef.current = away

  // 被摸 / 被连点：蹦一下
  useEffect(() => {
    if (pokeNonce === pokeRef.current) return
    pokeRef.current = pokeNonce
    // 打盹时戳它也要有反应：跳一下就是把它弄醒
    if (awayRef.current) return
    hop(bodyRef.current, 54 + Math.random() * 16)
  }, [pokeNonce])

  useEffect(() => {
    const host = hostRef.current
    const mover = moverRef.current
    const hit = hitRef.current
    if (!host || !mover) return undefined
    if (away) return undefined

    const wrap = host.closest<HTMLElement>('.cr-wrap')
    const cardEl = host.closest<HTMLElement>('.stage-card')
    const world = host.closest<HTMLElement>('.sc-hero') ?? wrap
    let limit = 24
    const measure = () => {
      if (!world) return
      const w = world.getBoundingClientRect().width
      limit = Math.max(8, (w - size) / 2 - 8)
    }
    measure()
    window.addEventListener('resize', measure)

    // 下面那一层：倒数日是备忘块，习惯是成长条，算它离脚下有多远
    let belowDrop = 0
    const measureBelow = () => {
      if (!wrap) return 0
      const memo = host.closest<HTMLElement>('.stage-card')?.querySelector<HTMLElement>('.c-memo, .growth')
      if (!memo) {
        belowDrop = 0
        return 0
      }
      const wr = wrap.getBoundingClientRect()
      const mr = memo.getBoundingClientRect()
      // 艺术本体的脚大致在盒子的 86% 处
      const feet = wr.top + wr.height / 2 + size * 0.36
      belowDrop = Math.max(0, Math.min(240, mr.top - feet))
      return belowDrop
    }

    let raf = 0
    let last = performance.now()
    let pxShown = Number.NaN
    let pyShown = Number.NaN
    let liftShown = -1
    /** '' = 在空地上；to = 正走过去；on = 在备忘上坐着；back = 跳回来 */
    let trip: '' | 'to' | 'on' | 'back' = ''
    let lastTrip = 0
    let walking = false
    let airing = false

    // 小动作的节拍：走两步或者蹦一下，剩下交给外层的歪头/打盹
    let timer = 0
    let poseTimer = 0
    const playPose = (next: 'sit' | 'cheer', ms: number) => {
      window.clearTimeout(poseTimer)
      setPose(next)
      poseTimer = window.setTimeout(() => setPose(''), ms)
    }
    const schedule = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const body = bodyRef.current
        const free = !stillRef.current && body.mode === 'stand' && !poseRef.current
        if (free) {
          const roll = Math.random()
          const canTrip = trip === '' && performance.now() - lastTrip > 45000 && measureBelow() > 12
          if (canTrip && roll < 0.12) {
            // 把下面那块当平台（备忘 / 成长条）：先走回空地中间，到了再往下掉
            trip = 'to'
            walkTo(body, 0)
          } else if (roll < 0.62) {
            // 每一步都迈远一点：原来只从当前位置挪一小截，
            // 一是不活泼，二是运气不好能连着往同一边走好几趟。
            // 六成走到对面，四成随便挑一边。
            const side = Math.random() < 0.6 ? -Math.sign(body.x || 1) : Math.random() < 0.5 ? -1 : 1
            const target = side * (0.35 + Math.random() * 0.65) * limit
            walkTo(body, Math.max(-limit, Math.min(limit, target)))
          } else if (roll < 0.74) {
            hop(body, 16 + Math.random() * 22)
          } else if (roll < 0.8) {
            playPose('sit', 1800 + Math.random() * 1200)
          } else if (roll < 0.92) {
            // 连着两下跳，比原地站着有意思
            hop(body, 26 + Math.random() * 26)
            window.setTimeout(() => hop(body, 18 + Math.random() * 14), 260)
          } else {
            playPose('cheer', 1600)
          }
        }
        // 睡着了就把姿势收掉，别一边打盹一边坐着
        if (stillRef.current && poseRef.current) setPose('')
        schedule()
        // 卡片里的世界小，别让它干站着：两秒多就有下一个念头
      }, 900 + Math.random() * 1500)
    }
    schedule()

    const frame = (now: number) => {
      raf = window.requestAnimationFrame(frame)
      const dt = (now - last) / 1000
      last = now

      const body = bodyRef.current
      let landed = false
      if (stillRef.current && body.mode !== 'jump') {
        // 睡着就原地趴下，不要滑回中间（那看着像被拖回去）
        body.mode = 'stand'
      } else {
        landed = step(body, limit, dt).landed
      }

      // 来回备忘那一趟
      if (trip === 'to' && body.mode === 'stand' && Math.abs(body.x) < 6 && belowDrop > 12) {
        fallTo(body, belowDrop)
        trip = 'on'
      } else if (trip === 'on' && landed && body.ground > 12) {
        // 落在下面那块上了：坐着待一会儿，再跳回空地
        playPose('sit', 2600 + Math.random() * 2200)
        window.setTimeout(() => {
          if (trip !== 'on') return
          setPose('')
          riseTo(body, 0)
          trip = 'back'
        }, 3000 + Math.random() * 1800)
      } else if (trip === 'back' && landed && body.ground === 0) {
        trip = ''
        lastTrip = performance.now()
      }
      const down = body.ground > 12 || trip === 'on' || (trip === 'to' && body.mode === 'jump')
      wrap?.classList.toggle('pet-down', down)
      // 备忘那块在 DOM 里排在空地后面，会盖住它；下去的时候把空地抬到上面
      cardEl?.classList.toggle('pet-down', down)

      if ((body.mode === 'walk') !== walking) {
        walking = body.mode === 'walk'
        setMoving(walking)
      }
      if ((body.mode === 'jump') !== airing) {
        airing = body.mode === 'jump'
        setAirborne(airing)
      }
      // 朝哪边走就朝哪边（和外面那只是一样的做法，镜像放在外层，别跟脚步动画抢 transform）
      mover.style.transform =
        `translate3d(${body.x.toFixed(1)}px, ${body.y.toFixed(1)}px, 0) scaleX(${body.dir})`
      // 热区不镜像，只跟位置
      if (hit) hit.style.transform = `translate3d(${body.x.toFixed(1)}px, ${body.y.toFixed(1)}px, 0)`
      // 跳起来影子就缩小、落回地面还原（0~1 的抬起比例，CSS 里算 scale）
      const lift = Math.min(1, Math.max(0, -body.y) / 90)
      if (Math.abs(lift - liftShown) > 0.01) {
        liftShown = lift
        wrap?.style.setProperty('--pet-lift', lift.toFixed(3))
      }
      // 打盹的 zzz 跟着它上下（下到备忘那层也贴着脑袋）
      const shownY = Math.round(body.y)
      if (shownY !== pyShown) {
        pyShown = shownY
        wrap?.style.setProperty('--pet-y', `${shownY}px`)
      }
      // 影子和手里那张纸要跟着横向挪，否则它会「离地飞行」
      const shown = Math.round(body.x)
      if (shown !== pxShown) {
        pxShown = shown
        wrap?.style.setProperty('--pet-x', `${shown}px`)
      }
    }
    raf = window.requestAnimationFrame(frame)

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(timer)
      window.clearTimeout(poseTimer)
      window.removeEventListener('resize', measure)
      wrap?.style.removeProperty('--pet-x')
      wrap?.style.removeProperty('--pet-lift')
      wrap?.style.removeProperty('--pet-y')
      wrap?.classList.remove('pet-down')
      cardEl?.classList.remove('pet-down')
    }
  }, [away, size])

  /*
   * 状态就是外面那套：走路 / 坐下 / 腾空 / 开心 / 打盹 / 站着。
   * 传成 mood 之后 svg 的 data-state 跟着变，动画全交给 pets.css 里
   * 同一批 pz-* 关键帧——所以内外看到的是同一种走法，不是两套。
   */
  const live: CreatureMood =
    still ? 'sleep' : pose === 'sit' ? 'sit' : moving ? 'walk' : airborne ? 'fall' : pose === 'cheer' ? 'cheer' : mood === 'idle' ? 'stand' : mood

  return (
    <div className="card-pet" ref={hostRef} aria-hidden="true" data-poke={pokeNonce}>
      {/* 点它的热区要跟着它走，否则它挪开了还只能在原地戳中 */}
      <div className="card-pet-hit" ref={hitRef} />
      <div
        className="card-pet-mover"
        ref={moverRef}
        style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
      >
        <Creature
          className={`cr ${poseClass} ${pose}`}
          species={species}
          stage={stage}
          mood={live}
          size={size}
          extra={extra}
        />
      </div>
    </div>
  )
}
