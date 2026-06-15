import {
  findVersionMismatches,
  readVersionSources,
  readReleaseTag,
  releaseArtifactsDirFor,
  releaseTagFor,
  resolveReleaseVersion,
  toRepoRelativePath,
} from './release-config.mjs'

const releaseVersion = resolveReleaseVersion()
const releaseTag = readReleaseTag()
const errors = findVersionMismatches(readVersionSources(), releaseVersion)

if (releaseTag !== undefined && releaseTag !== releaseTagFor(releaseVersion)) {
  errors.push(`tag: ${releaseTag} != ${releaseTagFor(releaseVersion)}`)
}

if (errors.length > 0) {
  console.error('Version check failed:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log(`Version check passed: ${releaseVersion}`)
console.log(
  `Release artifacts: ${toRepoRelativePath(
    releaseArtifactsDirFor(releaseVersion),
  )}`,
)
