import { app, shell, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import { DoodleProcess } from './doodle_process'
import * as fs from 'node:fs'
import * as http from 'node:http'
import path from 'node:path'
import settings from 'electron-settings'

const VITE_PUBLIC = join(join(__dirname, '..'), '../resources')
const MAIN_COOKIES: string = 'main_cookies'

let mainWindow: BrowserWindow

const doodleProcessServer = new DoodleProcess()
const doodleExe = new DoodleProcess()
let doodle_cookie = settings.getSync(MAIN_COOKIES)
// const isDevelopment = process.env.NODE_ENV === 'development'

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  switch (process.platform) {
    case 'win32':
      mainWindow.setIcon(join(VITE_PUBLIC, 'icon.ico'))
      break
    default:
      break
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const doodleServerPath = join(app.getPath('exe'), '/../bin/doodle_kitsu_supplement.exe')
  if (fs.existsSync(doodleServerPath)) {
    doodleProcessServer.runExec(doodleServerPath, ['--epiboly'], () => {
      mainWindow.loadURL(`http://127.0.0.1:${doodleProcessServer.port}/`)
    })
  }
  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  else mainWindow.loadURL('http://192.168.40.181/')
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (typeof doodle_cookie === 'string')
      details.requestHeaders['Cookie'] = `access_token_cookie=${doodle_cookie}`
    else delete details.requestHeaders['Cookie']
    // set custom User-Agent in requestHeaders
    details.requestHeaders['User-Agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    delete details.requestHeaders['Referer']
    callback({ cancel: false, requestHeaders: details.requestHeaders })
  })

  mainWindow.webContents.setWindowOpenHandler(() => {
    // mainWindow.webContents.send('open-url', details.url)
    // return { action: 'deny' }
    return {
      action: 'allow',
      // createWindow: (options) => {
      //   const browserView = new WebContentsView(options)
      //   mainWindow.contentView.addChildView(browserView)
      //   browserView.setBounds({ x: 0, y: 0, width: 640, height: 480 })
      //   return browserView.webContents
      // }
      overrideBrowserWindowOptions: {
        frame: true,
        // fullscreen: true,
        fullscreenable: true,
        parent: mainWindow,
        modal: true,
        autoHideMenuBar: true,
        backgroundColor: 'black'
      }
    }
  })
}

const gotTheLock = app.requestSingleInstanceLock({ myKey: 'doodle' })
if (!gotTheLock) {
  app.quit()
} else {
  // In this file you can include the rest of your app"s specific main process
  // code. You can also put them in separate files and require them here.
  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // IPC test
    ipcMain.on('ping', () => console.log('pong'))
    ipcMain.on('showItemInFolder', (_, path) => {
      shell.showItemInFolder(path)
    })
    ipcMain.on('openPath', (_, path) => {
      shell.openPath(path)
    })
    ipcMain.on('DoodleExePort', (event) => {
      event.returnValue = doodleExe.port
    })
    ipcMain.on('doodleExeRun', (_, path, args) => {
      doodleExe.runExec(path, args)
    })
    ipcMain.on('doodleExeClose', () => {
      doodleExe.kill()
    })
    ipcMain.on('setCookies', (_, in_cookies: string) => {
      doodle_cookie = in_cookies
      settings.setSync(MAIN_COOKIES, in_cookies)
    })
    ipcMain.on('downloadAndUnzip', async (_, url: string, outputDir: string) => {
      return new Promise<string>((resolve, reject) => {
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true })
        }
        const filePath = join(outputDir, path.basename(url))
        const file = fs.createWriteStream(filePath)
        http
          .get(url, (res) => {
            if (res.statusCode !== 200) {
              reject(new Error(`请求失败: ${res.statusCode}`))
              return
            }

            const total = parseInt(res.headers['content-length'] || '0', 10)
            let downloaded = 0

            res.on('close', () => {
              doodleExe.unzipFast(
                filePath,
                outputDir,
                (percent) => {
                  mainWindow.webContents.send('download-progress', percent)
                },
                () => {
                  if (fs.existsSync(filePath)) fs.rmSync(filePath)
                  resolve('✅ 解压完成')
                }
              )
            })

            res.on('data', (chunk) => {
              downloaded += chunk.length
              if (total > 0) {
                const percent = doodleExe.mapProgress(downloaded / total, 0, 50).toFixed(2)
                mainWindow.webContents.send('download-progress', percent)
              }
            })

            res.on('error', (err) => {
              reject(err)
            })

            res.pipe(file)
          })
          .on('error', (err) => {
            reject(new Error('解压失败' + err))
          })
      })
    })
    createWindow()

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      doodleProcessServer.kill()
      doodleExe.kill()
      app.quit()
    }
  })
}
