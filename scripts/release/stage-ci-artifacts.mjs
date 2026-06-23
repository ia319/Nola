import fs from 'node:fs/promises'
import path from 'node:path'

import {
  readCliValue,
  releaseArtifactsDirFor,
  releaseArtifactsRoot,
  releasePackageFileNamesFor,
  repositoryRoot,
  resolveReleaseVersion,
  toRepoRelativePath,
} from './release-config.mjs'

const releaseVersion = resolveReleaseVersion()
const releaseArtifactsDir = releaseArtifactsDirFor(releaseVersion)
const inputDir = resolveInputDir()
const expectedFileNames = releasePackageFileNamesFor(releaseVersion)

await assertInputDirectory(inputDir)
await fs.mkdir(releaseArtifactsDir, { recursive: true })

const discoveredFiles = await collectFiles(inputDir)
const filesByName = groupFilesByBaseName(discoveredFiles)
const copyOperations = []
const errors = []

for (const fileName of expectedFileNames) {
  const matches = filesByName.get(fileName) ?? []
  if (matches.length === 0) {
    errors.push(`Missing CI artifact: ${fileName}`)
    continue
  }
  if (matches.length > 1) {
    errors.push(
      [`Duplicate CI artifact: ${fileName}`, ...matches.map(toRepoRelativePath)].join('\n'),
    )
    continue
  }

  const targetPath = path.join(releaseArtifactsDir, fileName)
  if (await pathExists(targetPath)) {
    errors.push(`Release artifact already exists: ${toRepoRelativePath(targetPath)}`)
    continue
  }

  copyOperations.push({
    sourcePath: matches[0],
    targetPath,
  })
}

const unexpectedFiles = discoveredFiles.filter(
  (filePath) => !expectedFileNames.includes(path.basename(filePath)),
)
if (unexpectedFiles.length > 0) {
  errors.push(
    [
      'Unexpected CI artifact files:',
      ...unexpectedFiles.map((filePath) => `- ${toRepoRelativePath(filePath)}`),
    ].join('\n'),
  )
}

if (errors.length > 0) {
  console.error('CI artifact staging failed:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

for (const operation of copyOperations) {
  await fs.copyFile(operation.sourcePath, operation.targetPath)
  console.log(`Staged release artifact: ${toRepoRelativePath(operation.targetPath)}`)
}

function resolveInputDir() {
  const value =
    readCliValue('--input') ??
    process.env.RELEASE_CI_ARTIFACTS_DIR ??
    path.join('release-artifacts', '_ci-artifacts')
  return path.resolve(repositoryRoot, value)
}

async function assertInputDirectory(directoryPath) {
  const resolvedRepositoryRoot = path.resolve(repositoryRoot)
  const resolvedReleaseArtifactsDir = path.resolve(releaseArtifactsDir)
  const resolvedReleaseArtifactsRoot = path.resolve(releaseArtifactsRoot)

  if (directoryPath === resolvedRepositoryRoot) {
    console.error('Refusing to scan repository root for CI artifacts.')
    process.exit(1)
  }

  if (directoryPath === resolvedReleaseArtifactsDir) {
    console.error('Refusing to use the release output directory as CI artifact input.')
    process.exit(1)
  }

  if (
    directoryPath.startsWith(`${resolvedReleaseArtifactsDir}${path.sep}`) &&
    directoryPath !== path.join(resolvedReleaseArtifactsRoot, '_ci-artifacts')
  ) {
    console.error('Refusing to scan a final release output subdirectory.')
    process.exit(1)
  }

  try {
    const stat = await fs.stat(directoryPath)
    if (stat.isDirectory()) {
      return
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
  }

  console.error(`Missing CI artifact input directory: ${toRepoRelativePath(directoryPath)}`)
  process.exit(1)
}

async function collectFiles(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)))
      continue
    }
    if (entry.isFile()) {
      files.push(entryPath)
    }
  }

  return files.sort((left, right) => left.localeCompare(right))
}

function groupFilesByBaseName(filePaths) {
  const grouped = new Map()
  for (const filePath of filePaths) {
    const fileName = path.basename(filePath)
    const existing = grouped.get(fileName) ?? []
    existing.push(filePath)
    grouped.set(fileName, existing)
  }
  return grouped
}

async function pathExists(filePath) {
  try {
    await fs.stat(filePath)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false
    }
    throw error
  }
}
