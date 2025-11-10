import { execFile, ChildProcess } from 'node:child_process'
import * as yauzl from 'yauzl'
import * as iconv from 'iconv-lite'
import * as path from 'node:path'
import * as mkdirp from 'mkdirp'
import * as fs from 'node:fs'

export class DoodleProcess {
  DoodleChildProcess: ChildProcess | null
  port: number

  constructor() {
    this.DoodleChildProcess = null
    this.port = 0
  }

  runExec(path: string, args: string[], callback?: () => void) {
    if (this.DoodleChildProcess != null) return

    this.DoodleChildProcess = execFile(path, args, { windowsHide: true }, (err) => {
      if (err) console.log(err)
      this.DoodleChildProcess = null
      this.port = 0
    })
    const childProcess = this.DoodleChildProcess
    if (childProcess && childProcess.stdout) {
      childProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`)
        if (this.port != parseInt(data.toString())) {
          this.port = parseInt(data.toString())
          if (callback) {
            callback()
          }
        }
      })
    }
  }

  kill() {
    if (this.DoodleChildProcess != null) {
      this.DoodleChildProcess.kill()
      this.DoodleChildProcess = null
    }
  }

  getPid(): number | undefined {
    if (this.DoodleChildProcess != null) {
      return this.DoodleChildProcess.pid
    }
    return 0
  }
  mapProgress(value: number, min: number, max: number): number {
    return min + (max - min) * value
  }

  unzipFast(
    zipPath: string,
    outputDir: string,
    onProgress?: (percent: number) => void,
    onEnd?: () => void
  ) {
    yauzl.open(zipPath, { lazyEntries: true, decodeStrings: false }, (err, zipfile) => {
      if (err) throw err
      const totalFiles = zipfile.entryCount
      let doneFiles = 0
      zipfile.readEntry()
      zipfile.on('entry', (entry) => {
        const fileName = iconv.decode(entry.fileName, 'utf-8')
        const fullPath = path.join(outputDir, fileName)

        if (/\/$/.test(fileName)) {
          mkdirp.sync(fullPath)
          doneFiles++
          const percent = this.mapProgress(doneFiles / totalFiles, 50, 100).toFixed(2)
          onProgress?.(Number(percent))
          zipfile.readEntry()
        } else {
          mkdirp.sync(path.dirname(fullPath))
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) throw err
            const writeStream = fs.createWriteStream(fullPath)
            readStream.pipe(writeStream)
            writeStream.on('finish', () => {
              doneFiles++
              if (onProgress) {
                const percent = this.mapProgress(doneFiles / totalFiles, 50, 100).toFixed(2)
                onProgress(Number(percent))
              }
              zipfile.readEntry()
            })
          })
        }
      })

      zipfile.on('end', () => {
        onEnd?.()
      })
      zipfile.on('error', (err) => console.error('解压出错:', err))
    })
  }
}

// export default DoodleProcess

