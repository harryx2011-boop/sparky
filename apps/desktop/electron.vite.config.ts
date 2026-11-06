import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

const bundleWorkspace = externalizeDepsPlugin({ exclude: ['@sparky/core', '@sparky/engine', '@sparky/fs-native', '@sparky/ui'] })

const fsNativeAddon: Plugin = {
  name: 'fs-native-addon',
  writeBundle({ dir }) {
    const target = resolve(dir!, '../build/Release')
    mkdirSync(target, { recursive: true })
    copyFileSync(resolve(__dirname, '../../packages/fs-native/build/Release/fs_native.node'), resolve(target, 'fs_native.node'))
  },
}

export default defineConfig({
  main: {
    plugins: [bundleWorkspace, fsNativeAddon],
  },
  preload: {
    plugins: [bundleWorkspace],
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: { '@': resolve(__dirname, 'src/renderer/src') },
    },
    plugins: [react(), tailwindcss()],
    build: { minify: true },
  },
})
