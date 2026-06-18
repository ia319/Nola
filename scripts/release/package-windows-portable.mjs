import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

import {
  releaseArtifactsDirFor,
  repositoryRoot,
  resolveReleaseVersion,
  toRepoRelativePath,
  windowsPortableFileNameFor,
} from './release-config.mjs'

if (process.platform !== 'win32') {
  console.error('Windows portable packaging must run on Windows.')
  process.exit(1)
}

const releaseVersion = resolveReleaseVersion()
const releaseArtifactsDir = releaseArtifactsDirFor(releaseVersion)
const desktopExePath = path.join(
  repositoryRoot,
  'app',
  'src-tauri',
  'target',
  'x86_64-pc-windows-msvc',
  'release',
  'nola_desktop.exe',
)
const coreSidecarDir = path.join(
  releaseArtifactsDir,
  'core',
  'windows-x64',
  'dist',
  'nola-core',
)
const stagingRoot = path.join(releaseArtifactsDir, '.portable-staging')
const portableRoot = path.join(stagingRoot, `Nola-${releaseVersion}-windows-x64-portable`)
const targetZipPath = path.join(
  releaseArtifactsDir,
  windowsPortableFileNameFor(releaseVersion),
)

await assertFile(desktopExePath, 'Windows desktop executable')
await assertFile(path.join(coreSidecarDir, 'nola-core.exe'), 'Windows core sidecar')

await fs.rm(stagingRoot, { recursive: true, force: true })
await fs.mkdir(portableRoot, { recursive: true })
await fs.copyFile(desktopExePath, path.join(portableRoot, 'Nola.exe'))
await fs.cp(coreSidecarDir, path.join(portableRoot, 'nola-core'), {
  recursive: true,
})
await fs.writeFile(
  path.join(portableRoot, 'README.txt'),
  [
    `Nola ${releaseVersion} Windows portable package`,
    '',
    'Run Nola.exe to start the desktop app.',
    'The bundled core sidecar is located in the nola-core directory.',
    'This package is unsigned.',
    '',
  ].join('\r\n'),
  'utf8',
)

await fs.rm(targetZipPath, { force: true })
const result = spawnSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-Command',
    `Compress-Archive -LiteralPath ${toPowerShellLiteral(
      portableRoot,
    )} -DestinationPath ${toPowerShellLiteral(targetZipPath)} -Force`,
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

await fs.rm(stagingRoot, { recursive: true, force: true })
await fs.rm(path.join(releaseArtifactsDir, 'core'), { recursive: true, force: true })

console.log(`Packaged Windows portable archive: ${toRepoRelativePath(targetZipPath)}`)

async function assertFile(filePath, label) {
  try {
    const stat = await fs.stat(filePath)
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

function toPowerShellLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`
}
