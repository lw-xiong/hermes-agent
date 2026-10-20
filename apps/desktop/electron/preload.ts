import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'

import type { DesktopProfileRoute } from './desktop-profile'
import type { HudModifierApi, HudModifierStatus } from './hud-modifier-types'
import { customWindowControlsEnabled } from './window-controls'

// Which translucency the OS can back. Asked synchronously because the renderer
// needs it before its first paint, and answered by main because deciding it
// needs `os.release()` — a sandboxed preload may only require electron, events,
// timers and url, so importing node:os here throws before contextBridge runs
// and takes the ENTIRE bridge down with it (window.cielDesktop undefined =>
// "Desktop IPC bridge is unavailable"). No reply means no glass, which degrades
// to an ordinary opaque window rather than a page thinned over nothing.
const translucencySupport = ipcRenderer.sendSync('ciel:translucency:support')
const hudWindowing = ipcRenderer.sendSync('ciel:hud:windowing')
const hudNativeDrag = hudWindowing?.nativeDrag === true

const launchFlags: { localModels?: boolean; assumeFreshInstall?: boolean } | undefined =
  ipcRenderer.sendSync('ciel:feature-flags')

// Local, sanitized skin payload for the first renderer theme paint. This does
// not wait on `gateway.ready`, so an unreachable remote primary cannot force
// the built-in palette over the skin configured on this machine.
const localSkin = ipcRenderer.sendSync('ciel:skin:local')

import { unwrapExpectedNotFound } from './api-expected-404'

