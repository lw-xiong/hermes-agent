import assert from 'node:assert/strict'

import { test } from 'vitest'

import { hasWindowsPathPrefix, isExternalVenvHolder, isCielOwnedVenvDaemon } from './venv-holder-select'

const SCRIPTS = 'C:\\Ciel\\venv\\Scripts'

test('matches the hindsight daemon shim (exe under venv Scripts + hindsight cmdline)', () => {
  assert.equal(
    isCielOwnedVenvDaemon(
      'C:\\Ciel\\venv\\Scripts\\pythonw.exe',
      'C:\\Ciel\\venv\\Scripts\\pythonw.exe -m hindsight_api.main --daemon --idle-timeout 300 --port 9177',
      SCRIPTS
    ),
    true
  )
})

test('Windows path prefix match is ordinal case-insensitive', () => {
  assert.equal(
    isCielOwnedVenvDaemon(
      'c:\\ciel\\venv\\scripts\\python.exe',
      'python.exe -m hindsight_api.main --daemon',
      'C:\\Ciel\\venv\\Scripts'
    ),
    true
  )
})

test('excludes external venv holders that are not the hindsight daemon', () => {
  // a user terminal running the ciel CLI from the venv — must NOT be killed
  assert.equal(isCielOwnedVenvDaemon('C:\\Ciel\\venv\\Scripts\\ciel.exe', 'ciel chat -q "hi"', SCRIPTS), false)
  // an unrelated python script using the venv interpreter
  assert.equal(
    isCielOwnedVenvDaemon('C:\\Ciel\\venv\\Scripts\\python.exe', 'python C:\\tools\\import.py', SCRIPTS),
    false
  )
})

test('excludes exes outside the venv even when the cmdline mentions hindsight', () => {
  assert.equal(
    isCielOwnedVenvDaemon('C:\\Other\\pythonw.exe', 'pythonw -m hindsight_api.main --daemon', SCRIPTS),
    false
  )
})

test('prefix boundary: sibling dirs (ScriptsX) do not match', () => {
  assert.equal(hasWindowsPathPrefix('C:\\Ciel\\venv\\ScriptsX\\python.exe', SCRIPTS), false)
  assert.equal(hasWindowsPathPrefix('C:\\Ciel\\venv\\Scripts\\python.exe', SCRIPTS), true)
})

test('null/undefined fields never match', () => {
  assert.equal(isCielOwnedVenvDaemon(null, 'x', SCRIPTS), false)
  assert.equal(isCielOwnedVenvDaemon('C:\\Ciel\\venv\\Scripts\\pythonw.exe', null, SCRIPTS), false)
  assert.equal(isCielOwnedVenvDaemon(undefined, undefined, SCRIPTS), false)
})

// --- isExternalVenvHolder (#62311) ------------------------------------------

test('matches the autostart gateway shim (ciel.exe under venv Scripts)', () => {
  assert.equal(
    isExternalVenvHolder(
      'C:\\Ciel\\venv\\Scripts\\ciel.exe',
      '"C:\\Ciel\\venv\\Scripts\\ciel.exe" gateway run --external-supervisor',
      SCRIPTS
    ),
    true
  )
})

test('matches the dashboard scheduled task (python -m ciel_cli / -m ciel)', () => {
  assert.equal(
    isExternalVenvHolder(
      'C:\\Ciel\\venv\\Scripts\\python.exe',
      '"C:\\Ciel\\venv\\Scripts\\python.exe" -m ciel_cli.main dashboard',
      SCRIPTS
    ),
    true
  )
  assert.equal(
    isExternalVenvHolder('C:\\Ciel\\venv\\Scripts\\pythonw.exe', 'pythonw.exe -m ciel serve', SCRIPTS),
    true
  )
})

test('never matches an unrelated process that merely borrows the venv interpreter', () => {
  // a user's own script running on the venv python — NOT Ciel, must NOT be killed
  assert.equal(
    isExternalVenvHolder('C:\\Ciel\\venv\\Scripts\\python.exe', 'python C:\\tools\\import.py', SCRIPTS),
    false
  )
  // hindsight daemon is selected by isCielOwnedVenvDaemon, not here
  assert.equal(
    isExternalVenvHolder('C:\\Ciel\\venv\\Scripts\\pythonw.exe', 'pythonw -m hindsight_api.main --daemon', SCRIPTS),
    false
  )
})

test('never matches a process outside the venv, even with ciel in the cmdline', () => {
  // an editor / shell whose command line mentions the install root (#62445 regression guard)
  assert.equal(
    isExternalVenvHolder('C:\\Windows\\System32\\cmd.exe', 'cmd /c cd C:\\Ciel\\venv\\Scripts && dir', SCRIPTS),
    false
  )
  assert.equal(isExternalVenvHolder('C:\\Other\\ciel.exe', 'ciel gateway run', SCRIPTS), false)
})

test('sibling-dir and boundary safety for the external selector', () => {
  assert.equal(isExternalVenvHolder('C:\\Ciel\\venv\\ScriptsX\\ciel.exe', 'ciel gateway run', SCRIPTS), false)
  assert.equal(isExternalVenvHolder(null, 'ciel gateway run', SCRIPTS), false)
  assert.equal(isExternalVenvHolder('C:\\Ciel\\venv\\Scripts\\ciel.exe', null, SCRIPTS), false)
})
