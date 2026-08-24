import { Cookie as IconCookie } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import type { DownloadProgress, VideoFormat, VideoInfo } from '../../preload'
import Button from './components/Button'
import {
  IconAlert,
  IconDownload,
  IconFilm,
  IconFolder,
  IconLink,
  IconMoon,
  IconSearch,
  IconSun,
  IconWave,
  Spinner
} from './components/icons'
import Select, { type SelectOption } from './components/Select'
import { useGlobalScrollFade, useTheme } from './hooks'

type Mode = 'video' | 'audio'

const BOT_CHECK_MARKER = 'YouTube требует подтверждения, что вы не бот'

function formatSize(bytes: number | null): string {
  if (!bytes) return '—'
  const mb = bytes / (1024 * 1024)
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} ГБ` : `${mb.toFixed(1)} МБ`
}

function formatDuration(seconds?: number): string {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`
}

function videoOptionLabel(f: VideoFormat): string {
  const parts = [f.height ? `${f.height}p` : f.formatId, f.fps ? `${f.fps}fps` : null].filter(
    Boolean
  )
  return parts.join(' ')
}

function codecLabel(vcodec: string): string {
  if (vcodec.startsWith('avc1') || vcodec.startsWith('h264')) return 'H.264'
  if (vcodec.startsWith('vp9') || vcodec.startsWith('vp09')) return 'VP9'
  if (vcodec.startsWith('av01')) return 'AV1'
  return vcodec.split('.')[0] ?? vcodec
}

