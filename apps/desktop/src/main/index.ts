// Electron main process: window, tray, notifications, clipboard and IPC.
import { isKnownMediaLink, OP_TEXT, type ApiInfo, type ConvertSettings, type DownloadRequest, type HistoryQuery, type Job, type OpStartResult, type OpSummary, type Section, type Settings } from '@sparky/core'
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, nativeTheme, Notification, shell, Tray } from 'electron'
import { autoUpdater } from 'electron-updater'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { apiPort, createEngine, DEFAULT_API_PORT, ensureToken, opById, OpInputError, startApiServer, tokenPath, type ApiServer, type Engine } from '@sparky/engine'

const isDev = !app.isPackaged
const resources = isDev ? path.join(__dirname, '../../resources') : process.resourcesPath
const bundledBin = path.join(resources, 'bin')
/** yt-dlp updates itself, so it runs from a writable copy in the user's profile. */
const userBin = path.join(app.getPath('userData'), 'bin')

let win: BrowserWindow | null = null
let tray: Tray | null = null
let engine: Engine
/** The local HTTP API agents use; null when it could not bind (another Sparky or program holds the port). */
let api: ApiServer | null = null
let quitting = false
let lastOffered = ''
const dismissed = new Set<string>()

let ready = false
/** Windows can drop a notification's click handler if nothing holds on to it. */
const liveNotifications = new Set<Notification>()

// A second copy only hands focus to the first one, then leaves straight away.
const primary = app.requestSingleInstanceLock()
if (!primary) app.exit(0)
app.setAppUserModelId('com.sparky.app')

function ensureWritableYtDlp(): void {
  const name = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  const src = path.join(bundledBin, name)
  const dest = path.join(userBin, name)
  try {
    fs.mkdirSync(userBin, { recursive: true })
    // Copy on first run, and again when a newer Sparky ships a newer yt-dlp.
    if (fs.existsSync(src) && (!fs.existsSync(dest) || fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs)) {
      fs.copyFileSync(src, dest)
    }
  } catch (e) {
    console.error('Could not copy yt-dlp', e)
  }
}

function send(channel: string, ...args: unknown[]): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args)
}

function showWindow(): void {
  // Launched again while still starting up: the window appears when startup finishes.
  if (!ready) return
  if (!win) return createWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function navigate(section: Section, url?: string): void {
  showWindow()
  send('navigate', { section, url })
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 880,
    minHeight: 600,
    show: false,
    frame: false,
    // Matches the saved theme (dark by default) so the first frame is never a white flash.
    backgroundColor: engine.getSettings().theme === 'light' || (engine.getSettings().theme === 'system' && !nativeTheme.shouldUseDarkColors) ? '#fafafa' : '#0a0a0a',
    icon: path.join(resources, 'icon.png'),
    title: 'Sparky',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })
  win.once('ready-to-show', () => win?.show())
  win.on('maximize', () => send('window:maximized', true))
  win.on('unmaximize', () => send('window:maximized', false))
  win.on('focus', () => void offerClipboardLink())
  // Let Windows sign out or shut down instead of hiding to the tray.
  win.on('session-end', () => {
    quitting = true
  })
  win.on('close', (e) => {
    if (!quitting && engine?.getSettings().closeToTray) {
      e.preventDefault()
      win?.hide()
    }
  })
  win.on('closed', () => {
    win = null
  })
  // Links open in the browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e) => e.preventDefault())

  if (isDev && process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(path.join(__dirname, '../renderer/index.html'))
}

async function offerClipboardLink(): Promise<void> {
  if (!engine?.getSettings().clipboardDetection) return
  const text = (await clipboard.readText()).trim()
  if (text && text !== lastOffered && !dismissed.has(text) && isKnownMediaLink(text)) {
    lastOffered = text
    send('clipboard:offer', { url: text })
  }
}

function trayIcon(): Electron.NativeImage {
  const img = nativeImage.createFromPath(path.join(resources, 'tray.png'))
  return img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 16, height: 16 })
}

