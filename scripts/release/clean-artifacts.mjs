import fs from 'node:fs/promises'
import path from 'node:path'

import {
  releaseArtifactsDirFor,
  releaseArtifactsRoot,
  resolveReleaseVersion,
  repositoryRoot,
  toRepoRelativePath,
} from './release-config.mjs'

const releaseVersion = resolveReleaseVersion()
const releaseArtifactsDir = releaseArtifactsDirFor(releaseVersion)
const resolvedRoot = path.resolve(releaseArtifactsRoot)
const resolvedTarget = path.resolve(releaseArtifactsDir)
const expectedTarget = path.join(resolvedRoot, releaseVersion)

if (resolvedTarget !== expectedTarget) {
  console.error(`Invalid release artifact target: ${resolvedTarget}`)
  process.exit(1)
}

if (!resolvedTarget.startsWith(`${path.resolve(repositoryRoot)}${path.sep}`)) {
  console.error(`Release artifact target is outside repository: ${resolvedTarget}`)
  process.exit(1)
}

await fs.mkdir(resolvedRoot, { recursive: true })
await fs.rm(resolvedTarget, { recursive: true, force: true })
await fs.mkdir(resolvedTarget, { recursive: true })

console.log(`Rebuilt release artifact directory: ${toRepoRelativePath(resolvedTarget)}`)