contextBridge.exposeInMainWorld('cielDesktop', {
  glassSupported: translucencySupport?.glass === true,
  translucencySupported: translucencySupport?.translucency === true,
  // Launch-flag fact: the app was started with --local, so the renderer may
  // show the local-models surfaces. Static for the window's lifetime.
  localModelsEnabled: launchFlags?.localModels === true,
  // Dev-only launch fact: an unpackaged app started with --fresh-install, so
  // onboarding treats this launch as a fresh install. Always false when packaged.
  assumeFreshInstall: launchFlags?.assumeFreshInstall === true,
  localSkin: localSkin && typeof localSkin === 'object' ? localSkin : null,
  getConnection: (profile, opts) => ipcRenderer.invoke('ciel:connection', profile, opts),
  // Loopback origin that hosts YouTube's player for the file:// renderer.
  getEmbedHostOrigin: () => ipcRenderer.invoke('ciel:embed-host:origin'),
  // Registry-scoped backend resolution: { connectionId, profile } → descriptor.
  getConnectionFor: payload => ipcRenderer.invoke('ciel:connection:for', payload),
  getProfileRoutes: profiles => ipcRenderer.invoke('ciel:plugin-profile-routes', profiles),
  revalidateConnection: () => ipcRenderer.invoke('ciel:connection:revalidate'),
  touchBackend: (profile, options) => ipcRenderer.invoke('ciel:backend:touch', profile, options),
  getPoolLimits: () => ipcRenderer.invoke('ciel:pool-limits:get'),
  setPoolLimits: limits => ipcRenderer.invoke('ciel:pool-limits:set', limits),
  getGatewayWsUrl: profile => ipcRenderer.invoke('ciel:gateway:ws-url', profile),
  // Registry-scoped fresh WS URL: { connectionId, profile } → result shape of
  // getGatewayWsUrl, minted against that connection's backend.
  getGatewayWsUrlFor: payload => ipcRenderer.invoke('ciel:gateway:ws-url-for', payload),
  // Union agent roster across every registered connection.
  getAgentRoster: () => ipcRenderer.invoke('ciel:agents:roster'),
  openSessionWindow: (sessionId, opts) => ipcRenderer.invoke('ciel:window:openSession', sessionId, opts),
  openSessionInTerminal: (sessionId, opts) => ipcRenderer.invoke('ciel:window:openInTerminal', sessionId, opts),
  openWindow: (options?: DesktopProfileRoute) => ipcRenderer.invoke('ciel:window:openInstance', options),
  openBrowserWindow: tabId => ipcRenderer.invoke('ciel:window:openBrowser', tabId),
  windowRelay: {
    send: payload => ipcRenderer.send('ciel:window:relay', payload),
    onMessage: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('ciel:window:relay', listener)

      return () => ipcRenderer.removeListener('ciel:window:relay', listener)
    }
  },
  onBrowserPopoutClosed: callback => {
    const listener = (_event, tabId) => callback(tabId)
    ipcRenderer.on('ciel:browser-popout:closed', listener)

    return () => ipcRenderer.removeListener('ciel:browser-popout:closed', listener)
  },
  claimAmbientCue: key => ipcRenderer.invoke('ciel:ambient:claim', key),
  windowControls: {
    custom: customWindowControlsEnabled(),
    minimize: () => ipcRenderer.send('ciel:window-control', 'minimize'),
    toggleMaximize: () => ipcRenderer.send('ciel:window-control', 'toggle-maximize'),
    close: () => ipcRenderer.send('ciel:window-control', 'close')
  },
  wakeIndicator: {
    getState: () => ipcRenderer.invoke('ciel:wake-indicator:get'),
    setState: state => ipcRenderer.send('ciel:wake-indicator:set', state),
    onState: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('ciel:wake-indicator:state', listener)

      return () => ipcRenderer.removeListener('ciel:wake-indicator:state', listener)
    }
  },
  chatOnboarding: {
    size: mode => ipcRenderer.send('ciel:window:size', mode)
  },
  petOverlay: {
    // Main renderer → main process: window lifecycle + drag. `request` is
    // `{ bounds, screen }`; resolves with the screen bounds it actually used.
    open: request => ipcRenderer.invoke('ciel:pet-overlay:open', request),
    close: () => ipcRenderer.invoke('ciel:pet-overlay:close'),
    setBounds: bounds => ipcRenderer.send('ciel:pet-overlay:set-bounds', bounds),
    setIgnoreMouse: ignore => ipcRenderer.send('ciel:pet-overlay:ignore-mouse', ignore),
    // Flip the overlay focusable (and focus it) while the composer needs keys.
    setFocusable: focusable => ipcRenderer.send('ciel:pet-overlay:set-focusable', focusable),
    // Main renderer → overlay (forwarded by main): push the latest pet state.
    pushState: payload => ipcRenderer.send('ciel:pet-overlay:state', payload),
    // Overlay → main renderer (forwarded by main): pop back in / composer submit.
    control: payload => ipcRenderer.send('ciel:pet-overlay:control', payload),
    // Overlay subscribes to state pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('ciel:pet-overlay:state', listener)

      return () => ipcRenderer.removeListener('ciel:pet-overlay:state', listener)
    },
    // Main renderer subscribes to overlay control messages.
    onControl: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('ciel:pet-overlay:control', listener)

      return () => ipcRenderer.removeListener('ciel:pet-overlay:control', listener)
    }
  },
  // HUD mode: the chrome-free floating chat. A full app renderer (own gateway)
  // sized as a floating bar, so it mounts the real composer. Main owns the
  // window; `onChanged` keeps every window's toggle truthful.
  hud: {
    nativeDrag: hudNativeDrag,
    windowing: {
      clientPlacement: hudWindowing?.clientPlacement !== false,
      controlDrag: hudWindowing?.controlDrag === true,
      nativeDrag: hudNativeDrag,
      solid: hudWindowing?.solid === true,
      workspaceTransfer: hudWindowing?.workspaceTransfer === true
    },
    open: request => ipcRenderer.invoke('ciel:hud:open', request),
    close: () => ipcRenderer.invoke('ciel:hud:close'),
    setIgnoreMouse: ignore => ipcRenderer.send('ciel:hud:ignore-mouse', ignore),
    beginMove: () => ipcRenderer.send('ciel:hud:begin-move'),
    endMove: () => ipcRenderer.send('ciel:hud:end-move'),
    moveBy: delta => ipcRenderer.send('ciel:hud:move-by', delta),
    setWorkspaceTransfer: transferring => ipcRenderer.send('ciel:hud:workspace-transfer', transferring),
    setBounds: bounds => ipcRenderer.send('ciel:hud:set-bounds', bounds),
    resetLayout: () => ipcRenderer.invoke('ciel:hud:reset-layout'),
    // Whether the band covers the window below the bar. Main pairs it with the
    // user's translucency setting to decide the native frost (macOS vibrancy /
    // Windows 11 DWM backdrop) — see hudFrostFor.
    setFrost: showing => ipcRenderer.invoke('ciel:hud:frost', showing),
    // The HUD tells main which session it is on; main hands that back to the
    // app window when the HUD closes, so the app can re-home onto it.
    setSession: sessionId => ipcRenderer.send('ciel:hud:session', sessionId),
    onGoto: callback => {
      const listener = (_event, sessionId) => callback(sessionId)
      ipcRenderer.on('ciel:hud:goto', listener)

      return () => ipcRenderer.removeListener('ciel:hud:goto', listener)
    },
    onChanged: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('ciel:hud:changed', listener)

      return () => ipcRenderer.removeListener('ciel:hud:changed', listener)
    },
    // Linux only, and silent elsewhere: where the cursor is, in page
    // coordinates, or null when it has left the window. Stands in for the
    // mousemove that `setIgnoreMouseEvents(true, { forward: true })` delivers on
    // macOS and Windows but not here.
    onCursor: callback => {
      const listener = (_event, point) => callback(point)
      ipcRenderer.on('ciel:hud:cursor', listener)

      return () => ipcRenderer.removeListener('ciel:hud:cursor', listener)
    },
    // Main's game-overlay watch: whether a fullscreen app (a game) is under
    // the HUD, so the renderer can step back to the low-opacity overlay
    // treatment while one owns the screen.
    onGameOverlay: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('ciel:hud:game-overlay', listener)

      return () => ipcRenderer.removeListener('ciel:hud:game-overlay', listener)
    }
  },
  hudModifier: {
    getSettings: () => ipcRenderer.invoke('ciel:hud-modifier:settings:get'),
    setEnabled: enabled => ipcRenderer.invoke('ciel:hud-modifier:settings:set', enabled),
    openPermissionSettings: () => ipcRenderer.invoke('ciel:hud-modifier:permission'),
    onStatus: callback => {
      const listener = (_event: Electron.IpcRendererEvent, status: HudModifierStatus) => callback(status)
      ipcRenderer.on('ciel:hud-modifier:status', listener)

      return () => ipcRenderer.removeListener('ciel:hud-modifier:status', listener)
    }
  } satisfies HudModifierApi,
  // macOS native screenshot gesture; captures require a main-issued request.
  screenshot:
    process.platform === 'darwin'
      ? {
          getSettings: () => ipcRenderer.invoke('ciel:screenshot:settings:get'),
          setEnabled: enabled => ipcRenderer.invoke('ciel:screenshot:settings:set', enabled),
          openPermissionSettings: kind => ipcRenderer.invoke('ciel:screenshot:permission', kind),
          capture: requestId => ipcRenderer.invoke('ciel:screenshot:capture', requestId),
          onStatus: callback => {
            const listener = (_event, status) => callback(status)
            ipcRenderer.on('ciel:screenshot:status', listener)

            return () => ipcRenderer.removeListener('ciel:screenshot:status', listener)
          },
          onRequest: callback => {
            const channel = 'ciel:screenshot:request'
            const listener = (_event, requestId) => callback(requestId)

            if (ipcRenderer.listenerCount(channel) === 0) {
              ipcRenderer.send('ciel:screenshot:subscribe', true)
            }

            ipcRenderer.on(channel, listener)

            return () => {
              ipcRenderer.removeListener(channel, listener)

              if (ipcRenderer.listenerCount(channel) === 0) {
                ipcRenderer.send('ciel:screenshot:subscribe', false)
              }
            }
          }
        }
      : undefined,
  // Quick Entry: the global-hotkey mini composer window. Main owns the OS
  // shortcut + the persisted preference; the quick window only captures text
  // and hands it back, and the primary renderer submits it through the normal
  // prompt path.
  quickEntry: {
    getSettings: () => ipcRenderer.invoke('ciel:quick-entry:settings:get'),
    setSettings: patch => ipcRenderer.invoke('ciel:quick-entry:settings:set', patch),
    // Invoke returns the delivery result so the draft is not lost (#85590).
    submit: payload => ipcRenderer.invoke('ciel:quick-entry:submit', payload),
    // Main cannot invoke the primary renderer, so it receives this ack (#85590).
    ackSubmit: (correlationId, result) => ipcRenderer.send('ciel:quick-entry:ack', { correlationId, result }),
    dismiss: () => ipcRenderer.send('ciel:quick-entry:dismiss'),
    // Primary renderer → main → quick window: gateway connection state + the
    // recent-session options the target picker offers. Main caches the latest
    // payload so a freshly spawned quick window starts from truth.
    pushState: payload => ipcRenderer.send('ciel:quick-entry:state', payload),
    // Quick window subscribes to those pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('ciel:quick-entry:state', listener)

      return () => ipcRenderer.removeListener('ciel:quick-entry:state', listener)
    },
    // Main → primary renderer: a submit captured by the quick window.
    onSubmit: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('ciel:quick-entry:submit', listener)

      return () => ipcRenderer.removeListener('ciel:quick-entry:submit', listener)
    },
    // Main → quick window: you were just summoned (reset draft + refocus).
    onShown: callback => {
      const listener = () => callback()
      ipcRenderer.on('ciel:quick-entry:shown', listener)

      return () => ipcRenderer.removeListener('ciel:quick-entry:shown', listener)
    },
    // Main → quick window: the outcome of a submit whose relay already timed
    // out. Delivery is now KNOWN — reconcile the unknown state instead of
    // leaving the user to resend a prompt that may already be delivered.
    onLateResult: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('ciel:quick-entry:late-result', listener)

      return () => ipcRenderer.removeListener('ciel:quick-entry:late-result', listener)
    }
  },
  getBootProgress: () => ipcRenderer.invoke('ciel:boot-progress:get'),
  getConnectionConfig: profile => ipcRenderer.invoke('ciel:connection-config:get', profile),
  saveConnectionConfig: payload => ipcRenderer.invoke('ciel:connection-config:save', payload),
  applyConnectionConfig: payload => ipcRenderer.invoke('ciel:connection-config:apply', payload),
  testConnectionConfig: payload => ipcRenderer.invoke('ciel:connection-config:test', payload),
  // Opt-in OS-keychain encryption for stored gateway secrets (default off —
  // see secret-storage-policy.ts). get never touches the OS keychain.
  getSecretStorageEncryption: () => ipcRenderer.invoke('ciel:secret-storage:get'),
  setSecretStorageEncryption: (on: boolean) => ipcRenderer.invoke('ciel:secret-storage:set', on),
  // v2 multi-connection registry: named agent sources (local / remote / cloud / ssh).
  connections: {
    list: () => ipcRenderer.invoke('ciel:connections:list'),
    save: payload => ipcRenderer.invoke('ciel:connections:save', payload),
    remove: id => ipcRenderer.invoke('ciel:connections:remove', id),
    setPrimary: id => ipcRenderer.invoke('ciel:connections:set-primary', id),
    setLaunchMode: mode => ipcRenderer.invoke('ciel:connections:set-launch-mode', mode),
    setLastUsed: id => ipcRenderer.invoke('ciel:connections:set-last-used', id),
    test: id => ipcRenderer.invoke('ciel:connections:test', id),
    updateManaged: id => ipcRenderer.invoke('ciel:connections:update-managed', id),
    // Fan out `ciel update` to every eligible registered connection.
    // Optional excludeIds skips rows the caller updates through another path.
    updateAll: options => ipcRenderer.invoke('ciel:connections:update-all', options),
    // Registry lifecycle push (main → renderer): a connection was removed or
    // materially edited, so secondaries scoped to it must be disposed (and,
    // for edits, re-dialed at the new target).
    onChanged: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('ciel:connections:changed', listener)

      return () => ipcRenderer.removeListener('ciel:connections:changed', listener)
    }
  },
  sshConfigHosts: () => ipcRenderer.invoke('ciel:ssh-config:hosts'),
  sshResolveHost: host => ipcRenderer.invoke('ciel:ssh-config:resolve', host),
  probeConnectionConfig: remoteUrl => ipcRenderer.invoke('ciel:connection-config:probe', remoteUrl),
  // `options` lets a registry-editor draft sign in BEFORE it is saved: the
  // main process settles the draft's connection id up front so the login
  // window writes into the per-connection cookie jar the saved entry will
  // read (not the legacy shared jar an unsaved URL would fall back to).
  oauthLoginConnectionConfig: (remoteUrl, options) =>
    ipcRenderer.invoke('ciel:connection-config:oauth-login', remoteUrl, options),
  oauthLogoutConnectionConfig: remoteUrl => ipcRenderer.invoke('ciel:connection-config:oauth-logout', remoteUrl),
  // Ciel Cloud: one portal login powers discovery + silent per-agent sign-in
  // (cloud-auto-discovery Phase 3).
  cloud: {
    status: () => ipcRenderer.invoke('ciel:cloud:status'),
    login: () => ipcRenderer.invoke('ciel:cloud:login'),
    logout: () => ipcRenderer.invoke('ciel:cloud:logout'),
    discover: org => ipcRenderer.invoke('ciel:cloud:discover', org),
    agentSignIn: dashboardUrl => ipcRenderer.invoke('ciel:cloud:agent-sign-in', dashboardUrl)
  },
  profile: {
    getDefault: () => ipcRenderer.invoke('ciel:profile:default:get'),
    setDefault: (route: DesktopProfileRoute) => ipcRenderer.invoke('ciel:profile:default:set', route),
    onDefaultChanged: (callback: (route: DesktopProfileRoute | null) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, route: DesktopProfileRoute | null) => callback(route)
      ipcRenderer.on('ciel:profile:default:changed', listener)

      return () => ipcRenderer.removeListener('ciel:profile:default:changed', listener)
    },
    get: () => ipcRenderer.invoke('ciel:profile:get'),
    remember: name => ipcRenderer.invoke('ciel:profile:remember', name),
    set: name => ipcRenderer.invoke('ciel:profile:set', name)
  },
  // The handler resolves an expected 404 with a sentinel instead of rejecting
  // (Electron logs a stack for every rejected invoke). Turn it back into the
  // rejection the renderer expects — see electron/api-expected-404.ts.
  api: request => ipcRenderer.invoke('ciel:api', request).then(unwrapExpectedNotFound),
  notify: payload => ipcRenderer.invoke('ciel:notify', payload),
  claimStartupLatency: () => ipcRenderer.invoke('ciel:startup-latency:claim'),
  requestMicrophoneAccess: () => ipcRenderer.invoke('ciel:requestMicrophoneAccess'),
  readWindowBelow: () => ipcRenderer.invoke('ciel:window:readBelow'),
  readFileDataUrl: filePath => ipcRenderer.invoke('ciel:readFileDataUrl', filePath),
  readFileDataUrlForAttach: filePath => ipcRenderer.invoke('ciel:readFileDataUrlForAttach', filePath),
  dataUrlReadMax: {
    get: () => ipcRenderer.invoke('ciel:data-url-read-max:get'),
    set: maxMb => ipcRenderer.invoke('ciel:data-url-read-max:set', maxMb)
  },
  readFileText: filePath => ipcRenderer.invoke('ciel:readFileText', filePath),
  readPluginSource: (filePath: string) => ipcRenderer.invoke('ciel:readPluginSource', filePath),
  selectPaths: options => ipcRenderer.invoke('ciel:selectPaths', options),
  selectSavePath: options => ipcRenderer.invoke('ciel:selectSavePath', options),
  writeClipboard: text => ipcRenderer.invoke('ciel:writeClipboard', text),
  readClipboard: () => ipcRenderer.invoke('ciel:readClipboard'),
  saveGatewayFile: payload => ipcRenderer.invoke('ciel:saveGatewayFile', payload),
  saveImageFromUrl: url => ipcRenderer.invoke('ciel:saveImageFromUrl', url),
  contextMenuEdit: command => ipcRenderer.invoke('ciel:context-menu:edit', command),
  contextMenuCopyImage: () => ipcRenderer.invoke('ciel:context-menu:copy-image'),
  contextMenuSpellcheck: action => ipcRenderer.invoke('ciel:context-menu:spellcheck', action),
  contextMenuGuestAddWord: payload => ipcRenderer.invoke('ciel:context-menu:guest-add-word', payload),
  onContextMenuSpellcheck: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ciel:context-menu-spellcheck', listener)

    return () => ipcRenderer.removeListener('ciel:context-menu-spellcheck', listener)
  },
  saveImageBuffer: (data, ext, name) => ipcRenderer.invoke('ciel:saveImageBuffer', { data, ext, name }),
  capturePreview: payload => ipcRenderer.invoke('ciel:capturePreview', payload),
  savePastedText: text => ipcRenderer.invoke('ciel:savePastedText', { text }),
  saveClipboardImage: () => ipcRenderer.invoke('ciel:saveClipboardImage'),
  getPathForFile: file => {
    try {
      return webUtils.getPathForFile(file) || ''
    } catch {
      return ''
    }
  },
  normalizePreviewTarget: (target, baseDir) => ipcRenderer.invoke('ciel:normalizePreviewTarget', target, baseDir),
  watchPreviewFile: url => ipcRenderer.invoke('ciel:watchPreviewFile', url),
  watchDirectory: dir => ipcRenderer.invoke('ciel:watchDirectory', dir),
  stopPreviewFileWatch: id => ipcRenderer.invoke('ciel:stopPreviewFileWatch', id),
  setActiveWork: payload => ipcRenderer.send('ciel:active-work', payload),
  setTitleBarTheme: payload => ipcRenderer.send('ciel:titlebar-theme', payload),
  setNativeTheme: mode => ipcRenderer.send('ciel:native-theme', mode),
  setTranslucency: payload => ipcRenderer.send('ciel:translucency', payload),
  setKeepAwake: mode => ipcRenderer.send('ciel:keep-awake', mode),
  // Once per computer, after a timed sleep interrupted a turn with keep-awake off.
  onKeepAwakeOffer: callback => {
    const listener = () => callback()
    ipcRenderer.on('ciel:keep-awake-offer', listener)

    return () => ipcRenderer.removeListener('ciel:keep-awake-offer', listener)
  },
  minimizeToTray: {
    get: () => ipcRenderer.invoke('ciel:minimize-to-tray:get'),
    set: on => ipcRenderer.invoke('ciel:minimize-to-tray:set', on),
    onChanged: callback => {
      const listener = (_event, status) => callback(status)
      ipcRenderer.on('ciel:minimize-to-tray:changed', listener)

      return () => ipcRenderer.removeListener('ciel:minimize-to-tray:changed', listener)
    }
  },
  setDisableF12: blocked => ipcRenderer.send('ciel:devtools:disable-f12', blocked),
  setF12ShortcutActive: active => ipcRenderer.send('ciel:f12ShortcutActive', Boolean(active)),
  onF12Shortcut: callback => {
    const listener = (_event, input) => callback(input)
    ipcRenderer.on('ciel:f12-shortcut', listener)

    return () => ipcRenderer.removeListener('ciel:f12-shortcut', listener)
  },
  setPreviewShortcutActive: active => ipcRenderer.send('ciel:previewShortcutActive', Boolean(active)),
  setPreviewGuestHidden: (webContentsId, hidden) =>
    ipcRenderer.send('ciel:preview-guest-hidden', { webContentsId, hidden: Boolean(hidden) }),
  openExternal: url => ipcRenderer.invoke('ciel:openExternal', url),
  freeTierChallenge: {
    // Load the account service's challenge page in a hidden window (revealed
    // only if the page asks for the human). Resolves with how it ended.
    run: request => ipcRenderer.invoke('ciel:freeTierChallenge:run', request)
  },
  mcpOauth: {
    // One-shot loopback listener for MCP OAuth against remote backends: bind
    // on this machine, hand redirectUri to mcp.servers.oauth.start, then wait
    // for the provider redirect and relay code/state via oauth.callback.
    listen: () => ipcRenderer.invoke('ciel:mcp-oauth:listen'),
    wait: (id, timeoutMs) => ipcRenderer.invoke('ciel:mcp-oauth:wait', id, timeoutMs),
    cancel: id => ipcRenderer.invoke('ciel:mcp-oauth:cancel', id)
  },
  openPreviewInBrowser: url => ipcRenderer.invoke('ciel:openPreviewInBrowser', url),
  reachPreviewUrl: url => ipcRenderer.invoke('ciel:preview:reach', url),
  setActiveConnectionRoute: route => ipcRenderer.send('ciel:connection:active-route', route),
  fetchLinkTitle: url => ipcRenderer.invoke('ciel:fetchLinkTitle', url),
  resolveFavicon: url => ipcRenderer.invoke('ciel:resolveFavicon', url),
  sanitizeWorkspaceCwd: cwd => ipcRenderer.invoke('ciel:workspace:sanitize', cwd),
  settings: {
    getDefaultProjectDir: () => ipcRenderer.invoke('ciel:setting:defaultProjectDir:get'),
    setDefaultProjectDir: dir => ipcRenderer.invoke('ciel:setting:defaultProjectDir:set', dir),
    pickDefaultProjectDir: () => ipcRenderer.invoke('ciel:setting:defaultProjectDir:pick')
  },
  zoom: {
    // Current zoom of this window, as { level, percent }.
    get: () => ipcRenderer.invoke('ciel:zoom:get'),
    // Synchronous zoom factor (1 = 100%). Coordinate math needs it in the
    // same tick as the event it converts, so no IPC round-trip here.
    factor: () => webFrame.getZoomFactor(),
    setPercent: percent => ipcRenderer.send('ciel:zoom:set-percent', percent),
    // Fires on every zoom change, including the Ctrl/Cmd +/-/0 shortcuts,
    // so the settings UI can stay in sync with the keyboard.
    onChanged: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('ciel:zoom:changed', listener)

      return () => ipcRenderer.removeListener('ciel:zoom:changed', listener)
    }
  },
  revealLogs: () => ipcRenderer.invoke('ciel:logs:reveal'),
  getRecentLogs: () => ipcRenderer.invoke('ciel:logs:recent'),
  // Fire-and-forget: persists a renderer error-boundary catch (with component
  // stack) to desktop.log so crashes survive the window (#79428).
  reportRendererError: report => ipcRenderer.send('ciel:logs:renderer-error', report),
  logLine: (line: string): void => ipcRenderer.send('ciel:logs:renderer-line', line),
  readDir: dirPath => ipcRenderer.invoke('ciel:fs:readDir', dirPath),
  gitRoot: startPath => ipcRenderer.invoke('ciel:fs:gitRoot', startPath),
  revealPath: targetPath => ipcRenderer.invoke('ciel:fs:reveal', targetPath),
  openDir: dirPath => ipcRenderer.invoke('ciel:fs:openDir', dirPath),
  desktopPluginsRoot: () => ipcRenderer.invoke('ciel:fs:desktopPluginsRoot'),
  reconcileDesktopPlugins: () => ipcRenderer.invoke('ciel:fs:reconcileDesktopPlugins'),
  logsRoot: (profile?: string) => ipcRenderer.invoke('ciel:fs:logsRoot', profile),
  renamePath: (targetPath, newName) => ipcRenderer.invoke('ciel:fs:rename', targetPath, newName),
  writeTextFile: (filePath, content) => ipcRenderer.invoke('ciel:fs:writeText', filePath, content),
  trashPath: targetPath => ipcRenderer.invoke('ciel:fs:trash', targetPath),
  git: {
    worktreeList: repoPath => ipcRenderer.invoke('ciel:git:worktreeList', repoPath),
    worktreeAdd: (repoPath, options) => ipcRenderer.invoke('ciel:git:worktreeAdd', repoPath, options),
    worktreeRemove: (repoPath, worktreePath, options) =>
      ipcRenderer.invoke('ciel:git:worktreeRemove', repoPath, worktreePath, options),
    branchSwitch: (repoPath, branch) => ipcRenderer.invoke('ciel:git:branchSwitch', repoPath, branch),
    branchList: repoPath => ipcRenderer.invoke('ciel:git:branchList', repoPath),
    baseBranchList: repoPath => ipcRenderer.invoke('ciel:git:baseBranchList', repoPath),
    repoStatus: repoPath => ipcRenderer.invoke('ciel:git:repoStatus', repoPath),
    fileDiff: (repoPath, filePath) => ipcRenderer.invoke('ciel:git:fileDiff', repoPath, filePath),
    scanRepos: (roots, options) => ipcRenderer.invoke('ciel:git:scanRepos', roots, options),
    review: {
      list: (repoPath, scope, baseRef) => ipcRenderer.invoke('ciel:git:review:list', repoPath, scope, baseRef),
      diff: (repoPath, filePath, scope, baseRef, staged) =>
        ipcRenderer.invoke('ciel:git:review:diff', repoPath, filePath, scope, baseRef, staged),
      stage: (repoPath, filePath) => ipcRenderer.invoke('ciel:git:review:stage', repoPath, filePath),
      unstage: (repoPath, filePath) => ipcRenderer.invoke('ciel:git:review:unstage', repoPath, filePath),
      revert: (repoPath, filePath) => ipcRenderer.invoke('ciel:git:review:revert', repoPath, filePath),
      revParse: (repoPath, ref) => ipcRenderer.invoke('ciel:git:review:revParse', repoPath, ref),
      commit: (repoPath, message, push) => ipcRenderer.invoke('ciel:git:review:commit', repoPath, message, push),
      commitContext: repoPath => ipcRenderer.invoke('ciel:git:review:commitContext', repoPath),
      push: repoPath => ipcRenderer.invoke('ciel:git:review:push', repoPath),
      shipInfo: repoPath => ipcRenderer.invoke('ciel:git:review:shipInfo', repoPath),
      prList: (repoPath, branches, numbers) =>
        ipcRenderer.invoke('ciel:git:review:prList', repoPath, branches, numbers),
      createPr: repoPath => ipcRenderer.invoke('ciel:git:review:createPr', repoPath)
    }
  },
  terminal: {
    attach: id => ipcRenderer.invoke('ciel:terminal:attach', id),
    cwd: id => ipcRenderer.invoke('ciel:terminal:cwd', id),
    dispose: id => ipcRenderer.invoke('ciel:terminal:dispose', id),
    resize: (id, size) => ipcRenderer.invoke('ciel:terminal:resize', id, size),
    start: options => ipcRenderer.invoke('ciel:terminal:start', options),
    write: (id, data) => ipcRenderer.invoke('ciel:terminal:write', id, data),
    onData: (id, callback) => {
      const channel = `ciel:terminal:${id}:data`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    },
    onExit: (id, callback) => {
      const channel = `ciel:terminal:${id}:exit`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    }
  },
  onClosePreviewRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('ciel:close-preview-requested', listener)

    return () => ipcRenderer.removeListener('ciel:close-preview-requested', listener)
  },
  onPreviewNav: callback => {
    const listener = (_event, command) => callback(command)
    ipcRenderer.on('ciel:preview-nav', listener)

    return () => ipcRenderer.removeListener('ciel:preview-nav', listener)
  },
  onOpenFolderRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('ciel:open-folder-requested', listener)

    return () => ipcRenderer.removeListener('ciel:open-folder-requested', listener)
  },
  onOpenUpdatesRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('ciel:open-updates', listener)

    return () => ipcRenderer.removeListener('ciel:open-updates', listener)
  },
  onDeepLink: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ciel:deep-link', listener)

    return () => ipcRenderer.removeListener('ciel:deep-link', listener)
  },
  signalDeepLinkReady: () => ipcRenderer.invoke('ciel:deep-link-ready'),
  probePluginRepo: payload => ipcRenderer.invoke('ciel:plugin:probe', payload),
  installDesktopPlugin: payload => ipcRenderer.invoke('ciel:plugin:installDesktop', payload),
  removeDesktopPlugin: payload => ipcRenderer.invoke('ciel:plugin:removeDesktop', payload),
  onWindowStateChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ciel:window-state-changed', listener)

    return () => ipcRenderer.removeListener('ciel:window-state-changed', listener)
  },
  onFocusSession: callback => {
    const listener = (_event, sessionId) => callback(sessionId)
    ipcRenderer.on('ciel:focus-session', listener)

    return () => ipcRenderer.removeListener('ciel:focus-session', listener)
  },
  onNotificationAction: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ciel:notification-action', listener)

    return () => ipcRenderer.removeListener('ciel:notification-action', listener)
  },
  onNotificationActivate: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ciel:notification-activate', listener)

    return () => ipcRenderer.removeListener('ciel:notification-activate', listener)
  },
  onExternalOpenFailed: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ciel:external-open-failed', listener)

    return () => ipcRenderer.removeListener('ciel:external-open-failed', listener)
  },
  onPreviewFileChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ciel:preview-file-changed', listener)

    return () => ipcRenderer.removeListener('ciel:preview-file-changed', listener)
  },
  onBackendExit: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ciel:backend-exit', listener)

    return () => ipcRenderer.removeListener('ciel:backend-exit', listener)
  },
  // Cooperative pool retirement (main → renderer): the pooled backend under
  // `poolKey` is being stopped for a foreground open. Park that scope; do not
  // redial into the slot it vacated.
  onPoolBackendRetiring: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ciel:pool:retiring', listener)

    return () => ipcRenderer.removeListener('ciel:pool:retiring', listener)
  },
  // Soft gateway-mode apply finished tearing down the primary backend. Renderer
  // should wipe session lists + re-dial without a window reload.
  onConnectionApplied: callback => {
    const listener = () => callback()
    ipcRenderer.on('ciel:connection:applied', listener)

    return () => ipcRenderer.removeListener('ciel:connection:applied', listener)
  },
  onPowerResume: callback => {
    const listener = () => callback()
    ipcRenderer.on('ciel:power-resume', listener)

    return () => ipcRenderer.removeListener('ciel:power-resume', listener)
  },
  // AC ↔ battery transitions; renderers slow their backstop polls on battery.
  getOnBattery: () => ipcRenderer.invoke('ciel:power-battery:get'),
  onBatteryChanged: callback => {
    const listener = (_event, onBattery) => callback(Boolean(onBattery))
    ipcRenderer.on('ciel:power-battery', listener)

    return () => ipcRenderer.removeListener('ciel:power-battery', listener)
  },
  onBootProgress: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ciel:boot-progress', listener)

    return () => ipcRenderer.removeListener('ciel:boot-progress', listener)
  },
  // First-launch bootstrap progress -- emitted by the install.ps1 stage
  // runner in main.ts (apps/desktop/electron/bootstrap-runner.ts).
  // Renderer's install overlay subscribes to live events and queries the
  // current snapshot via getBootstrapState() to recover after a devtools
  // reload mid-bootstrap.
  getBootstrapState: () => ipcRenderer.invoke('ciel:bootstrap:get'),
  probeLocalBackend: () => ipcRenderer.invoke('ciel:local-backend:probe'),
  continueBootstrapLocal: () => ipcRenderer.invoke('ciel:bootstrap:continue-local'),
  recycleBackend: profile => ipcRenderer.invoke('ciel:backend:recycle', profile),
  resetBootstrap: () => ipcRenderer.invoke('ciel:bootstrap:reset'),
  updateHold: {
    recheck: () => ipcRenderer.invoke('ciel:update-hold:recheck'),
    quit: () => ipcRenderer.invoke('ciel:update-hold:quit'),
    startAnyway: (request: { holdId: string; confirmed: true }) =>
      ipcRenderer.invoke('ciel:update-hold:start-anyway', request)
  },
  repairBootstrap: () => ipcRenderer.invoke('ciel:bootstrap:repair'),
  cancelBootstrap: () => ipcRenderer.invoke('ciel:bootstrap:cancel'),
  onBootstrapEvent: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('ciel:bootstrap:event', listener)

    return () => ipcRenderer.removeListener('ciel:bootstrap:event', listener)
  },
  getVersion: () => ipcRenderer.invoke('ciel:version'),
  relaunchApp: () => ipcRenderer.invoke('ciel:app:relaunch'),
  getMachineProfile: () => ipcRenderer.invoke('ciel:machine:profile'),
  getRemoteDisplayReason: () => ipcRenderer.invoke('ciel:get-remote-display-reason'),
  uninstall: {
    summary: () => ipcRenderer.invoke('ciel:uninstall:summary'),
    run: mode => ipcRenderer.invoke('ciel:uninstall:run', { mode }),
    openAppsSettings: () => ipcRenderer.invoke('ciel:uninstall:openAppsSettings')
  },
  updates: {
    check: opts => ipcRenderer.invoke('ciel:updates:check', opts),
    apply: opts => ipcRenderer.invoke('ciel:updates:apply', opts),
    setChannel: name => ipcRenderer.invoke('ciel:updates:channel:set', name),
    onProgress: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('ciel:updates:progress', listener)

      return () => ipcRenderer.removeListener('ciel:updates:progress', listener)
    },
    takePendingRun: () => ipcRenderer.invoke('ciel:updates:metric:take'),
    ackPendingRun: sent => ipcRenderer.invoke('ciel:updates:metric:ack', sent),
    onPendingRun: callback => {
      const listener = () => callback()
      ipcRenderer.on('ciel:updates:metric:pending', listener)

      return () => ipcRenderer.removeListener('ciel:updates:metric:pending', listener)
    }
  },
  desktopMetrics: {
    setEnabled: (on, profile) => ipcRenderer.invoke('ciel:desktop-metrics:set-enabled', on, profile),
    takeRendererCrashes: () => ipcRenderer.invoke('ciel:desktop-metrics:crash:take'),
    ackRendererCrashes: sent => ipcRenderer.invoke('ciel:desktop-metrics:crash:ack', sent)
  },
  themes: {
    fetchMarketplace: id => ipcRenderer.invoke('ciel:vscode-theme:fetch', id),
    searchMarketplace: query => ipcRenderer.invoke('ciel:vscode-theme:search', query)
  },
  // Find-in-page (Ctrl/Cmd+F): delegates to Electron's
  // webContents.findInPage on the IPC sender's window so a Cmd+F pressed
  // in a secondary session window searches THAT window, not the primary.
  // `onFoundInPage` returns the unsubscribe fn; the renderer wires it via
  // `initFindInPageListener` in store/find-in-page.ts and tears it down
  // when the FindBar unmounts.
  findInPage: (query, options) => ipcRenderer.invoke('ciel:find-in-page', query, options),
  stopFindInPage: () => ipcRenderer.invoke('ciel:stop-find-in-page'),
  onFoundInPage: callback => {
    const listener = (_event, result) => callback(result)
    ipcRenderer.on('ciel:found-in-page', listener)

    return () => ipcRenderer.removeListener('ciel:found-in-page', listener)
  },
  // Main-process `before-input-event` forwards Ctrl/Cmd+F here so renderer
  // can open the FindBar even when the GTK compositor has already grabbed
  // the chord at the windowing layer (#81727).
  onOpenFindBarRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('ciel:open-find-bar', listener)

    return () => ipcRenderer.removeListener('ciel:open-find-bar', listener)
  }
})