function updateTray(jobs: Job[]): void {
  if (!tray) return
  const running = jobs.filter((j) => j.status === 'running')
  const waiting = jobs.filter((j) => j.status === 'queued').length
  const items: Electron.MenuItemConstructorOptions[] = running.length
    ? running.slice(0, 6).map((j) => ({ label: `${j.title.slice(0, 48)}  ${j.progress >= 0 ? `${Math.round(j.progress * 100)}%` : '…'}`, enabled: false }))
    : [{ label: 'Nothing running', enabled: false }]
  if (waiting) items.push({ label: `${waiting} waiting`, enabled: false })
  tray.setToolTip(running.length ? `Sparky · ${running.length} running` : 'Sparky')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      ...items,
      { type: 'separator' },
      { label: 'Paste link', click: async () => navigate('download', (await clipboard.readText()).trim()) },
      { label: 'Open Sparky', click: showWindow },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          quitting = true
          app.quit()
        },
      },
    ]),
  )
}

function notifyFinished(job: Job): void {
  send('queue:finished', job)
  const s = engine.getSettings()
  if (!s.notifications || !Notification.isSupported()) return
  if (job.status === 'canceled') return
  // When the window is in front, the in-app toast is enough.
  if (win?.isVisible() && win.isFocused()) return
  const ok = job.status === 'done'
  const n = new Notification({
    title: ok ? `${opById(job.op)?.doneLabel ?? OP_TEXT.unknown.done}: ${job.title}` : `Couldn’t finish: ${job.title}`,
    body: ok ? (job.outputs.length > 1 ? `${job.outputs.length} files saved.` : 'Click to open it.') : (job.error ?? 'Something went wrong.'),
    icon: path.join(resources, 'icon.png'),
    silent: false,
  })
  liveNotifications.add(n)
  n.on('close', () => liveNotifications.delete(n))
  n.on('click', () => {
    liveNotifications.delete(n)
    const out = job.outputs[0]
    if (ok && out) {
      if (job.outputs.length > 1) shell.showItemInFolder(out)
      else void shell.openPath(out)
    } else navigate('queue')
  })
  n.show()
}

async function printToPdf(htmlPath: string, pdfPath: string): Promise<void> {
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } })
  try {
    await w.loadFile(htmlPath)
    const pdf = await w.webContents.printToPDF({ printBackground: true, pageSize: 'A4', preferCSSPageSize: true })
    await fsp.writeFile(pdfPath, pdf)
  } finally {
    w.destroy()
  }
}

/** Input the engine refuses comes back as data, so the UI shows its plain message instead of Electron's "Error invoking remote method". */
function refusable(start: () => Job[]): OpStartResult {
  try {
    return { ok: true, jobs: start() }
  } catch (e) {
    if (!(e instanceof OpInputError)) throw e
    return { ok: false, error: { code: e.code, message: e.message, field: e.field } }
  }
}

