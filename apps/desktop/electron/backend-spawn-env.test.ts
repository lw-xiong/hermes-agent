import assert from 'node:assert/strict'

import { test } from 'vitest'

import { desktopBackendSpawnEnv } from './backend-spawn-env'

test('desktopBackendSpawnEnv keeps the base env and stamps stay_alive last', () => {
  const base = {
    CIEL_HOME: '/tmp/home',
    CIEL_DESKTOP: '1',
    GATEWAY_ON_ALL_ADAPTERS_DOWN: 'exit',
    PATH: '/usr/bin'
  }

  const env = desktopBackendSpawnEnv(base)

  assert.equal(env.CIEL_HOME, base.CIEL_HOME)
  assert.equal(env.CIEL_DESKTOP, base.CIEL_DESKTOP)
  assert.equal(env.PATH, base.PATH)
  // The desktop spawns `ciel serve` with no supervising service manager, so the
  // child must stay alive on all-adapters-down instead of exiting EX_TEMPFAIL
  // (#118080). Stamped unconditionally — an inherited value cannot opt the child
  // back into the failure exit.
  assert.equal(env.GATEWAY_ON_ALL_ADAPTERS_DOWN, 'stay_alive')
})
