import { chmodSync, createWriteStream, existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import ffmpegPath from 'ffmpeg-static'
import yauzl from 'yauzl'

// yt-dlp-wrap is a CJS package compiled from TS (`exports.default = YTDlpWrap`).
// Importing it as ESM double-wraps the default export under Node's CJS/ESM
// interop, so load it via require() instead, which resolves it correctly.
const require = createRequire(import.meta.url)
const YTDlpWrap = require('yt-dlp-wrap').default as typeof import('yt-dlp-wrap').default

const binDir = join(app.getPath('userData'), 'bin')
const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
export const ytDlpBinaryPath = join(binDir, binaryName)
export const ffmpegBinaryPath = (ffmpegPath as string).replace('app.asar', 'app.asar.unpacked')
export const cookiesFilePath = join(app.getPath('userData'), 'cookies.txt')

// YouTube blocks anonymous requests with a bot-check; reading cookies live
// out of a running browser (--cookies-from-browser) is unreliable on Windows
// (locked/encrypted cookie DB), so we rely on a manually exported
// Netscape-format cookies.txt instead, when the user has provided one.
export function cookiesArgs(): string[] {
  return existsSync(cookiesFilePath) ? ['--cookies', cookiesFilePath] : []
}

let ytDlpWrapPromise: Promise<InstanceType<typeof YTDlpWrap>> | null = null

// Cache the in-flight promise, not just the resolved instance — two IPC
// calls arriving before the first setup finishes would otherwise both see
// no cached wrapper and race to download the binary twice.
export function getYtDlp(): Promise<InstanceType<typeof YTDlpWrap>> {
  if (!ytDlpWrapPromise)
    ytDlpWrapPromise = setUpYtDlp().catch((err) => {
      ytDlpWrapPromise = null
      throw err
    })
  return ytDlpWrapPromise
}

async function setUpYtDlp(): Promise<InstanceType<typeof YTDlpWrap>> {
  if (!existsSync(ytDlpBinaryPath)) {
    await mkdir(dirname(ytDlpBinaryPath), { recursive: true })
    await YTDlpWrap.downloadFromGithub(ytDlpBinaryPath)
  }

  // YouTube's "n" signature challenge requires a JS runtime; yt-dlp looks
  // for `deno` on PATH, so make sure our downloaded copy is reachable there.
  await ensureDeno()
  process.env.PATH = `${binDir}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`

  return new YTDlpWrap(ytDlpBinaryPath)
}

function denoAssetName(): string | null {
  const { platform, arch } = process
  if (platform === 'win32') return arch === 'arm64' ? null : 'deno-x86_64-pc-windows-msvc.zip'
  if (platform === 'darwin') {
    return arch === 'arm64' ? 'deno-aarch64-apple-darwin.zip' : 'deno-x86_64-apple-darwin.zip'
  }
  if (platform === 'linux') {
    return arch === 'arm64'
      ? 'deno-aarch64-unknown-linux-gnu.zip'
      : 'deno-x86_64-unknown-linux-gnu.zip'
  }
  return null
}

async function extractSingleFile(zipPath: string, destPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err)
      zipfile.readEntry()
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry()
          return
        }
        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) return reject(streamErr)
          const out = createWriteStream(destPath)
          readStream.pipe(out)
          out.on('finish', () => resolve())
          out.on('error', reject)
        })
      })
      zipfile.on('error', reject)
    })
  })
}

let denoEnsured = false

