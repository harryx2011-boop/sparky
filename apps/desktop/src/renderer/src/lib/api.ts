import type { SparkyApi } from '@sparky/core'
import { mockApi } from './mock'

declare global {
  interface Window {
    sparky?: SparkyApi
  }
}

/** The real bridge inside Electron, or a mock when the UI runs in a plain browser. */
export const api: SparkyApi = window.sparky ?? mockApi
export const isMock = !window.sparky
