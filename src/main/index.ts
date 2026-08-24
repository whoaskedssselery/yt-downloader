import type { ChildProcess } from 'node:child_process'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, readdir, rename, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import {
  assertSafeAudioFormat,
  assertSafeContainer,
  assertSafeFormatId,
  assertYoutubeUrl,
  cookiesArgs,
  cookiesFilePath,
  ffmpegBinaryPath,
  friendlyYtDlpError,
  getYtDlp,
  sanitizeFilenamePart
} from './ytdlp'

interface ActiveDownload {
  controller: AbortController
  process: ChildProcess | undefined
}

// Minimal shape of yt-dlp's --dump-json output — only the fields we read.
interface YtDlpFormatRaw {
  format_id: string | number
  ext: string
  height?: number
  fps?: number
  vcodec?: string
  acodec?: string
  filesize?: number
  filesize_approx?: number
  abr?: number
}

interface YtDlpVideoInfoRaw {
  id: string
  title: string
  uploader?: string
  channel?: string
  thumbnail?: string
  duration?: number
  formats?: YtDlpFormatRaw[]
}

const activeDownloads = new Map<string, ActiveDownload>()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// yt-dlp-wrap's own AbortSignal handling shells out to `taskkill` and
// silently swallows any failure, so a cancel that doesn't actually land is
// invisible. Kill the process tree ourselves too, with the failure surfaced
// to the console instead of disappearing.
function killProcessTree(proc: ChildProcess | undefined): void {
  if (!proc?.pid) return
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(proc.pid), '/T', '/F'], (err) => {
      if (err) console.error('[cancel] taskkill failed:', err.message)
    })
  } else {
    try {
      process.kill(-proc.pid, 'SIGKILL')
    } catch (err) {
      console.error('[cancel] process.kill failed:', err)
    }
  }
}

async function unlinkWithRetry(path: string, attempts = 10): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      await unlink(path)
      return
    } catch {
      // Windows: AV/indexer can hold a freshly-written file open for a few
      // seconds — back off (up to ~1.5s per step, ~15s total) and retry
      // instead of giving up after one shot.
      await sleep(Math.min(1500, 200 * (i + 1)))
    }
  }
}

// yt-dlp deletes the intermediate download after merge/extraction, but on
// Windows another process (AV scan, indexer) can briefly hold the file open
// and make that delete silently fail while yt-dlp still exits 0. Sweep for
// leftovers with our known base name and remove anything but the final file.
async function cleanupIntermediateFiles(
  outputDir: string,
  baseName: string,
  finalExt: string
): Promise<void> {
  try {
    const entries = await readdir(outputDir)
    const finalName = `${baseName}.${finalExt}`
    await Promise.all(
      entries
        .filter((name) => name.startsWith(baseName) && name !== finalName)
        .map((name) => unlinkWithRetry(join(outputDir, name)))
    )
  } catch {
    // best-effort cleanup only
  }
}

