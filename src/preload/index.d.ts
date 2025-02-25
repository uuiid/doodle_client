import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openPath: (path: string) => void
      showItemInFolder: (path: string) => void
    }
  }
}
