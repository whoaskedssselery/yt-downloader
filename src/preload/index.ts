import { contextBridge, ipcRenderer } from 'electron'

export interface VideoFormat {
  formatId: string
  ext: string
  height: number | null
  fps: number | null
  vcodec: string
  hasAudio: boolean
  filesize: number | null
}

export interface AudioFormat {
  formatId: string
  ext: string
  abr: number | null
  acodec: string
  filesize: number | null
}

export interface VideoInfo {
  id: string
  title: string
  uploader?: string
  thumbnail?: string
  duration?: number
  videoFormats: VideoFormat[]
  audioFormats: AudioFormat[]
}

export interface DownloadProgress {
  percent?: number
  totalSize?: string
  currentSpeed?: string
  eta?: string
}

export interface DownloadPayload {
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

const api = {
  getDownloadsDir: (): Promise<string> => ipcRenderer.invoke('app:downloadsDir'),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectFolder'),
  hasCookiesFile: (): Promise<boolean> => ipcRenderer.invoke('app:hasCookiesFile'),
  importCookiesFile: (): Promise<boolean> => ipcRenderer.invoke('app:importCookiesFile'),
  getInfo: (url: string): Promise<VideoInfo> => ipcRenderer.invoke('yt:info', url),
  download: (
    payload: DownloadPayload
  ): Promise<{ ok: true } | { ok: false; error: string; cancelled?: boolean }> =>
    ipcRenderer.invoke('yt:download', payload),
  cancelDownload: (downloadId: string): Promise<boolean> =>
    ipcRenderer.invoke('yt:cancel', downloadId),
  openFolder: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('shell:openFolder', folderPath),
  onProgress: (
    listener: (data: { downloadId: string; progress: DownloadProgress }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { downloadId: string; progress: DownloadProgress }
    ): void => listener(data)
    ipcRenderer.on('yt:progress', handler)
    return () => ipcRenderer.removeListener('yt:progress', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
