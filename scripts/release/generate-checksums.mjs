import crypto from 'node:crypto'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'

import {
  checksumFileNameFor,
  releaseArtifactsDirFor,
  resolveReleaseVersion,
  toRepoRelativePath,
} from './release-config.mjs'

const releaseVersion = resolveReleaseVersion()
const checksumFileName = checksumFileNameFor(releaseVersion)
const releaseArtifactsDir = releaseArtifactsDirFor(releaseVersion)

async function collectFiles(directory) {
  const entries = await fsPromises.readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)))
      continue
    }
    if (entry.isFile() && entry.name !== checksumFileName) {
      files.push(entryPath)
    }
  }

  return files
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

const artifactDirExists = fs.existsSync(releaseArtifactsDir)
if (!artifactDirExists) {
  console.error(
    `Missing release artifact directory: ${toRepoRelativePath(releaseArtifactsDir)}`,
  )
  process.exit(1)
}

const files = (await collectFiles(releaseArtifactsDir)).sort((left, right) =>
  left.localeCompare(right),
)

if (files.length === 0) {
  console.error(`No files found in ${toRepoRelativePath(releaseArtifactsDir)}`)
  process.exit(1)
}

const lines = []
for (const file of files) {
  const hash = await hashFile(file)
  const relativeName = path
    .relative(releaseArtifactsDir, file)
    .replaceAll(path.sep, '/')
  lines.push(`${hash}  ${relativeName}`)
}

const checksumPath = path.join(releaseArtifactsDir, checksumFileName)
await fsPromises.writeFile(checksumPath, `${lines.join('\n')}\n`, 'utf8')

console.log(`Generated checksums: ${toRepoRelativePath(checksumPath)}`)
