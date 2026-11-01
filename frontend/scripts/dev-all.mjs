import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoDir = path.resolve(frontendDir, '..')
const apiUrl = (process.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const python = process.platform === 'win32' ? 'python' : 'python3'
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const children = []

function launch(command, args, cwd, label) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', env: process.env, shell: process.platform === 'win32' })
  child.on('error', (error) => console.error(`[${label}] Failed to start: ${error.message}`))
  child.on('exit', (code) => { if (code && code !== 0) console.error(`[${label}] exited with code ${code}`) })
  children.push(child)
}

launch(python, ['-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8000'], path.join(repoDir, 'backend'), 'backend')
launch(pnpm, ['dev', '--host', '127.0.0.1'], frontendDir, 'frontend')

let healthy = false
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const response = await fetch(`${apiUrl}/api/health`, { signal: AbortSignal.timeout(1500) })
    if (response.ok) { healthy = true; break }
  } catch {}
  await delay(1000)
}
if (healthy) console.log(`[startup] Backend ready at ${apiUrl}/api/health`)
else console.error(`[startup] Backend did not become healthy at ${apiUrl}/api/health. Check the backend output above.`)

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  for (const child of children) child.kill(signal)
})
await Promise.all(children.map((child) => new Promise((resolve) => child.once('exit', resolve))))
