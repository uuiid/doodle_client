import { execFile, ChildProcess } from 'node:child_process'

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
}

// export default DoodleProcess

