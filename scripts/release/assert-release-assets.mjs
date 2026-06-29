import fs from 'node:fs/promises'
import path from 'node:path'

import {
  checksumFileNameFor,
  readCliValue,
  releaseArtifactsDirFor,
  releaseAssetFileNamesFor,
  releasePackageFileNamesFor,
  resolveReleaseVersion,
  toRepoRelativePath,
} from './release-config.mjs'

const releaseVersion = resolveReleaseVersion()
const releaseArtifactsDir = releaseArtifactsDirFor(releaseVersion)
const checksumFileName = checksumFileNameFor(releaseVersion)
const packageFileNames = releasePackageFileNamesFor(releaseVersion)
const allowedFileNames = releaseAssetFileNamesFor(releaseVersion)
const requireChecksums =
  process.argv.includes('--require-checksums') ||
  process.env.RELEASE_REQUIRE_CHECKSUMS === '1' ||
  readCliValue('--require-checksums') === '1'

const entries = await readReleaseDirectoryEntries()
const fileEntries = entries.filter((entry) => entry.isFile())
const directoryEntries = entries.filter((entry) => entry.isDirectory())
const actualFileNames = fileEntries.map((entry) => entry.name).sort()
const errors = []

for (const directory of directoryEntries) {
  errors.push(`Unexpected directory: ${directory.name}`)
}

for (const fileName of actualFileNames) {
  if (!allowedFileNames.includes(fileName)) {
    errors.push(`Unexpected release asset: ${fileName}`)
  }
}

for (const fileName of packageFileNames) {
  if (!actualFileNames.includes(fileName)) {
    errors.push(`Missing release asset: ${fileName}`)
  }
}

const hasChecksumFile = actualFileNames.includes(checksumFileName)
if (requireChecksums && !hasChecksumFile) {
  errors.push(`Missing release checksum file: ${checksumFileName}`)
}

if (hasChecksumFile) {
  errors.push(...(await validateChecksumFile()))
}

if (errors.length > 0) {
  console.error('Release asset check failed:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log(
  `Release asset check passed: ${toRepoRelativePath(releaseArtifactsDir)}`,
)

async function readReleaseDirectoryEntries() {
  try {
    return await fs.readdir(releaseArtifactsDir, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      console.error(
        `Missing release artifact directory: ${toRepoRelativePath(releaseArtifactsDir)}`,
      )
      process.exit(1)
    }
    throw error
  }
}

async function validateChecksumFile() {
  const checksumPath = path.join(releaseArtifactsDir, checksumFileName)
  const content = await fs.readFile(checksumPath, 'utf8')
  const lines = content.split(/\r?\n/).filter((line) => line.length > 0)
  const checksumEntries = new Map()
  const checksumErrors = []

  for (const line of lines) {
    const match = line.match(/^([0-9a-f]{64})  ([^\r\n]+)$/)
    if (!match) {
      checksumErrors.push(`Invalid checksum line: ${line}`)
      continue
    }

    const fileName = match[2]
    if (checksumEntries.has(fileName)) {
      checksumErrors.push(`Duplicate checksum entry: ${fileName}`)
      continue
    }

    checksumEntries.set(fileName, match[1])
  }

  for (const fileName of packageFileNames) {
    if (!checksumEntries.has(fileName)) {
      checksumErrors.push(`Missing checksum entry: ${fileName}`)
    }
  }

  for (const fileName of checksumEntries.keys()) {
    if (!packageFileNames.includes(fileName)) {
      checksumErrors.push(`Unexpected checksum entry: ${fileName}`)
    }
  }

  return checksumErrors
}