async function ensureDeno(): Promise<void> {
  if (denoEnsured) return
  const assetName = denoAssetName()
  if (!assetName) {
    denoEnsured = true
    return
  }

  const denoBinaryPath = join(binDir, process.platform === 'win32' ? 'deno.exe' : 'deno')
  if (existsSync(denoBinaryPath)) {
    denoEnsured = true
    return
  }

  await mkdir(binDir, { recursive: true })
  const zipPath = join(binDir, 'deno-download.zip')
  try {
    await YTDlpWrap.downloadFile(
      `https://github.com/denoland/deno/releases/latest/download/${assetName}`,
      zipPath
    )
    await extractSingleFile(zipPath, denoBinaryPath)
    if (process.platform !== 'win32') chmodSync(denoBinaryPath, 0o755)
  } catch {
    // Not fatal: yt-dlp still works without a JS runtime, just with a
    // warning and possibly fewer available formats for some videos.
  } finally {
    await rm(zipPath, { force: true })
  }
  denoEnsured = true
}

const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be'
])

export function assertYoutubeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    throw new Error('Ссылка некорректна')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Ссылка должна начинаться с http(s)')
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error('Поддерживаются только ссылки youtube.com / youtu.be')
  }
  return parsed.toString()
}

// yt-dlp format_ids are alphanumeric with dots/dashes/underscores; the "+"
// (combine streams) and "/" (fallback) selector syntax is appended by us,
// not accepted here, so a crafted formatId can't rewrite the selector.
const SAFE_FORMAT_ID = /^[\w.-]+$/

export function assertSafeFormatId(formatId: string): string {
  if (!SAFE_FORMAT_ID.test(formatId)) {
    throw new Error('Некорректный идентификатор формата')
  }
  return formatId
}

const ALLOWED_AUDIO_FORMATS = new Set(['mp3', 'm4a', 'opus', 'wav'])

export function assertSafeAudioFormat(audioFormat: string): string {
  if (!ALLOWED_AUDIO_FORMATS.has(audioFormat)) {
    throw new Error('Некорректный аудиоформат')
  }
  return audioFormat
}

const ALLOWED_CONTAINERS = new Set(['mp4', 'mkv', 'webm'])

export function assertSafeContainer(container: string): string {
  if (!ALLOWED_CONTAINERS.has(container)) {
    throw new Error('Некорректный контейнер видео')
  }
  return container
}

// We build the output filename ourselves (instead of relying on yt-dlp's
// own %(title)s templating) so we know its exact final name up front and
// can clean up any intermediate file yt-dlp fails to delete after
// extraction/merge (a real race on Windows when something else briefly
// holds the file open).
export function sanitizeFilenamePart(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150)
}

// yt-dlp-wrap surfaces failures as one Error whose message is the raw
// stdout+stderr dump; translate the recognizable cases into something a user
// can act on instead of a wall of English log lines.
export function friendlyYtDlpError(raw: string): string {
  if (/cookies are no longer valid/i.test(raw)) {
    return 'Cookies устарели (Chrome периодически их обновляет). Экспортируйте cookies.txt заново и загрузите его кнопкой в шапке.'
  }
  if (/Sign in to confirm/i.test(raw)) {
    return 'YouTube требует подтверждения, что вы не бот. Загрузите cookies.txt кнопкой в шапке.'
  }
  if (/n challenge solving failed|page needs to be reloaded/i.test(raw)) {
    return 'Не удалось решить JS-челлендж YouTube. Попробуйте ещё раз — JS-рантайм подтягивается при первом обращении.'
  }
  if (/Requested format is not available/i.test(raw)) {
    return 'Выбранный формат больше недоступен на YouTube. Нажмите «Найти» ещё раз и выберите другое качество.'
  }
  if (/Failed to decrypt with DPAPI/i.test(raw)) {
    return 'Chrome шифрует cookies способом, который yt-dlp пока не умеет читать на этой версии Windows/Chrome (известная проблема, не зависит от того, закрыт ли Chrome). Импортируйте cookies.txt вручную.'
  }
  if (/Could not copy .* cookie database/i.test(raw)) {
    return 'Не удалось прочитать cookies браузера (файл занят — закройте Chrome полностью, включая фоновые процессы). Либо импортируйте cookies.txt вручную.'
  }
  return raw.split('\n')[0]?.trim() || raw
}
