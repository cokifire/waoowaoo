import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function runNpm(args, edition) {
  const result = spawnSync(npmCommand, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: edition ? { ...process.env, DEPLOYMENT_EDITION: edition } : process.env,
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (existsSync('ee/package.json')) {
  runNpm(['run', 'edition:deps:check:cloud'])
  runNpm(['run', 'typecheck'], 'cloud')
}

runNpm(['run', 'typecheck'], 'self-hosted')
