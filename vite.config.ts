import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 项目页部署在 https://ochprince.github.io/daymark/
// 本地 dev / preview 保持根路径，CI（GitHub Actions）下自动切换到子路径。
export default defineConfig({
  base: process.env.CI ? '/daymark/' : '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5190,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 5190,
    strictPort: true,
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
    rollupOptions: {
      // 分享卡片的独立预览页一起构建，这样能用 dist + 静态服务器验证渲染。
      // 只想发 App 本体时，把 sharePreview 这一行删掉就行。
      input: {
        main: resolve(__dirname, 'index.html'),
        sharePreview: resolve(__dirname, 'share-preview.html'),
      },
    },
  },
})
