import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import {
  releaseArtifactsDirFor,
  repositoryRoot,
  resolveReleaseVersion,
  toRepoRelativePath,
} from './release-config.mjs'

function assertEmptyDirectory(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return
  }

  if (fs.readdirSync(targetPath).length > 0) {
    throw new Error(
      `Refusing to overwrite non-empty directory: ${toRepoRelativePath(targetPath)}`,
    )
  }
}

if (process.platform !== 'win32') {
  console.error('Windows sidecar packaging must run on Windows.')
  process.exit(1)
}

const releaseVersion = resolveReleaseVersion()
const coreArtifactsDir = path.join(
  releaseArtifactsDirFor(releaseVersion),
  'core',
  'windows-x64',
)
const distPath = path.join(coreArtifactsDir, 'dist')
const workPath = path.join(coreArtifactsDir, 'build')
const specPath = path.join(coreArtifactsDir, 'spec')
const outputPath = path.join(distPath, 'nola-core')
const entryScript = path.join(repositoryRoot, 'core', 'nola', 'launcher.py')

assertEmptyDirectory(outputPath)
assertEmptyDirectory(workPath)
assertEmptyDirectory(specPath)

fs.mkdirSync(distPath, { recursive: true })
fs.mkdirSync(workPath, { recursive: true })
fs.mkdirSync(specPath, { recursive: true })

const poetryCommand = process.platform === 'win32' ? 'poetry.exe' : 'poetry'
const result = spawnSync(
  poetryCommand,
  [
    '-C',
    'core',
    'run',
    'python',
    '-m',
    'PyInstaller',
    '--onedir',
    '--name',
    'nola-core',
    '--distpath',
    distPath,
    '--workpath',
    workPath,
    '--specpath',
    specPath,
    '--paths',
    path.join(repositoryRoot, 'core'),
    '--collect-submodules',
    'nola',
    entryScript,
  ],
  {
    cwd: repositoryRoot,
    stdio: 'inherit',
  },
)

if (result.error) {
  throw result.error
}

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const executablePath = path.join(outputPath, 'nola-core.exe')
if (!fs.existsSync(executablePath)) {
  throw new Error(`Missing PyInstaller output: ${toRepoRelativePath(executablePath)}`)
}

console.log(`Built Windows core sidecar: ${toRepoRelativePath(outputPath)}`)
