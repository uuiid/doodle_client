import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  openPath(path: string) {
    electronAPI.ipcRenderer.send('openPath', path)
  },
  showItemInFolder(path: string) {
    electronAPI.ipcRenderer.send('showItemInFolder', path)
  },
  DoodleExePort() {
    return electronAPI.ipcRenderer.sendSync('DoodleExePort')
  },
  doodleExeRun(path: string, args: string[]) {
    electronAPI.ipcRenderer.send('doodleExeRun', path, args)
  },
  doodleExeClose() {
    electronAPI.ipcRenderer.send('doodleExeClose')
  },
  downloadAndUnzip(url: string, path: string) {
    electronAPI.ipcRenderer.send('downloadAndUnzip', url, path)
  },
  setCookies(in_cookise: string) {
    electronAPI.ipcRenderer.send('setCookies', in_cookise)
  },
  onProgress(callback: (percent: number) => void) {
    electronAPI.ipcRenderer.on('download-progress', (_, percent) => callback(percent))
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
