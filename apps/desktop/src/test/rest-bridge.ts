import { vi } from 'vitest'

import type { CielApiRequest } from '@/global'

/** Install a fake `window.cielDesktop.api`, the preload bridge every REST helper sends through. */
export function installRestBridge(answer: (request: CielApiRequest) => object) {
  const api = vi.fn(async (request: CielApiRequest) => answer(request))

  Object.defineProperty(window, 'cielDesktop', { configurable: true, value: { api } })

  return api
}