function registerIpc(): void {
  const handle = <A extends unknown[], R>(channel: string, fn: (...args: A) => R | Promise<R>) =>
    ipcMain.handle(channel, (_e, ...args) => fn(...(args as A)))

  handle('system:info', () => engine.systemInfo())

  handle('files:pick', async () => {
    const res = await dialog.showOpenDialog(win!, { properties: ['openFile', 'multiSelections'] })
    return res.canceled ? [] : res.filePaths
  })
  handle('files:pickFolder', async () => {
    const res = await dialog.showOpenDialog(win!, { properties: ['openDirectory', 'createDirectory'] })
    return res.canceled ? null : (res.filePaths[0] ?? null)
  })
  handle('files:probe', (paths: string[]) => engine.probe(paths))
  handle('files:showInFolder', (p: string) => shell.showItemInFolder(p))
  handle('files:open', async (p: string) => {
    const err = await shell.openPath(p)
    if (err) throw new Error(err)
  })

  handle('convert:start', (paths: string[], s: ConvertSettings) => engine.startConvert(paths, s))
  handle('download:inspect', (url: string) => engine.inspect(url))
  handle('download:start', (req: DownloadRequest) => engine.startDownload(req))

  handle('ops:list', (): OpSummary[] => engine.listOps())
  handle('ops:targets', (paths: string[]) => engine.targetsFor(paths))
  handle('ops:start', (op: string, args: unknown) => refusable(() => engine.startOp(op, args)))

  handle('queue:list', () => engine.listJobs())
  handle('queue:pause', (id: string) => engine.pause(id))
  handle('queue:resume', (id: string) => engine.resume(id))
  handle('queue:cancel', (id: string) => engine.cancelJob(id))
  handle('queue:retry', (id: string) => engine.retry(id))
  handle('queue:remove', (id: string) => engine.remove(id))
  handle('queue:reorder', (ids: string[]) => engine.reorder(ids))
  handle('queue:pauseAll', () => engine.pauseAll())
  handle('queue:resumeAll', () => engine.resumeAll())
  handle('queue:clearFinished', () => engine.clearFinished())

  handle('history:search', (query: HistoryQuery) => engine.history(query))
  handle('history:rerun', (id: string) => refusable(() => engine.rerun(id)))
  handle('history:remove', (id: string) => engine.removeHistory(id))
  handle('history:clear', () => engine.clearHistory())

  handle('settings:get', () => engine.getSettings())
  handle('settings:set', (patch: Partial<Settings>) => {
    const s = engine.setSettings(patch)
    if (patch.theme) nativeTheme.themeSource = s.theme
    return s
  })

  handle('tools:updateYtDlp', () => engine.updateYtDlp())
  handle('clipboard:dismiss', (url: string) => void dismissed.add(url))

  handle('window:isMaximized', () => win?.isMaximized() ?? false)
  ipcMain.on('window:minimize', () => win?.minimize())
  ipcMain.on('window:toggleMaximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()))
  ipcMain.on('window:close', () => win?.close())

  handle('shell:openExternal', (url: string) => {
    if (/^https?:|^mailto:/.test(url)) return shell.openExternal(url)
  })
  handle('clipboard:write', (text: string) => clipboard.writeText(text))

  // The token never crosses IPC or the clipboard (Windows keeps clipboard history and may sync it): the renderer can only show the file.
  handle('api:info', (): ApiInfo => ({ running: api !== null, port: api?.port ?? configuredApiPort(), tokenPath: tokenPath(app.getPath('userData')) }))
  handle('api:revealToken', () => {
    ensureToken(app.getPath('userData'))
    shell.showItemInFolder(tokenPath(app.getPath('userData')))
  })
}

function configuredApiPort(): number {
  try {
    return apiPort()
  } catch {
    return DEFAULT_API_PORT
  }
}

async function startApi(): Promise<void> {
  try {
    const started = await startApiServer(engine, { dataDir: app.getPath('userData'), host: 'app', version: app.getVersion() })
    // Quit began while it was binding.
    if (shutDown) await started.close()
    else api = started
  } catch (e) {
    // The app works without it; agents fall back to running the engine themselves.
    console.error('Sparky API not started', e)
  }
}

app.on('second-instance', showWindow)

let shutDown = false
app.on('before-quit', (e) => {
  quitting = true
  if (shutDown || !engine) return
  // Give running jobs a moment to stop and remove their half-written files.
  e.preventDefault()
  shutDown = true
  void (api?.close() ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => engine.shutdown())
    .finally(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !engine?.getSettings().closeToTray) app.quit()
})

if (primary) app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  ensureWritableYtDlp()
  engine = await createEngine({
    binDirs: [userBin, bundledBin],
    dataDir: app.getPath('userData'),
    tempDir: path.join(app.getPath('temp'), 'Sparky'),
    defaultRoot: path.join(app.getPath('downloads'), 'Sparky'),
    appVersion: app.getVersion(),
    host: { printToPdf, trash: (p) => shell.trashItem(p) },
  })
  nativeTheme.themeSource = engine.getSettings().theme

  registerIpc()
  engine.on('change', (jobs) => {
    send('queue:change', jobs)
    updateTray(jobs)
  })
  engine.on('finished', notifyFinished)
  void startApi()

  ready = true
  createWindow()
  tray = new Tray(trayIcon())
  tray.on('click', showWindow)
  updateTray([])

  if (!isDev) {
    // App updates come from GitHub Releases; yt-dlp keeps itself current separately.
    autoUpdater.checkForUpdatesAndNotify().catch(() => undefined)
    void engine.updateYtDlp()
  }
})