export default function App() {
  const [theme, toggleTheme] = useTheme()
  useGlobalScrollFade()

  const [url, setUrl] = useState('')
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [info, setInfo] = useState<VideoInfo | null>(null)
  const [infoError, setInfoError] = useState<string | null>(null)

  const [mode, setMode] = useState<Mode>('video')
  const [videoFormatId, setVideoFormatId] = useState<string>('')
  const [videoContainer, setVideoContainer] = useState('mp4')
  const [audioFormatId, setAudioFormatId] = useState<string>('')
  const [audioExt, setAudioExt] = useState('mp3')

  const [outputDir, setOutputDir] = useState<string | null>(null)
  const [downloadId, setDownloadId] = useState<string | null>(null)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadDone, setDownloadDone] = useState(false)

  const [hasCookies, setHasCookies] = useState<boolean | null>(null)

  useEffect(() => {
    window.api.getDownloadsDir().then(setOutputDir)
    window.api.hasCookiesFile().then(setHasCookies)
  }, [])

  useEffect(() => {
    return window.api.onProgress(({ downloadId: id, progress: p }) => {
      setDownloadId((current) => {
        if (current === id) setProgress(p)
        return current
      })
    })
  }, [])

  const videoOptions = useMemo<SelectOption[]>(
    () =>
      (info?.videoFormats ?? []).map((f) => ({
        value: f.formatId,
        searchText: videoOptionLabel(f),
        label: (
          <span className="format-option">
            <span className="format-option-main">{videoOptionLabel(f)}</span>
            <span className="format-option-meta">
              {codecLabel(f.vcodec)} · {formatSize(f.filesize)}
            </span>
          </span>
        )
      })),
    [info]
  )

  const audioOptions = useMemo<SelectOption[]>(
    () =>
      (info?.audioFormats ?? []).map((f) => ({
        value: f.formatId,
        searchText: f.abr ? `${Math.round(f.abr)}` : f.formatId,
        label: (
          <span className="format-option">
            <span className="format-option-main">
              {f.abr ? `${Math.round(f.abr)} кбит/с` : f.formatId}
            </span>
            <span className="format-option-meta">
              {f.acodec} · {formatSize(f.filesize)}
            </span>
          </span>
        )
      })),
    [info]
  )

  const audioExtOptions: SelectOption[] = [
    { value: 'mp3', label: 'MP3', searchText: 'mp3' },
    { value: 'm4a', label: 'M4A', searchText: 'm4a' },
    { value: 'opus', label: 'Opus', searchText: 'opus' },
    { value: 'wav', label: 'WAV', searchText: 'wav' }
  ]

  const videoContainerOptions: SelectOption[] = [
    { value: 'mp4', label: 'MP4', searchText: 'mp4' },
    { value: 'mkv', label: 'MKV', searchText: 'mkv' },
    { value: 'webm', label: 'WebM', searchText: 'webm' }
  ]

  async function handleFetchInfo(): Promise<void> {
    if (!url.trim() || loadingInfo) return
    setInfoError(null)
    setInfo(null)
    setDownloadDone(false)
    setDownloadError(null)
    setLoadingInfo(true)
    try {
      const result = await window.api.getInfo(url.trim())
      setInfo(result)
      setVideoFormatId(result.videoFormats[0]?.formatId ?? '')
      setAudioFormatId(result.audioFormats[0]?.formatId ?? '')
    } catch (err) {
      setInfoError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingInfo(false)
    }
  }

  async function handleChooseFolder(): Promise<void> {
    const dir = await window.api.selectFolder()
    if (dir) setOutputDir(dir)
  }

  async function handleImportCookies(): Promise<void> {
    const ok = await window.api.importCookiesFile()
    if (ok) setHasCookies(true)
  }

  async function handleDownload(): Promise<void> {
    if (!outputDir || !info) return
    const formatId = mode === 'video' ? videoFormatId : audioFormatId
    if (!formatId) return

    const id = crypto.randomUUID()
    setDownloadId(id)
    setProgress({ percent: 0 })
    setDownloadError(null)
    setDownloadDone(false)

    const result = await window.api.download({
      downloadId: id,
      url: url.trim(),
      mode,
      formatId,
      audioFormat: audioExt,
      videoContainer,
      outputDir,
      title: info.title,
      videoId: info.id
    })

    if (result.ok) {
      setDownloadDone(true)
    } else if (!result.cancelled) {
      setDownloadError(result.error)
    }
    setDownloadId(null)
  }

  async function handleCancel(): Promise<void> {
    if (!downloadId) return
    await window.api.cancelDownload(downloadId)
    setDownloadId(null)
    setProgress(null)
  }

  function handleModeChange(next: Mode): void {
    if (next === mode) return
    setMode(next)
    // A finished/errored download belongs to the format that was just
    // downloaded — switching tabs should go back to a plain "Скачать"
    // button, not carry over the old progress/done state.
    setDownloadDone(false)
    setDownloadError(null)
    setProgress(null)
  }

  const isDownloading = downloadId !== null
  const canDownload =
    !!info &&
    !!outputDir &&
    !isDownloading &&
    (mode === 'video' ? !!videoFormatId : !!audioFormatId)

  const isBotCheck = !!infoError && infoError.includes(BOT_CHECK_MARKER)

  return (
    <div className="app">
      <header className="app-header">
        <h1>YT Downloader</h1>
        <div className="header-actions">
          <button
            type="button"
            className="icon-btn icon-btn-lg"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            {theme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-lg"
            onClick={handleImportCookies}
            title={
              hasCookies
                ? 'Cookies подключены — нажмите, чтобы заменить файл'
                : 'YouTube требует cookies для обхода проверки — нажмите, чтобы загрузить cookies.txt'
            }
          >
            <IconCookie size={20} />
            <span
              className={`status-dot${hasCookies ? ' status-dot-ok' : ' status-dot-warn'}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </header>

      <div className="search-row">
        <div className="url-field">
          <IconLink size={16} className="url-field-icon" />
          <input
            className="url-input"
            placeholder="Вставьте ссылку на видео YouTube"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFetchInfo()}
            spellCheck={false}
          />
        </div>
        <Button onClick={handleFetchInfo} disabled={!url.trim() || loadingInfo}>
          {loadingInfo ? <Spinner size={16} /> : <IconSearch size={16} />}
          {loadingInfo ? 'Ищем…' : 'Найти'}
        </Button>
      </div>

      {infoError &&
        (isBotCheck ? (
          <div className="alert alert-warning">
            <IconCookie size={18} className="alert-icon" />
            <div className="alert-body">
              <p className="alert-title">YouTube проверяет, что вы не бот</p>
              <p className="alert-text">
                Установите расширение «Get cookies.txt LOCALLY», экспортируйте cookies для
                youtube.com и загрузите файл значком печенья в шапке — иначе поиск и загрузка не
                сработают.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleImportCookies}>
              Загрузить
            </Button>
          </div>
        ) : (
          <div className="alert alert-danger">
            <IconAlert size={18} className="alert-icon" />
            <p className="alert-text">{infoError}</p>
          </div>
        ))}

      {!info && !infoError && !loadingInfo && (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">
            <IconFilm size={26} />
          </div>
          <p className="empty-hint">
            Вставьте ссылку и нажмите «Найти», чтобы увидеть превью и доступные качества.
          </p>
        </div>
      )}

      {info && (
        <section className="layout">
          <div className="media-pane">
            <div className="media-thumb-wrap">
              {info.thumbnail ? (
                <img className="media-thumb" src={info.thumbnail} alt="" />
              ) : (
                <div className="media-thumb media-thumb-empty" aria-hidden="true">
                  <IconFilm size={30} />
                </div>
              )}
              {!!info.duration && (
                <span className="media-duration">{formatDuration(info.duration)}</span>
              )}
            </div>
            <div className="media-text">
              <p className="media-title">{info.title}</p>
            </div>
          </div>

          <div className="control-pane">
            <div className="segmented" role="radiogroup" aria-label="Тип загрузки">
              <div
                className="segmented-thumb"
                style={{ transform: mode === 'audio' ? 'translateX(100%)' : 'translateX(0)' }}
              />
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'video'}
                className={`segmented-option${mode === 'video' ? ' is-active' : ''}`}
                onClick={() => handleModeChange('video')}
              >
                <IconFilm size={15} />
                Видео
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'audio'}
                className={`segmented-option${mode === 'audio' ? ' is-active' : ''}`}
                onClick={() => handleModeChange('audio')}
              >
                <IconWave size={15} />
                Аудио
              </button>
            </div>

            <div className="control-body">
              {mode === 'video' ? (
                <div className="field-stack">
                  <div className="field">
                    <Select
                      options={videoOptions}
                      value={videoFormatId}
                      onChange={setVideoFormatId}
                      aria-label="Качество видео"
                    />
                  </div>
                  <div className="field">
                    <Select
                      options={videoContainerOptions}
                      value={videoContainer}
                      onChange={setVideoContainer}
                      aria-label="Формат видеофайла"
                    />
                  </div>
                </div>
              ) : (
                <div className="field-stack">
                  <div className="field">
                    <Select
                      options={audioOptions}
                      value={audioFormatId}
                      onChange={setAudioFormatId}
                      aria-label="Битрейт аудио"
                    />
                  </div>
                  <div className="field">
                    <Select
                      options={audioExtOptions}
                      value={audioExt}
                      onChange={setAudioExt}
                      aria-label="Формат аудиофайла"
                    />
                  </div>
                </div>
              )}

              <div className="folder-row">
                <IconFolder size={15} className="folder-row-icon" />
                <span className="folder-row-path">{outputDir ?? 'определяется…'}</span>
                <Button variant="ghost" size="sm" onClick={handleChooseFolder}>
                  Изменить
                </Button>
              </div>

              <div className="action-row">
                {isDownloading ? (
                  <div className="download-progress">
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.max(2, progress?.percent ?? 0)}%` }}
                      />
                    </div>
                    <div className="progress-info">
                      <span>
                        {(progress?.percent ?? 0) >= 100
                          ? 'Обработка…'
                          : `${(progress?.percent ?? 0).toFixed(0)}%${progress?.currentSpeed ? ` · ${progress.currentSpeed}` : ''}${progress?.eta ? ` · осталось ${progress.eta}` : ''}`}
                      </span>
                      <Button variant="danger" size="sm" onClick={handleCancel}>
                        Отменить
                      </Button>
                    </div>
                  </div>
                ) : downloadDone ? (
                  <div className="download-progress">
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: '100%' }} />
                    </div>
                    <div className="progress-info">
                      <span>Скачано</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDownloadDone(false)
                          setProgress(null)
                        }}
                      >
                        Готово
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button block onClick={handleDownload} disabled={!canDownload}>
                    <IconDownload size={16} />
                    Скачать
                  </Button>
                )}
              </div>

              {downloadError && (
                <div className="alert alert-danger">
                  <IconAlert size={18} className="alert-icon" />
                  <p className="alert-text">{downloadError}</p>
                </div>
              )}
              {downloadDone && outputDir && (
                <Button
                  variant="ghost"
                  size="sm"
                  block
                  onClick={() => window.api.openFolder(outputDir)}
                >
                  <IconFolder size={14} />
                  Открыть папку с файлом
                </Button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
