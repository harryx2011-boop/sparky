import type { SparkyApi } from '@sparky/core'
import { mockApi } from './mock'

declare global {
  interface Window {
    sparky?: SparkyApi
  }
}

export const api: SparkyApi = window.sparky ?? mockApi
export const isMock = !window.sparky
