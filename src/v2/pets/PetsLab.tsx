import { useState } from 'react'
import type { CSSProperties } from 'react'
import { PET_SPECIES, PET_STAGES } from './art'
import type { PetSpecies, PetStage, PetState } from './art'
import { Pet } from './Pet'
import { PetLayer } from './PetLayer'
import '../pets.css'

const HUE: Record<PetSpecies, number> = { sprout: 4, moon: 2, drop: 3, star: 0 }
const SPECIES_LABEL: Record<PetSpecies, string> = {
  sprout: '芽芽',
  moon: '眠眠',
  drop: '咕噜',
  star: '跑跑',
}

/** 六个状态并排对比 */
const STATES: { key: PetState; label: string }[] = [
  { key: 'stand', label: '站 stand' },
  { key: 'walk', label: '走 walk' },
  { key: 'sit', label: '坐 sit' },
  { key: 'sleep', label: '睡 sleep' },
  { key: 'fall', label: '掉落 fall' },
  { key: 'climb', label: '攀爬 climb' },
]

const plat = (style: CSSProperties, className = 'pet-plat card') => ({ className, style })

/**
 * 宠物实验室：`?lab=pets`。
 * 四系 × 五阶段网格、六个状态并排，以及一个真的装在物理层里的实例。
 */
export function PetsLab() {
  const [species, setSpecies] = useState<PetSpecies>('sprout')
  const [stage, setStage] = useState<PetStage>(3)

  return (
    <div className="pets-lab" data-skin="jelly">
      <div className="pets-lab-inner">
        <header className="pets-lab-head">
          <h1>活的萌宠 · v3</h1>
          <p>
            纯 SVG 造型 + 物理层。点格子切换下面那只；在舞台上可以点它、拖它、把它扔出去。
          </p>
        </header>

        <section className="pets-lab-sec">
          <h2>
            四系 × 五阶段 <small>{PET_SPECIES.length} × {PET_STAGES.length} = {PET_SPECIES.length * PET_STAGES.length} 种造型</small>
          </h2>
          <div className="pet-grid">
            {PET_SPECIES.map((sp) => (
              <div className="pet-row" key={sp}>
                <div className="pet-row-name">
                  {SPECIES_LABEL[sp]}
                  <small>{sp}</small>
                </div>
                {PET_STAGES.map((st) => {
                  const on = sp === species && st === stage
                  return (
                    <button
                      key={st}
                      type="button"
                      className={`pet-cell${on ? ' is-on' : ''}`}
                      onClick={() => {
                        setSpecies(sp)
                        setStage(st)
                      }}
                    >
                      <Pet species={sp} stage={st} state="stand" size={64} hue={HUE[sp]} />
                      <b>{st}</b>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </section>

        <section className="pets-lab-sec">
          <h2>
            六个状态 <small>站 · 走 · 坐 · 睡 · 掉落 · 攀爬</small>
          </h2>
          <div className="pet-states">
            {STATES.map((item) => (
              <div className="pet-state" key={item.key}>
                <Pet species={species} stage={stage} state={item.key} size={88} hue={HUE[species]} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="pets-lab-sec">
          <h2>
            装到层里 <small>{SPECIES_LABEL[species]} · 阶段 {stage}</small>
          </h2>
          <div className="pet-stage">
            <div className="pet-stage-status">
              <b>44px</b> 状态栏（气泡不越界）
            </div>
            <div {...plat({ top: '92px', left: '4%', right: '8%', height: '118px' })}>
              <span className="pet-stage-tag">.card</span>
            </div>
            <button
              type="button"
              className="btn pet-plat"
              style={{ position: 'absolute', top: '250px', left: '12%', height: '50px' }}
              onClick={(e) => e.stopPropagation()}
            >
              按一下也没事
            </button>
            <div {...plat({ top: '330px', left: '34%', right: '4%', height: '106px' })}>
              <span className="pet-stage-tag">.card</span>
            </div>
            <nav className="tabbar">
              <button type="button" className="is-on">
                今天
              </button>
              <button type="button">藏馆</button>
            </nav>
            <PetLayer species={species} stage={stage} hue={HUE[species]} size={92} />
          </div>
          <p className="pets-lab-hint">
            重力 2200 px/s² · 平台扫描 .pet-plat / .card / .btn / .tabbar · 拖 120px 松手会抛出去，越界反弹 · 点一下撒娇并说话
          </p>
        </section>
      </div>
    </div>
  )
}
