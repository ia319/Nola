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
const pyinstallerHooksPath = path.join(
  repositoryRoot,
  'scripts',
  'release',
  'pyinstaller-hooks',
)
const developmentOnlyModules = ['mypy', 'pytest', 'ruff', 'pre_commit']

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
    '--additional-hooks-dir',
    pyinstallerHooksPath,
    '--collect-submodules',
    'nola',
    ...developmentOnlyModules.flatMap((moduleName) => [
      '--exclude-module',
      moduleName,
    ]),
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

assertHfXetPackaged(outputPath)
assertDevelopmentModulesAbsent(outputPath, developmentOnlyModules)

console.log(`Built Windows core sidecar: ${toRepoRelativePath(outputPath)}`)

function assertHfXetPackaged(rootPath) {
  const internalPath = path.join(rootPath, '_internal')
  const nativeModulePath = path.join(internalPath, 'hf_xet', 'hf_xet.pyd')

  if (!fs.existsSync(nativeModulePath)) {
    throw new Error(
      `Missing packaged hf_xet native module: ${toRepoRelativePath(nativeModulePath)}`,
    )
  }

  const metadataEntry = fs
    .readdirSync(internalPath, { withFileTypes: true })
    .find((entry) => {
      const normalizedName = entry.name.toLowerCase().replaceAll('-', '_')
      return (
        entry.isDirectory() &&
        normalizedName.startsWith('hf_xet_') &&
        normalizedName.endsWith('.dist_info')
      )
    })

  if (!metadataEntry) {
    throw new Error('Missing packaged hf-xet distribution metadata.')
  }
}

function assertDevelopmentModulesAbsent(rootPath, moduleNames) {
  const internalPath = path.join(rootPath, '_internal')
  if (!fs.existsSync(internalPath)) {
    return
  }

  const unexpectedEntries = fs
    .readdirSync(internalPath, { withFileTypes: true })
    .map((entry) => entry.name)
    .filter((entryName) =>
      moduleNames.some((moduleName) => isModuleEntry(entryName, moduleName)),
    )

  if (unexpectedEntries.length === 0) {
    return
  }

  throw new Error(
    [
      'Development-only modules were packaged:',
      ...unexpectedEntries.map((entryName) =>
        toRepoRelativePath(path.join(internalPath, entryName)),
      ),
    ].join('\n'),
  )
}

function isModuleEntry(entryName, moduleName) {
  const normalizedEntryName = entryName.toLowerCase().replaceAll('-', '_')
  const normalizedModuleName = moduleName.toLowerCase().replaceAll('-', '_')

  return (
    normalizedEntryName === normalizedModuleName ||
    normalizedEntryName.startsWith(`${normalizedModuleName}.`) ||
    normalizedEntryName.startsWith(`${normalizedModuleName}_`)
  )
}
