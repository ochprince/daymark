import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/index.css'
import './skins/tokens.css'
import './skins/custom.css'
import './v2/components.css'
import { AppV2 } from './v2/AppV2'
import { PetsLab } from './v2/pets/PetsLab'
import { SystemLab } from './v2/system/SystemLab'
import { applySpeciesColors, runMigration } from './lib/migrate'
import { reload as reloadEvents } from './lib/storage'
import { reload as reloadCountdowns } from './lib/countdowns'
import { reload as reloadCheckins } from './lib/checkins'
import { collectionStore } from './lib/collection'
import { skinStore } from './lib/skin'
import { applyDocumentLang, getLocale } from './lib/i18n/locale'
import { hideSplash } from './lib/native'

/**
 * 启动顺序很重要：迁移必须先写好 localStorage，再让各个 store 重新读一遍，
 * 否则它们拿到的还是模块加载那一刻的旧数据。
 */
runMigration(window.localStorage)
applySpeciesColors(window.localStorage)
reloadEvents()
reloadCountdowns()
reloadCheckins()
collectionStore.reload()
skinStore.reload()
applyDocumentLang(getLocale())

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

// 实验室入口：?lab=pets 宠物原型页、?lab=sys 系统表面演示台，都不加载主 App
const lab = new URLSearchParams(window.location.search).get('lab')
const labView = lab === 'pets' ? <PetsLab /> : lab === 'sys' ? <SystemLab /> : <AppV2 />

createRoot(container).render(
  <StrictMode>{labView}</StrictMode>,
)

// 首帧画完再收启动图，避免白闪；浏览器里这个调用是 no-op
requestAnimationFrame(() => {
  requestAnimationFrame(() => hideSplash())
})

// 离线可用：只在生产构建里注册 Service Worker
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(() => undefined)
  })
}
