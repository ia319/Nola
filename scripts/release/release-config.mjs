import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
)
export const releaseArtifactsRoot = path.join(repositoryRoot, 'release-artifacts')

export const versionSourceDefinitions = [
  {
    path: 'app/package.json',
    reader: readJsonVersion,
  },
  {
    path: 'app/src-tauri/tauri.conf.json',
    reader: readJsonVersion,
  },
  {
    path: 'app/src-tauri/Cargo.toml',
    reader: (relativePath) => readTomlSectionVersion(relativePath, 'package'),
  },
  {
    path: 'core/pyproject.toml',
    reader: (relativePath) => readTomlSectionVersion(relativePath, 'project'),
  },
  {
    path: 'core/nola/__init__.py',
    reader: readPythonVersion,
  },
]

export function readCliValue(name, args = process.argv.slice(2)) {
  const inlinePrefix = `${name}=`
  const inlineValue = args.find((arg) => arg.startsWith(inlinePrefix))
  if (inlineValue) {
    return inlineValue.slice(inlinePrefix.length)
  }

  const index = args.indexOf(name)
  if (index < 0) {
    return undefined
  }

  const value = args[index + 1]
  if (!value || value.startsWith('--')) {
    return undefined
  }

  return value
}

export function readReleaseTag(args = process.argv.slice(2), env = process.env) {
  const cliTag = readCliValue('--tag', args)
  if (cliTag) {
    return cliTag
  }

  if (env.GITHUB_REF_TYPE === 'tag' && env.GITHUB_REF_NAME) {
    return env.GITHUB_REF_NAME
  }

  if (env.GITHUB_REF?.startsWith('refs/tags/')) {
    return env.GITHUB_REF.slice('refs/tags/'.length)
  }

  return undefined
}

export function normalizeVersion(value, sourceName) {
  const normalized = value?.trim().replace(/^v/, '')
  if (
    !normalized ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(normalized)
  ) {
    throw new Error(`Invalid release version from ${sourceName}: ${value}`)
  }
  return normalized
}

export function readText(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
}

export function readJsonVersion(relativePath) {
  return JSON.parse(readText(relativePath)).version
}

export function readTomlSectionVersion(relativePath, sectionName) {
  const lines = readText(relativePath).split(/\r?\n/)
  let activeSection = ''

  for (const line of lines) {
    const sectionMatch = line.match(/^\s*\[([^\]]+)]\s*$/)
    if (sectionMatch) {
      activeSection = sectionMatch[1]
      continue
    }

    if (activeSection !== sectionName) {
      continue
    }

    const versionMatch = line.match(/^\s*version\s*=\s*["']([^"']+)["']\s*$/)
    if (versionMatch) {
      return versionMatch[1]
    }
  }

  throw new Error(`Missing ${sectionName}.version in ${relativePath}`)
}

export function readPythonVersion(relativePath) {
  const versionMatch = readText(relativePath).match(
    /^__version__\s*=\s*["']([^"']+)["']\s*$/m,
  )
  if (!versionMatch) {
    throw new Error(`Missing __version__ in ${relativePath}`)
  }
  return versionMatch[1]
}

export function readVersionSources() {
  return versionSourceDefinitions.map((source) => ({
    path: source.path,
    version: source.reader(source.path),
  }))
}

export function findVersionMismatches(versionSources, expectedVersion) {
  return versionSources
    .filter((source) => source.version !== expectedVersion)
    .map((source) => `${source.path}: ${source.version} != ${expectedVersion}`)
}

export function readConsistentWorkspaceVersion() {
  const versionSources = readVersionSources()
  const uniqueVersions = [...new Set(versionSources.map((source) => source.version))]

  if (uniqueVersions.length !== 1) {
    const versions = versionSources
      .map((source) => `${source.path}: ${source.version}`)
      .join('\n')
    throw new Error(`Version files are inconsistent:\n${versions}`)
  }

  return normalizeVersion(uniqueVersions[0], 'version files')
}

export function resolveReleaseVersion(
  args = process.argv.slice(2),
  env = process.env,
) {
  const tag = readReleaseTag(args, env)
  if (tag) {
    return normalizeVersion(tag, 'tag')
  }

  return readConsistentWorkspaceVersion()
}

export function releaseTagFor(version) {
  return `v${version}`
}

export function releaseArtifactsDirFor(version) {
  return path.join(releaseArtifactsRoot, version)
}

export function checksumFileNameFor(version) {
  return `Nola-${version}-checksums.sha256`
}

export function windowsPortableFileNameFor(version) {
  return `Nola-${version}-windows-x64-portable.zip`
}

export function windowsSetupFileNameFor(version) {
  return `Nola-${version}-windows-x64-setup.exe`
}

export function webFileNameFor(version) {
  return `Nola-${version}-web.zip`
}

export function releasePackageFileNamesFor(version) {
  return [
    windowsSetupFileNameFor(version),
    windowsPortableFileNameFor(version),
    webFileNameFor(version),
  ]
}

export function releaseAssetFileNamesFor(version) {
  return [...releasePackageFileNamesFor(version), checksumFileNameFor(version)]
}

export function toRepoRelativePath(targetPath) {
  return path.relative(repositoryRoot, targetPath).replaceAll(path.sep, '/')
}
