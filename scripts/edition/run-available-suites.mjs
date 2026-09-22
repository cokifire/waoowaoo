import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const [coreScript, eeScript] = process.argv.slice(2)
if (!coreScript || !eeScript) {
  throw new Error('run-available-suites requires Core and EE npm script names')
}

function run(script) {
  const result = spawnSync(npmCommand, ['run', script], {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run(coreScript)
if (existsSync('ee/package.json')) run(eeScript)
