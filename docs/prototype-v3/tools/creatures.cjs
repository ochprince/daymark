// 宠物 SVG 的导出与打包。
//   node tools/creatures.cjs export   从 creatures.js 的代码生成 assets/creatures/*.svg（只做一次，之后直接改文件）
//   node tools/creatures.cjs pack     把 assets/creatures/*.svg 合并成 assets/creatures.js（页面通过它读取）
// 页面是 file:// 打开的，没法 fetch 单个 svg，所以需要 pack 这一步。改完 svg 后重新 pack 再刷新即可。
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const dir = path.join(root, 'assets', 'creatures')

// 仅供单独打开 svg 文件预览用；pack 时会去掉，页面里颜色仍由主题和色相变量决定
const PREVIEW = '--c:#8fe3c0;--c2:#2fa77a;--cr-line:#2b2638;--cr-lw:4.5;--leaf:#7bd389;--petal:#fff;--pistil:#ffd45c;--spark:#ffc93c;--shell:#fffdf6;--gold:#ffd45c;--band:#fff;--foam:#fff;--bubble:rgba(255,255,255,.75);--rb1:#ff9c8a;--rb2:#ffe07a;--rb3:#8fe3c0;--mouth:#e5664b;--blush:#ff9c9c;--gift:#ffe07a;--paper:#fff'
const PREVIEW_ATTR = ` style="${PREVIEW}"`

function keys() {
  const list = []
  for (const sp of ['sprout', 'moon', 'drop', 'star']) for (let s = 0; s <= 4; s++) list.push({ species: sp, stage: s })
  for (const h of ['letter', 'gift', 'party']) list.push({ species: 'post', stage: 4, extra: { hold: h } })
  for (let c = 0; c <= 3; c++) list.push({ stage: 'egg', extra: { crack: c } })
  return list
}

const mode = process.argv[2]

if (mode === 'export') {
  const win = {}
  global.window = win
  require(path.join(root, 'creatures.js'))
  const { generate, keyOf } = win.Creatures
  fs.mkdirSync(dir, { recursive: true })
  for (const o of keys()) {
    const key = keyOf(o)
    const svg = generate(o)
      .replace(/(<defs>|<\/defs>|<g |<path |<ellipse |<circle |<rect )/g, (m, t, off) => (t === '<defs>' || t === '<g ' || t === '<path ' ? '\n  ' : '\n  ') + m)
      .replace('<svg viewBox="0 0 200 200">', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"${PREVIEW_ATTR}>`)
    fs.writeFileSync(path.join(dir, key + '.svg'), svg + '\n', 'utf8')
  }
  console.log('exported', keys().length, 'files ->', dir)
} else if (mode === 'pack') {
  const out = {}
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.svg')).sort()) {
    let s = fs.readFileSync(path.join(dir, f), 'utf8')
    s = s
      .replace(/<\?xml[^>]*\?>/, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/(<svg[^>]*?)\s+style="[^"]*"/, '$1')
      .replace(/(<svg[^>]*?)\s+xmlns="[^"]*"/, '$1')
      .replace(/(<svg[^>]*?)\s+(width|height)="[^"]*"/g, '$1')
      .replace(/\s*\n\s*/g, '')
      .trim()
    out[f.replace(/\.svg$/, '')] = s
  }
  const body = '/* 由 tools/creatures.cjs pack 生成，请改 assets/creatures/*.svg 后重新打包，不要手改这个文件 */\nwindow.CREATURE_SVG = ' + JSON.stringify(out, null, 1) + '\n'
  fs.writeFileSync(path.join(root, 'assets', 'creatures.js'), body, 'utf8')
  console.log('packed', Object.keys(out).length, 'svgs')
} else {
  console.log('usage: node tools/creatures.cjs export|pack')
  process.exit(1)
}
