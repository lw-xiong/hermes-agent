import { describe, expect, it } from 'vitest'

import {
  normalizeCielOpenString,
  pathFromCielDeepLink,
  pathFromOpenDeepLink,
  resolveCielOpenPath
} from './ciel-open-target'

describe('normalizeCielOpenString', () => {
  it('accepts hash-router paths and strips a leading hash', () => {
    expect(normalizeCielOpenString('/index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeCielOpenString('#/index-network/intent/1')).toBe('/index-network/intent/1')
  })

  it('maps plugin-scoped ciel:// deep links to the same path', () => {
    expect(normalizeCielOpenString('ciel://index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeCielOpenString('ciel://index-network/intent/1?focus=true')).toBe(
      '/index-network/intent/1?focus=true'
    )
  })

  it('maps ciel://open/… deep links by stripping the open host', () => {
    expect(normalizeCielOpenString('ciel://open/index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeCielOpenString('ciel://open/settings/plugins')).toBe('/settings/plugins')
  })

  it('rejects reserved ciel kinds and unsafe paths', () => {
    expect(normalizeCielOpenString('ciel://blueprint/morning-brief')).toBeNull()
    expect(normalizeCielOpenString('ciel://plugin/install')).toBeNull()
    expect(normalizeCielOpenString('https://example.com/x')).toBeNull()
    expect(normalizeCielOpenString('/../etc/passwd')).toBeNull()
    expect(normalizeCielOpenString('index-network')).toBeNull()
  })
})

describe('resolveCielOpenPath', () => {
  it('merges structured path + params', () => {
    expect(resolveCielOpenPath({ path: '/index-network/intent/1', params: { focus: 'true' } })).toBe(
      '/index-network/intent/1?focus=true'
    )
  })

  it('resolves href the same as a bare string', () => {
    expect(resolveCielOpenPath({ href: 'ciel://index-network/intent/1' })).toBe('/index-network/intent/1')
  })
})

describe('pathFromCielDeepLink', () => {
  it('builds the navigate path from a plugin-scoped deep-link payload', () => {
    expect(pathFromCielDeepLink('index-network', 'intent/1')).toBe('/index-network/intent/1')
  })

  it('builds the navigate path from ciel://open/… payloads', () => {
    expect(pathFromOpenDeepLink('index-network/intent/1')).toBe('/index-network/intent/1')
    expect(pathFromCielDeepLink('open', 'agent/42')).toBe('/agent/42')
  })

  it('ignores reserved kinds', () => {
    expect(pathFromCielDeepLink('blueprint', 'morning-brief')).toBeNull()
    expect(pathFromCielDeepLink('plugin', 'install')).toBeNull()
  })
})
