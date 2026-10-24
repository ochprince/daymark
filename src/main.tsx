import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/index.css'
import './skins/tokens.css'
import './skins/custom.css'
import './v2/components.css'
import { AppV2 } from './v2/AppV2'
import { runMigration } from './lib/migrate'
import { reload as reloadEvents } from './lib/storage'
import { reload as reloadCountdowns } from './lib/countdowns'
import { reload as reloadCheckins } from './lib/checkins'
import { collectionStore } from './lib/collection'
import { skinStore } from './lib/skin'
import { applyDocumentLang, getLocale } from './lib/i18n/locale'

/**
 * 启动顺序很重要：迁移必须先写好 localStorage，再让各个 store 重新读一遍，
 * 否则它们拿到的还是模块加载那一刻的旧数据。
 */
runMigration(window.localStorage)
reloadEvents()
reloadCountdowns()
reloadCheckins()
collectionStore.reload()
skinStore.reload()
applyDocumentLang(getLocale())

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

createRoot(container).render(
  <StrictMode>
    <AppV2 />
  </StrictMode>,
)

// 离线可用：只在生产构建里注册 Service Worker
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(() => undefined)
  })
}
