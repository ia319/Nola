import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

import {
  releaseArtifactsDirFor,
  repositoryRoot,
  resolveReleaseVersion,
  toRepoRelativePath,
  windowsSetupFileNameFor,
} from './release-config.mjs'

if (process.platform !== 'win32') {
  console.error('Windows setup packaging must run on Windows.')
  process.exit(1)
}

const releaseVersion = resolveReleaseVersion()
const releaseArtifactsDir = releaseArtifactsDirFor(releaseVersion)
const coreSidecarDir = path.join(
  releaseArtifactsDir,
  'core',
  'windows-x64',
  'dist',
  'nola-core',
)
const tauriReleaseConfigDir = path.join(
  repositoryRoot,
  'app',
  'src-tauri',
  'target',
  'nola-release',
)
const tauriReleaseConfigPath = path.join(
  tauriReleaseConfigDir,
  'windows-setup.config.json',
)
const nsisBundleDir = path.join(
  repositoryRoot,
  'app',
  'src-tauri',
  'target',
  'x86_64-pc-windows-msvc',
  'release',
  'bundle',
  'nsis',
)
const targetSetupPath = path.join(
  releaseArtifactsDir,
  windowsSetupFileNameFor(releaseVersion),
)

await assertFile(path.join(coreSidecarDir, 'nola-core.exe'), 'Windows core sidecar')
await assertTargetFileAbsent(targetSetupPath)
await writeTauriReleaseConfig()

const result = spawnSync(
  'pnpm.cmd',
  [
    '--dir',
    'app',
    'tauri',
    'build',
    '--target',
    'x86_64-pc-windows-msvc',
    '--bundles',
    'nsis',
    '--config',
    tauriReleaseConfigPath,
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

const sourceSetupPath = await findNsisSetupInstaller()
await fsp.copyFile(sourceSetupPath, targetSetupPath, fs.constants.COPYFILE_EXCL)

console.log(`Packaged Windows setup installer: ${toRepoRelativePath(targetSetupPath)}`)

async function writeTauriReleaseConfig() {
  const config = {
    bundle: {
      resources: {
        [coreSidecarDir]: 'nola-core',
      },
    },
  }

  await fsp.mkdir(tauriReleaseConfigDir, { recursive: true })
  await fsp.writeFile(
    tauriReleaseConfigPath,
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8',
  )
}

async function findNsisSetupInstaller() {
  let entries
  try {
    entries = await fsp.readdir(nsisBundleDir, { withFileTypes: true })
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
    console.error(`Missing NSIS bundle directory: ${toRepoRelativePath(nsisBundleDir)}`)
    process.exit(1)
  }

  const candidates = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(
      (name) =>
        name.toLowerCase().endsWith('-setup.exe') && name.includes(releaseVersion),
    )

  if (candidates.length !== 1) {
    const found = candidates.length > 0 ? candidates.join(', ') : 'none'
    console.error(`Expected one NSIS setup installer for ${releaseVersion}; found ${found}.`)
    process.exit(1)
  }

  return path.join(nsisBundleDir, candidates[0])
}

async function assertFile(filePath, label) {
  try {
    const stat = await fsp.stat(filePath)
    if (stat.isFile()) {
      return
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
  }

  console.error(`Missing ${label}: ${toRepoRelativePath(filePath)}`)
  process.exit(1)
}

async function assertTargetFileAbsent(filePath) {
  try {
    await fsp.stat(filePath)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return
    }
    throw error
  }

  console.error(`Release artifact already exists: ${toRepoRelativePath(filePath)}`)
  console.error('Run release-clean before rebuilding final release artifacts.')
  process.exit(1)
}
