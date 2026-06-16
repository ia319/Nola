import fs from 'node:fs'
import path from 'node:path'

import {
  normalizeVersion,
  readCliValue,
  repositoryRoot,
} from './release-config.mjs'

const args = process.argv.slice(2)
const positionalVersion = args[0]?.startsWith('--') ? undefined : args[0]
const rawVersion = readCliValue('--version', args) ?? positionalVersion

if (!rawVersion) {
  console.error('Usage: node scripts/release/set-version.mjs <version>')
  process.exit(1)
}

const releaseVersion = normalizeVersion(rawVersion, 'command line')

function readText(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
}

function writeText(relativePath, content) {
  const normalizedContent = content.endsWith('\n') ? content : `${content}\n`
  fs.writeFileSync(path.join(repositoryRoot, relativePath), normalizedContent, 'utf8')
}

function updateJsonVersion(relativePath) {
  const original = readText(relativePath)
  let found = false
  const updated = original.replace(
    /^(\s*"version")\s*:\s*["'][^"']+["'](,?\s*)$/m,
    (_match, prefix, suffix) => {
      found = true
      return `${prefix}: "${releaseVersion}"${suffix}`
    },
  )

  if (!found) {
    throw new Error(`Missing version in ${relativePath}`)
  }

  JSON.parse(updated)
  writeText(relativePath, updated)
}

function updateTomlSectionVersion(relativePath, sectionName) {
  const original = readText(relativePath)
  const newline = original.includes('\r\n') ? '\r\n' : '\n'
  const lines = original.split(/\r?\n/)
  let activeSection = ''
  let updated = false

  const updatedLines = lines.map((line) => {
    const sectionMatch = line.match(/^\s*\[([^\]]+)]\s*$/)
    if (sectionMatch) {
      activeSection = sectionMatch[1]
      return line
    }

    if (activeSection !== sectionName) {
      return line
    }

    if (!/^\s*version\s*=/.test(line)) {
      return line
    }

    const versionMatch = line.match(/^(\s*version\s*=\s*)["'][^"']+["'](\s*)$/)
    if (!versionMatch) {
      throw new Error(`Invalid ${sectionName}.version in ${relativePath}`)
    }

    updated = true
    return `${versionMatch[1]}"${releaseVersion}"${versionMatch[2]}`
  })

  if (!updated) {
    throw new Error(`Missing ${sectionName}.version in ${relativePath}`)
  }

  writeText(relativePath, updatedLines.join(newline))
}

function updatePythonVersion(relativePath) {
  const original = readText(relativePath)
  let found = false
  const updated = original.replace(
    /^__version__\s*=\s*["'][^"']+["']\s*$/m,
    () => {
      found = true
      return `__version__ = "${releaseVersion}"`
    },
  )

  if (!found) {
    throw new Error(`Missing __version__ in ${relativePath}`)
  }

  writeText(relativePath, updated)
}

updateJsonVersion('app/package.json')
updateJsonVersion('app/src-tauri/tauri.conf.json')
updateTomlSectionVersion('app/src-tauri/Cargo.toml', 'package')
updateTomlSectionVersion('core/pyproject.toml', 'project')
updatePythonVersion('core/nola/__init__.py')

console.log(`Updated release version: ${releaseVersion}`)
