import { execSync } from 'node:child_process'

try {
  execSync('npm rebuild better-sqlite3', { stdio: 'inherit' })
} catch {
  console.warn(
    '[workSphere] better-sqlite3 rebuild skipped — API will use node:sqlite on this platform.',
  )
}
