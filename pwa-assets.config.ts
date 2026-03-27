import { defineConfig } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[48, 'favicon.ico']],
      padding: 0,
    },
    maskable: {
      sizes: [512],
      padding: 0.1,
      resizeOptions: { background: '#1a1a2e' },
    },
    apple: {
      sizes: [180],
      padding: 0.1,
      resizeOptions: { background: '#1a1a2e' },
    },
  },
  images: ['public/icon.svg'],
})