// A cancelled download shouldn't leave anything behind — unlike a finished
// one, there's no "final" file to keep, so sweep every file matching this
// attempt's base name (partial .part downloads, half-merged output, etc).
async function cleanupAllFiles(outputDir: string, baseName: string): Promise<void> {
  try {
    const entries = await readdir(outputDir)
    await Promise.all(
      entries
        .filter((name) => name.startsWith(baseName))
        .map((name) => unlinkWithRetry(join(outputDir, name)))
    )
  } catch {
    // best-effort cleanup only
  }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1040,
    height: 780,
    minWidth: 760,
    minHeight: 520,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged) {
    win.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
      console.log(`[renderer] ${message} (${sourceId}:${line})`)
    })
    win.webContents.on('render-process-gone', (_event, details) => {
      console.log('[renderer] gone:', details)
    })
  }

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('app:downloadsDir', () => app.getPath('downloads'))

  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('app:hasCookiesFile', () => existsSync(cookiesFilePath))

  ipcMain.handle('app:importCookiesFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Netscape cookies.txt', extensions: ['txt'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return false
    await copyFile(result.filePaths[0], cookiesFilePath)
    return true
  })

  ipcMain.handle('yt:info', async (_event, url: string) => {
    const safeUrl = assertYoutubeUrl(url)
    const ytDlp = await getYtDlp()
    // Without an explicit -f, yt-dlp-wrap forces "-f best", which several
    // YouTube videos no longer expose as a single pre-merged format — pass a
    // selector with a guaranteed fallback so info lookup never fails here.
    let raw: YtDlpVideoInfoRaw
    try {
      raw = await ytDlp.getVideoInfo([
        safeUrl,
        '--no-playlist',
        '-f',
        'bestvideo*+bestaudio/best',
        ...cookiesArgs()
      ])
    } catch (err) {
      throw new Error(friendlyYtDlpError(err instanceof Error ? err.message : String(err)))
    }

    const formats: YtDlpFormatRaw[] = Array.isArray(raw.formats) ? raw.formats : []

    const videoFormats = formats
      .filter((f) => f.vcodec && f.vcodec !== 'none')
      .map((f) => ({
        formatId: String(f.format_id),
        ext: f.ext,
        height: f.height ?? null,
        fps: f.fps ?? null,
        vcodec: f.vcodec,
        hasAudio: !!f.acodec && f.acodec !== 'none',
        filesize: f.filesize ?? f.filesize_approx ?? null
      }))
      .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.fps ?? 0) - (a.fps ?? 0))

    const audioFormats = formats
      .filter((f) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'))
      .map((f) => ({
        formatId: String(f.format_id),
        ext: f.ext,
        abr: f.abr ?? null,
        acodec: f.acodec,
        filesize: f.filesize ?? f.filesize_approx ?? null
      }))
      .sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0))

    return {
      id: raw.id,
      title: raw.title,
      uploader: raw.uploader ?? raw.channel,
      thumbnail: raw.thumbnail,
      duration: raw.duration,
      videoFormats,
      audioFormats
    }
  })

  ipcMain.handle('yt:download', async (event, payload) => {
    const {
      downloadId,
      url,
      mode,
      formatId,
      audioFormat,
      videoContainer,
      outputDir,
      title,
      videoId
    } = payload as {
      downloadId: string
      url: string
      mode: 'video' | 'audio'
      formatId: string
      audioFormat: string
      videoContainer: string
      outputDir: string
      title: string
      videoId: string
    }

    const safeUrl = assertYoutubeUrl(url)
    const safeFormatId = assertSafeFormatId(formatId)
    const ytDlp = await getYtDlp()

    const baseName = `${sanitizeFilenamePart(title)} [${sanitizeFilenamePart(videoId)}]`
    const finalExt =
      mode === 'video' ? assertSafeContainer(videoContainer) : assertSafeAudioFormat(audioFormat)
    // Video and audio downloads of the same video share this baseName, so a
    // previously finished download (e.g. the .mp4) sits right next to this
    // run's own intermediates. Download under a per-run temp marker instead
    // of the clean name, so cleanup can only ever touch THIS run's files,
    // then rename to the clean name once we've confirmed success.
    const tempBaseName = `${baseName}.${downloadId}`
    const outputTemplate = join(outputDir, `${tempBaseName}.%(ext)s`)
    const args =
      mode === 'video'
        ? [
            safeUrl,
            '-f',
            // Video-only streams need a separate audio track merged in; prefer
            // m4a/AAC since opus-in-mp4 silently fails to play in some
            // players even though the track is technically present.
            `${safeFormatId}+bestaudio[ext=m4a]/${safeFormatId}+bestaudio/best`,
            '--merge-output-format',
            finalExt,
            '--ffmpeg-location',
            ffmpegBinaryPath,
            '-o',
            outputTemplate,
            '--no-playlist',
            ...cookiesArgs()
          ]
        : [
            safeUrl,
            '-f',
            safeFormatId,
            '-x',
            '--audio-format',
            finalExt,
            '--audio-quality',
            '0',
            '--ffmpeg-location',
            ffmpegBinaryPath,
            '-o',
            outputTemplate,
            '--no-playlist',
            ...cookiesArgs()
          ]

    const controller = new AbortController()
    const active: ActiveDownload = { controller, process: undefined }
    activeDownloads.set(downloadId, active)

    return new Promise<{ ok: true } | { ok: false; error: string; cancelled?: boolean }>(
      (resolve) => {
        // On POSIX, spawn yt-dlp as its own process-group leader so
        // killProcessTree's negative-pid kill can reach it *and* its ffmpeg
        // child — without `detached`, the child stays in our group and a
        // group-kill targets a group that doesn't exist, silently no-op'ing.
        const spawnOptions = process.platform === 'win32' ? {} : { detached: true }
        const emitter = ytDlp.exec(args, spawnOptions, controller.signal)
        active.process = emitter.ytDlpProcess

        emitter.on('progress', (progress) => {
          event.sender.send('yt:progress', { downloadId, progress })
        })
        emitter.on('error', (error) => {
          activeDownloads.delete(downloadId)
          if (controller.signal.aborted) {
            void cleanupAllFiles(outputDir, tempBaseName)
            resolve({ ok: false, error: '', cancelled: true })
            return
          }
          resolve({ ok: false, error: friendlyYtDlpError(error.message) })
        })
        emitter.on('close', async (code) => {
          activeDownloads.delete(downloadId)
          if (controller.signal.aborted) {
            void cleanupAllFiles(outputDir, tempBaseName)
            resolve({ ok: false, error: '', cancelled: true })
            return
          }
          if (code !== 0 && code !== null) {
            resolve({ ok: false, error: `yt-dlp завершился с кодом ${code}` })
            return
          }

          // yt-dlp exiting 0 doesn't guarantee the postprocessor actually
          // produced a real file (e.g. ffmpeg got killed mid-conversion) —
          // verify the temp final file exists and is non-empty before
          // trusting it, and don't touch anything else unless it does.
          const tempFinalPath = join(outputDir, `${tempBaseName}.${finalExt}`)
          let finalSize = 0
          try {
            finalSize = (await stat(tempFinalPath)).size
          } catch {
            finalSize = 0
          }

          if (finalSize > 0) {
            const cleanFinalPath = join(outputDir, `${baseName}.${finalExt}`)
            try {
              await rename(tempFinalPath, cleanFinalPath)
            } catch {
              // Cross-device or locked rename failure — leave it under the
              // temp name rather than lose the file; still counts as success.
            }
            // Don't make the user wait on cleanup retries (up to ~15s worst
            // case) — report success now and let it finish in the background.
            void cleanupIntermediateFiles(outputDir, tempBaseName, finalExt)
            resolve({ ok: true })
          } else {
            resolve({
              ok: false,
              error: 'Файл не был создан (сбой конвертации). Попробуйте скачать ещё раз.'
            })
          }
        })
      }
    )
  })

  ipcMain.handle('yt:cancel', async (_event, downloadId: string) => {
    const active = activeDownloads.get(downloadId)
    if (active) {
      active.controller.abort()
      killProcessTree(active.process)
      activeDownloads.delete(downloadId)
      return true
    }
    return false
  })

  ipcMain.handle('shell:openFolder', async (_event, folderPath: string) => {
    await shell.openPath(folderPath)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
