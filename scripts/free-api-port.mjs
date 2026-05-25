/**
 * Free port 8787 on Windows/macOS/Linux so a fresh API (with assistant route) can start.
 */
import { execSync } from 'node:child_process'
import net from 'node:net'

const PORT = Number(process.env.PORT || 8787)

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function portBusy() {
  return new Promise((resolve) => {
    const s = net.createServer()
    s.once('error', () => resolve(true))
    s.once('listening', () => {
      s.close(() => resolve(false))
    })
    s.listen(PORT, '127.0.0.1')
  })
}

function killWindows(pid) {
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
  } catch {
    // ignore
  }
}

function killPosix(pid) {
  try {
    execSync(`kill -9 ${pid}`, { stdio: 'ignore' })
  } catch {
    // ignore
  }
}

function freePort() {
  if (process.platform === 'win32') {
    try {
      const out = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8' })
      const pids = new Set()
      for (const line of out.split('\n')) {
        if (!line.includes('LISTENING')) continue
        const parts = line.trim().split(/\s+/)
        const pid = parts[parts.length - 1]
        if (pid && /^\d+$/.test(pid)) pids.add(pid)
      }
      for (const pid of pids) killWindows(pid)
    } catch {
      // port not in use
    }
    return
  }
  try {
    const out = execSync(`lsof -ti tcp:${PORT}`, { encoding: 'utf8' })
    for (const pid of out.trim().split(/\s+/).filter(Boolean)) killPosix(pid)
  } catch {
    // port not in use
  }
}

const busy = await portBusy()
if (!busy) {
  console.log(`[workSphere] Port ${PORT} is free.`)
  process.exit(0)
}

console.log(`[workSphere] Freeing port ${PORT}…`)
freePort()
await sleep(800)
const stillBusy = await portBusy()
if (stillBusy) {
  console.warn(`[workSphere] Port ${PORT} may still be in use. Close other dev terminals and try again.`)
  process.exit(1)
}
console.log(`[workSphere] Port ${PORT} is ready.`)
