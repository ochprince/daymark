/*
 * 小伙伴（养成角色）的 SVG 生成器。
 *
 * 一只小伙伴 = 身体（圆团 / 水滴 / 蛋）+ 表情 + 按物种和形态叠加的头饰。
 * 颜色全部走 CSS 变量：--c（主色）、--c2（深一档）、--cr-line（描边），
 * 所以换风格包时不用重画，只换令牌。
 *
 *   creature({ species, stage, mood, size, extra })
 *     species  sprout 芽芽 / moon 眠眠 / drop 咕噜 / star 跑跑 / post 信信
 *     stage    0 壳宝宝 · 1 (3 天) · 2 (7 天) · 3 (30 天) · 4 (100 天)；'egg' 表示还没孵出来
 *     mood     idle / happy / sleep / wow
 *     extra    { pumpkin, crack (0-3), hold: 'letter'|'gift'|'party', silhouette }
 */
/** 角色与徽章的 SVG 生成器（从 docs/prototype-v2/creatures.js 移植）。
 * 颜色全部走 CSS 变量，换风格包不用重画；类型声明见 creature-art.d.ts。
 * 这份是纯函数、只产出静态字符串，用 dangerouslySetInnerHTML 渲染是安全的。
 */

  const L = 'var(--cr-line)'
  const LW = 'var(--cr-lw)'
  let uid = 0

  const BODY = {
    round: 'M100 64 C142 64 166 96 166 130 C166 162 138 182 100 182 C62 182 34 162 34 130 C34 96 58 64 100 64 Z',
    drop: 'M100 44 C114 70 166 98 166 132 C166 162 138 182 100 182 C62 182 34 162 34 132 C34 98 86 70 100 44 Z',
    egg: 'M100 50 C138 50 158 100 158 136 C158 166 133 186 100 186 C67 186 42 166 42 136 C42 100 62 50 100 50 Z',
  }

  const SCALE = [0.74, 0.82, 0.88, 0.94, 1]

  function star(cx, cy, r, inner = 0.5, rot = 0) {
    let d = ''
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5 + rot
      const rr = i % 2 ? r * inner : r
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1)
    }
    return d + 'Z'
  }

  const stroke = (w = LW) => `stroke="${L}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`

  function flower(cx, cy, r, petal = 'var(--petal)') {
    let s = ''
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
      s += `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="${r * 0.82}" fill="${petal}" ${stroke(3)}/>`
    }
    return s + `<circle cx="${cx}" cy="${cy}" r="${r * 0.7}" fill="var(--pistil)" ${stroke(3)}/>`
  }

  function sparkle(cx, cy, r, fill = 'var(--spark)') {
    return `<path d="M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r}Z" fill="${fill}" class="cr-spark"/>`
  }

  /** 刚孵出来的那片蛋壳 */
  const shellCap = `<path d="M62 86 L70 72 L79 82 L88 68 L98 80 L108 67 L117 80 L127 69 L136 84 C132 52 66 52 62 86 Z" fill="var(--shell)" ${stroke(3.5)}/>`

  /** 返回 { back, front }：back 画在身体后面（耳朵、彩虹），front 画在前面 */
  function headpiece(species, stage) {
    let back = ''
    let front = ''
    if (stage === 0) return { back, front: shellCap }

    if (species === 'sprout') {
      const top = [0, 46, 40, 34, 32][stage]
      front += `<path d="M100 68 C100 60 99 ${top + 8} 100 ${top}" fill="none" ${stroke(4)}/>`
      if (stage === 1) {
        front += `<path d="M100 54 C104 40 120 36 128 41 C124 52 110 58 100 54 Z" fill="var(--leaf)" ${stroke(3.5)}/>`
      } else {
        front += `<path d="M100 52 C92 38 74 36 68 42 C74 54 90 58 100 52 Z" fill="var(--leaf)" ${stroke(3.5)}/>`
        front += `<path d="M100 47 C108 32 128 30 134 37 C128 50 110 54 100 47 Z" fill="var(--leaf)" ${stroke(3.5)}/>`
      }
      if (stage >= 3) front += flower(100, 26, 9)
      if (stage === 4) {
        front += flower(64, 84, 6) + flower(136, 84, 6)
        front += sparkle(40, 60, 9) + sparkle(162, 50, 7)
      }
    }

    if (species === 'moon') {
      if (stage === 1) {
        front += `<path d="M100 66 L100 50" ${stroke(4)}/>`
        front += `<path d="M108 26 A15 15 0 1 0 108 56 A20 20 0 0 1 108 26 Z" fill="var(--gold)" ${stroke(3.5)}/>`
      } else {
        // 睡帽：盖住头顶，帽尖往右垂
        front += `<path d="M60 92 C58 62 82 44 108 44 C134 44 152 62 162 92 C166 104 168 110 160 112 C150 96 140 84 124 80 C104 76 80 82 60 92 Z" fill="var(--c2)" ${stroke(3.5)}/>`
        front += `<path d="M58 92 C84 78 122 74 150 88" fill="none" stroke="var(--band)" stroke-width="9" stroke-linecap="round"/>`
        front += `<circle cx="160" cy="114" r="10" fill="var(--band)" ${stroke(3.5)}/>`
        if (stage >= 3) front += `<path d="${star(104, 60, 10)}" fill="var(--gold)" ${stroke(3)}/>`
        if (stage === 4) {
          front += `<path d="${star(46, 58, 8)}" fill="var(--gold)" ${stroke(3)}/>`
          front += `<path d="${star(30, 92, 5)}" fill="var(--gold)" ${stroke(2.5)}/>`
          front += sparkle(170, 56, 8) + sparkle(150, 30, 5)
        }
      }
    }

    if (species === 'drop') {
      const drop = (x, y, s) =>
        `<path d="M${x} ${y - 12 * s} C${x + 4 * s} ${y - 4 * s} ${x + 8 * s} ${y} ${x + 8 * s} ${y + 5 * s} C${x + 8 * s} ${y + 10 * s} ${x + 4 * s} ${y + 13 * s} ${x} ${y + 13 * s} C${x - 4 * s} ${y + 13 * s} ${x - 8 * s} ${y + 10 * s} ${x - 8 * s} ${y + 5 * s} C${x - 8 * s} ${y} ${x - 4 * s} ${y - 4 * s} ${x} ${y - 12 * s} Z" fill="var(--c)" ${stroke(3)}/>`
      if (stage >= 1) front += drop(138, 46, 1)
      if (stage >= 2) {
        front += drop(58, 40, 0.75)
        front += `<path d="M72 90 C80 80 90 88 100 78 C110 88 120 80 128 90" fill="none" stroke="var(--foam)" stroke-width="6" stroke-linecap="round"/>`
      }
      if (stage >= 3) {
        front += `<circle cx="40" cy="84" r="8" fill="var(--bubble)" ${stroke(3)}/><circle cx="30" cy="108" r="5" fill="var(--bubble)" ${stroke(2.5)}/>`
        front += `<circle cx="164" cy="80" r="6" fill="var(--bubble)" ${stroke(2.5)}/>`
      }
      if (stage === 4) {
        back += `<path d="M22 140 A78 78 0 0 1 178 140" fill="none" stroke="var(--rb1)" stroke-width="9"/>`
        back += `<path d="M31 140 A69 69 0 0 1 169 140" fill="none" stroke="var(--rb2)" stroke-width="9"/>`
        back += `<path d="M40 140 A60 60 0 0 1 160 140" fill="none" stroke="var(--rb3)" stroke-width="9"/>`
      }
    }

    if (species === 'star') {
      if (stage === 1) {
        front += `<path d="M100 66 L100 50" ${stroke(4)}/>`
        front += `<path d="${star(100, 40, 13)}" fill="var(--gold)" ${stroke(3.5)}/>`
      } else {
        back += `<path d="${star(62, 78, 22, 0.52, -0.25)}" fill="var(--c)" ${stroke()}/>`
        back += `<path d="${star(138, 78, 22, 0.52, 0.25)}" fill="var(--c)" ${stroke()}/>`
      }
      if (stage >= 3) {
        front += `<path d="M38 112 C70 98 130 98 162 112" fill="none" stroke="var(--band)" stroke-width="12" stroke-linecap="round"/>`
        front += `<path d="M92 103 L100 112 L108 103" fill="none" stroke="var(--c2)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
      }
      if (stage === 4) {
        front += `<path d="M76 74 L78 48 L90 62 L100 42 L110 62 L122 48 L124 74 Z" fill="var(--gold)" ${stroke(3.5)}/>`
        front += `<circle cx="100" cy="62" r="4" fill="var(--c2)"/>`
        front += sparkle(30, 70, 8) + sparkle(172, 64, 9)
      }
    }

    return { back, front }
  }

  function face(mood, cy, sx = 20, small = false) {
    const xL = 100 - sx
    const xR = 100 + sx
    const k = small ? 0.8 : 1
    let s = ''
    if (mood === 'sleep') {
      s += `<path d="M${xL - 7 * k} ${cy} Q${xL} ${cy + 6 * k} ${xL + 7 * k} ${cy}" fill="none" ${stroke(4)}/>`
      s += `<path d="M${xR - 7 * k} ${cy} Q${xR} ${cy + 6 * k} ${xR + 7 * k} ${cy}" fill="none" ${stroke(4)}/>`
      s += `<ellipse cx="100" cy="${cy + 15}" rx="3.5" ry="4" fill="var(--cr-line)"/>`
    } else if (mood === 'happy') {
      s += `<path d="M${xL - 7 * k} ${cy + 3} Q${xL} ${cy - 7 * k} ${xL + 7 * k} ${cy + 3}" fill="none" ${stroke(4.5)}/>`
      s += `<path d="M${xR - 7 * k} ${cy + 3} Q${xR} ${cy - 7 * k} ${xR + 7 * k} ${cy + 3}" fill="none" ${stroke(4.5)}/>`
      s += `<path d="M90 ${cy + 11} Q100 ${cy + 26} 110 ${cy + 11} Z" fill="var(--mouth)" ${stroke(3.5)}/>`
    } else {
      const ry = mood === 'wow' ? 8.5 : 7.5
      const rx = mood === 'wow' ? 7.5 : 5.8
      s += `<g class="cr-eyes"><ellipse cx="${xL}" cy="${cy}" rx="${rx * k}" ry="${ry * k}" fill="var(--cr-line)"/><ellipse cx="${xR}" cy="${cy}" rx="${rx * k}" ry="${ry * k}" fill="var(--cr-line)"/>`
      s += `<circle cx="${xL + 2}" cy="${cy - 3}" r="${2.3 * k}" fill="#fff"/><circle cx="${xR + 2}" cy="${cy - 3}" r="${2.3 * k}" fill="#fff"/></g>`
      s +=
        mood === 'wow'
          ? `<ellipse cx="100" cy="${cy + 17}" rx="5" ry="6" fill="var(--mouth)" ${stroke(3)}/>`
          : `<path d="M93 ${cy + 13} Q100 ${cy + 19} 107 ${cy + 13}" fill="none" ${stroke(3.5)}/>`
    }
    s += `<ellipse cx="${xL - 13}" cy="${cy + 13}" rx="8" ry="4.6" fill="var(--blush)" class="cr-blush"/>`
    s += `<ellipse cx="${xR + 13}" cy="${cy + 13}" rx="8" ry="4.6" fill="var(--blush)" class="cr-blush"/>`
    return s
  }

  /** 信信（倒数日的信使）：帽子 + 手里拿着信 / 礼物 / 派对帽 */
  function post(mood, hold, n) {
    let s = ''
    const body = BODY.round
    s += `<ellipse cx="78" cy="181" rx="14" ry="8" fill="var(--c)" ${stroke()}/><ellipse cx="122" cy="181" rx="14" ry="8" fill="var(--c)" ${stroke()}/>`
    s += `<path d="${body}" fill="var(--c)" ${stroke()}/>`
    s += `<g clip-path="url(#cb${n})" class="cr-shade"><ellipse cx="136" cy="182" rx="76" ry="34" fill="var(--c2)" opacity=".28"/></g>`
    s += `<ellipse cx="72" cy="94" rx="11" ry="6.5" fill="#fff" opacity=".75" transform="rotate(-32 72 94)" class="cr-hl"/>`
    s += face(mood, 116)
    if (hold === 'party') {
      s += `<path d="M78 72 L102 14 L124 70 Z" fill="var(--gold)" ${stroke(3.5)}/>`
      s += `<path d="M86 52 L114 46 M82 62 L120 58 M92 36 L110 32" stroke="var(--c2)" stroke-width="4" stroke-linecap="round"/>`
      s += `<circle cx="102" cy="14" r="7" fill="var(--band)" ${stroke(3)}/>`
    } else {
      s += `<path d="M62 86 C62 58 138 58 138 86 Z" fill="var(--c2)" ${stroke(3.5)}/>`
      s += `<path d="M98 86 C118 82 142 86 156 94 C140 98 114 96 98 90 Z" fill="var(--c2)" ${stroke(3.5)}/>`
      s += `<circle cx="100" cy="70" r="6" fill="var(--gold)" ${stroke(2.5)}/>`
    }
    if (hold === 'gift' || hold === 'party') {
      s += `<rect x="72" y="136" width="56" height="42" rx="6" fill="var(--gift)" ${stroke(3.5)}/>`
      s += `<rect x="94" y="136" width="12" height="42" fill="var(--c2)" ${stroke(3)}/>`
      s += `<path d="M100 136 C86 120 76 128 84 136 Z M100 136 C114 120 124 128 116 136 Z" fill="var(--c2)" ${stroke(3)}/>`
    } else {
      s += `<rect x="70" y="140" width="60" height="38" rx="5" fill="var(--paper)" ${stroke(3.5)}/>`
      s += `<path d="M72 143 L100 162 L128 143" fill="none" ${stroke(3)}/>`
      s += `<circle cx="100" cy="162" r="5" fill="var(--band)" ${stroke(2.5)}/>`
    }
    s += `<ellipse cx="66" cy="156" rx="9" ry="11" fill="var(--c)" ${stroke(3.5)}/><ellipse cx="134" cy="156" rx="9" ry="11" fill="var(--c)" ${stroke(3.5)}/>`
    if (hold === 'party') {
      s += sparkle(36, 60, 8) + sparkle(168, 50, 9) + sparkle(176, 120, 6)
    }
    return s
  }

  function creature(opts = {}) {
    const { species = 'sprout', stage = 0, mood = 'idle', size = 160, extra = {} } = opts
    const n = ++uid
    const cls = ['cr', `cr--${species}`, `cr--s${stage}`, `cr--${mood}`]
    if (extra.silhouette) cls.push('cr--sil')
    let inner = ''

    if (stage === 'egg') {
      const crack = extra.crack || 0
      inner += `<path d="${BODY.egg}" fill="var(--c)" ${stroke()}/>`
      inner += `<g clip-path="url(#cb${n})"><circle cx="70" cy="104" r="12" fill="#fff" opacity=".42"/><circle cx="128" cy="92" r="8" fill="#fff" opacity=".42"/><circle cx="132" cy="150" r="14" fill="#fff" opacity=".32"/><circle cx="62" cy="160" r="9" fill="#fff" opacity=".32"/><ellipse cx="128" cy="186" rx="70" ry="30" fill="var(--c2)" opacity=".25" class="cr-shade"/></g>`
      inner += `<ellipse cx="76" cy="84" rx="10" ry="6" fill="#fff" opacity=".8" transform="rotate(-36 76 84)" class="cr-hl"/>`
      if (crack >= 1) inner += `<path d="M66 108 L78 98 L86 110 L96 100" fill="none" ${stroke(3.5)}/>`
      if (crack >= 2) inner += `<path d="M96 100 L106 112 L116 100 L128 110 L136 102" fill="none" ${stroke(3.5)}/>`
      if (crack >= 3) inner += `<path d="M100 50 L98 64 L106 74 L100 86" fill="none" ${stroke(3)}/>`
      inner += `<g class="cr-eggface">${face(crack >= 2 ? 'wow' : mood, 138, 17, true)}</g>`
      const defs = `<defs><clipPath id="cb${n}"><path d="${BODY.egg}"/></clipPath></defs>`
      return `<svg class="${cls.join(' ')}" viewBox="0 0 200 200" width="${size}" height="${size}" aria-hidden="true">${defs}<g class="cr-body">${inner}</g></svg>`
    }

    if (species === 'post') {
      inner = post(mood, extra.hold || 'letter', n)
      const defs = `<defs><clipPath id="cb${n}"><path d="${BODY.round}"/></clipPath></defs>`
      return `<svg class="${cls.join(' ')}" viewBox="0 0 200 200" width="${size}" height="${size}" aria-hidden="true">${defs}<g transform="translate(100 186) scale(.94) translate(-100 -186)"><g class="cr-body">${inner}</g></g>${extra.pumpkin ? pumpkin() : ''}</svg>`
    }

    const shape = species === 'drop' ? 'drop' : 'round'
    const body = BODY[shape]
    const hp = extra.pumpkin ? { back: headpiece(species, stage).back, front: pumpkin() } : headpiece(species, stage)
    const faceY = shape === 'drop' ? 126 : 122

    // 身体后面：耳朵 / 彩虹 / 手 / 脚
    inner += hp.back
    if (stage >= 3) {
      inner += `<ellipse cx="38" cy="140" rx="10" ry="15" fill="var(--c)" transform="rotate(28 38 140)" ${stroke()}/>`
      inner += `<ellipse cx="162" cy="140" rx="10" ry="15" fill="var(--c)" transform="rotate(-28 162 140)" ${stroke()}/>`
    }
    if (stage >= 2) {
      inner += `<ellipse cx="78" cy="181" rx="14" ry="8" fill="var(--c)" ${stroke()}/><ellipse cx="122" cy="181" rx="14" ry="8" fill="var(--c)" ${stroke()}/>`
    }
    inner += `<path d="${body}" fill="var(--c)" ${stroke()}/>`
    inner += `<g clip-path="url(#cb${n})"><ellipse cx="136" cy="184" rx="76" ry="34" fill="var(--c2)" opacity=".28" class="cr-shade"/>${stage >= 2 ? `<ellipse cx="100" cy="166" rx="34" ry="18" fill="#fff" opacity=".32" class="cr-belly"/>` : ''}</g>`
    inner += `<ellipse cx="70" cy="${shape === 'drop' ? 100 : 94}" rx="11" ry="6.5" fill="#fff" opacity=".78" transform="rotate(-32 70 ${shape === 'drop' ? 100 : 94})" class="cr-hl"/>`
    inner += `<g class="cr-face">${face(mood, faceY)}</g>`
    inner += hp.front

    const defs = `<defs><clipPath id="cb${n}"><path d="${body}"/></clipPath></defs>`
    const s = SCALE[stage] ?? 1
    return `<svg class="${cls.join(' ')}" viewBox="0 0 200 200" width="${size}" height="${size}" aria-hidden="true">${defs}<g transform="translate(100 186) scale(${s}) translate(-100 -186)"><g class="cr-body">${inner}</g></g></svg>`
  }

  function pumpkin() {
    return (
      `<g class="cr-pumpkin"><ellipse cx="100" cy="66" rx="34" ry="22" fill="#FF9F43" ${stroke(3.5)}/>` +
      `<path d="M88 46 C80 58 80 76 88 86 M112 46 C120 58 120 76 112 86 M100 44 L100 88" fill="none" stroke="#D9731F" stroke-width="3"/>` +
      `<path d="M100 46 C100 38 104 32 110 30" fill="none" stroke="#3E8B4A" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M86 64 L92 58 L98 64 Z M102 64 L108 58 L114 64 Z" fill="var(--cr-line)"/></g>`
    )
  }

  /** 徽章：圆章 + 图形 + 数字 */
  function badge(kind, label, size = 64, locked = false) {
    const icons = {
      foot: `<path d="M86 108 C80 92 86 78 98 78 C110 78 114 94 108 110 C104 120 90 120 86 108 Z" fill="var(--b-ink)"/><circle cx="84" cy="70" r="5" fill="var(--b-ink)"/><circle cx="96" cy="64" r="5" fill="var(--b-ink)"/><circle cx="108" cy="66" r="5" fill="var(--b-ink)"/><circle cx="117" cy="74" r="4.5" fill="var(--b-ink)"/>`,
      num: `<text x="100" y="${label && label.length > 2 ? 110 : 114}" text-anchor="middle" font-size="${label && label.length > 2 ? 34 : 42}" font-weight="800" fill="var(--b-ink)" font-family="var(--font-num)">${label || ''}</text>`,
      moon: `<path d="M112 66 A30 30 0 1 0 112 126 A38 38 0 0 1 112 66 Z" fill="var(--b-ink)"/>`,
      sun: `<circle cx="100" cy="96" r="16" fill="var(--b-ink)"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i * Math.PI) / 4; return `<path d="M${100 + Math.cos(a) * 24} ${96 + Math.sin(a) * 24} L${100 + Math.cos(a) * 32} ${96 + Math.sin(a) * 32}" stroke="var(--b-ink)" stroke-width="5" stroke-linecap="round"/>` }).join('')}`,
      back: `<path d="M74 98 A28 28 0 1 1 86 120" fill="none" stroke="var(--b-ink)" stroke-width="8" stroke-linecap="round"/><path d="M64 92 L76 104 L86 90" fill="none" stroke="var(--b-ink)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
      book: `<path d="M70 74 L98 80 L98 124 L70 118 Z M130 74 L102 80 L102 124 L130 118 Z" fill="var(--b-ink)"/>`,
      gift: `<rect x="72" y="88" width="56" height="38" rx="4" fill="var(--b-ink)"/><rect x="68" y="78" width="64" height="14" rx="3" fill="var(--b-ink)"/><path d="M100 78 C88 62 78 70 86 78 M100 78 C112 62 122 70 114 78" fill="none" stroke="var(--b-ink)" stroke-width="5"/>`,
      share: `<circle cx="80" cy="96" r="9" fill="var(--b-ink)"/><circle cx="120" cy="76" r="9" fill="var(--b-ink)"/><circle cx="120" cy="116" r="9" fill="var(--b-ink)"/><path d="M80 96 L120 76 M80 96 L120 116" stroke="var(--b-ink)" stroke-width="5"/>`,
      pumpkin: `<ellipse cx="100" cy="100" rx="30" ry="22" fill="var(--b-ink)"/><path d="M100 78 C100 70 104 66 110 64" fill="none" stroke="var(--b-ink)" stroke-width="6" stroke-linecap="round"/>`,
      q: `<text x="100" y="114" text-anchor="middle" font-size="44" font-weight="800" fill="var(--b-ink)" font-family="var(--font-num)">?</text>`,
    }
    const g = icons[locked ? 'q' : kind] || icons.num
    return `<svg class="badge ${locked ? 'badge--locked' : ''}" viewBox="0 20 200 160" width="${size}" height="${size * 0.8}" aria-hidden="true"><path d="M70 140 L60 176 L80 166 L92 180 L100 146 Z M130 140 L140 176 L120 166 L108 180 L100 146 Z" fill="var(--b-ribbon)" ${stroke(3)}/><path d="${starRound(100, 96, 58)}" fill="var(--b-fill)" ${stroke(3.5)}/><circle cx="100" cy="96" r="44" fill="var(--b-face)" ${stroke(3)}/>${g}</svg>`
  }

  /** 圆齿边的章 */
  function starRound(cx, cy, r) {
    let d = ''
    const n = 14
    for (let i = 0; i <= n; i++) {
      const a = (i * 2 * Math.PI) / n
      const x = cx + Math.cos(a) * r
      const y = cy + Math.sin(a) * r
      if (i === 0) d += `M${x.toFixed(1)} ${y.toFixed(1)}`
      else {
        const am = ((i - 0.5) * 2 * Math.PI) / n
        const qx = cx + Math.cos(am) * (r + 9)
        const qy = cy + Math.sin(am) * (r + 9)
        d += ` Q${qx.toFixed(1)} ${qy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`
      }
    }
    return d + 'Z'
  }

export { creature, badge, star }
