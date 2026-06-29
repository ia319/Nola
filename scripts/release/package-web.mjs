import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'

import {
  releaseArtifactsDirFor,
  repositoryRoot,
  resolveReleaseVersion,
  toRepoRelativePath,
  webFileNameFor,
} from './release-config.mjs'

const crc32Table = createCrc32Table()
const releaseVersion = resolveReleaseVersion()
const releaseArtifactsDir = releaseArtifactsDirFor(releaseVersion)
const appDistDir = path.join(repositoryRoot, 'app', 'dist')
const targetZipPath = path.join(releaseArtifactsDir, webFileNameFor(releaseVersion))

await assertDirectory(appDistDir, 'Web build directory')
await assertFile(path.join(appDistDir, 'index.html'), 'Web entry file')
await assertTargetFileAbsent(targetZipPath)
await fs.mkdir(releaseArtifactsDir, { recursive: true })

await writeZipFromDirectory(appDistDir, targetZipPath)

console.log(`Packaged Web static archive: ${toRepoRelativePath(targetZipPath)}`)

async function assertDirectory(directoryPath, label) {
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

  console.error(`Missing ${label}: ${toRepoRelativePath(directoryPath)}`)
  console.error('Run app-build before packaging the Web archive.')
  process.exit(1)
}

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

async function assertTargetFileAbsent(filePath) {
  try {
    await fs.stat(filePath)
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

async function writeZipFromDirectory(sourceDir, targetPath) {
  const files = await collectFiles(sourceDir)
  if (files.length === 0) {
    console.error(`No files found in ${toRepoRelativePath(sourceDir)}`)
    process.exit(1)
  }

  const outputParts = []
  const centralDirectoryParts = []
  let offset = 0

  for (const file of files) {
    const relativeName = path.relative(sourceDir, file).replaceAll(path.sep, '/')
    const fileNameBuffer = Buffer.from(relativeName, 'utf8')
    const data = await fs.readFile(file)
    const compressedData = zlib.deflateRawSync(data, { level: zlib.constants.Z_BEST_COMPRESSION })
    const checksum = crc32(data)
    const { dosDate, dosTime } = toDosDateTime((await fs.stat(file)).mtime)
    const localHeader = createLocalFileHeader({
      fileNameBuffer,
      checksum,
      compressedSize: compressedData.length,
      uncompressedSize: data.length,
      dosDate,
      dosTime,
    })
    const centralDirectoryHeader = createCentralDirectoryHeader({
      fileNameBuffer,
      checksum,
      compressedSize: compressedData.length,
      uncompressedSize: data.length,
      dosDate,
      dosTime,
      localHeaderOffset: offset,
    })

    outputParts.push(localHeader, compressedData)
    centralDirectoryParts.push(centralDirectoryHeader)
    offset += localHeader.length + compressedData.length
  }

  const centralDirectoryOffset = offset
  const centralDirectory = Buffer.concat(centralDirectoryParts)
  const endOfCentralDirectory = createEndOfCentralDirectory({
    entryCount: files.length,
    centralDirectorySize: centralDirectory.length,
    centralDirectoryOffset,
  })

  await fs.writeFile(
    targetPath,
    Buffer.concat([...outputParts, centralDirectory, endOfCentralDirectory]),
  )
}

async function collectFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
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

function createLocalFileHeader({
  fileNameBuffer,
  checksum,
  compressedSize,
  uncompressedSize,
  dosDate,
  dosTime,
}) {
  const header = Buffer.alloc(30 + fileNameBuffer.length)
  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(0x0800, 6)
  header.writeUInt16LE(8, 8)
  header.writeUInt16LE(dosTime, 10)
  header.writeUInt16LE(dosDate, 12)
  header.writeUInt32LE(checksum, 14)
  header.writeUInt32LE(compressedSize, 18)
  header.writeUInt32LE(uncompressedSize, 22)
  header.writeUInt16LE(fileNameBuffer.length, 26)
  header.writeUInt16LE(0, 28)
  fileNameBuffer.copy(header, 30)
  return header
}

function createCentralDirectoryHeader({
  fileNameBuffer,
  checksum,
  compressedSize,
  uncompressedSize,
  dosDate,
  dosTime,
  localHeaderOffset,
}) {
  const header = Buffer.alloc(46 + fileNameBuffer.length)
  header.writeUInt32LE(0x02014b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(20, 6)
  header.writeUInt16LE(0x0800, 8)
  header.writeUInt16LE(8, 10)
  header.writeUInt16LE(dosTime, 12)
  header.writeUInt16LE(dosDate, 14)
  header.writeUInt32LE(checksum, 16)
  header.writeUInt32LE(compressedSize, 20)
  header.writeUInt32LE(uncompressedSize, 24)
  header.writeUInt16LE(fileNameBuffer.length, 28)
  header.writeUInt16LE(0, 30)
  header.writeUInt16LE(0, 32)
  header.writeUInt16LE(0, 34)
  header.writeUInt16LE(0, 36)
  header.writeUInt32LE(0, 38)
  header.writeUInt32LE(localHeaderOffset, 42)
  fileNameBuffer.copy(header, 46)
  return header
}

function createEndOfCentralDirectory({
  entryCount,
  centralDirectorySize,
  centralDirectoryOffset,
}) {
  const header = Buffer.alloc(22)
  header.writeUInt32LE(0x06054b50, 0)
  header.writeUInt16LE(0, 4)
  header.writeUInt16LE(0, 6)
  header.writeUInt16LE(entryCount, 8)
  header.writeUInt16LE(entryCount, 10)
  header.writeUInt32LE(centralDirectorySize, 12)
  header.writeUInt32LE(centralDirectoryOffset, 16)
  header.writeUInt16LE(0, 20)
  return header
}

function toDosDateTime(date) {
  const year = Math.max(date.getFullYear(), 1980)
  const dosTime =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { dosDate, dosTime }
}

function createCrc32Table() {
  const table = new Uint32Array(256)
  for (let index = 0; index < table.length; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }

  return table
}

function crc32(buffer) {
  let value = 0xffffffff
  for (const byte of buffer) {
    value = crc32Table[(value ^ byte) & 0xff] ^ (value >>> 8)
  }
  return (value ^ 0xffffffff) >>> 0
}
