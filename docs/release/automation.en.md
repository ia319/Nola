# Release Automation

## Workflow Responsibilities

| File | Responsibility |
| --- | --- |
| [ci.yml](../../.github/workflows/ci.yml) | Run App, Core, and desktop quality checks; run the App tests, Core tests, and OpenAPI type drift check after the App and Core quality checks pass; build the Windows desktop bundle after the App tests, Core tests, OpenAPI type drift check, and desktop quality checks all pass |
| [release.yml](../../.github/workflows/release.yml) | Validate the version, build Windows and Web assets, generate checksums, and create or update a draft GitHub Release |
| [docker.yml](../../.github/workflows/docker.yml) | Build the multi-architecture Core image and push it to GHCR after the GitHub Release is published |

The release workflows restrict write permissions to the publishing jobs: the GitHub Release job uses `contents: write`, and the GHCR job uses `packages: write`. Both workflows use the repository-provided `GITHUB_TOKEN`.

## PR Release Dry Run

Add the `release-dry-run` label to PRs that modify `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.github/actions/**`, `scripts/release/**`, Tauri packaging files, or release dependency manifests.

The release dry run proceeds in the following order:

1. Wait for the `Checks and Tests` workflow for the same commit to complete successfully.
2. Validate workspace version consistency.
3. Run the Windows and Web build jobs in parallel; the Windows job generates the installer and portable package in sequence, while the Web job generates the static package.
4. Stage the assets and generate SHA-256 checksums.
5. Validate asset names, counts, and checksum contents.
6. Upload the Actions artifact `release-assets-<version>` with a 14-day retention period.

The PR release dry run ends with the Actions artifact, and publishing permissions remain disabled. After removing the `release-dry-run` label, subsequent PR commits run only the regular checks and tests.

The `stage-release-assets` job generates checksums in an isolated staging directory containing the three final packages. The local Windows staging directory also retains the Core sidecar intermediate artifacts for packaging troubleshooting and artifact acceptance.

## Tag Release Process

The version tag is the source reference for the GitHub Release and GHCR image. Complete the following checks before creating the tag:

The following commands use version `0.2.0` as an example.

1. Write the version number to all version sources:

   ```bash
   make release-set-version VERSION=0.2.0
   make release-check-version
   ```

2. Merge the version changes and confirm that the `Checks and Tests` workflow succeeds on `main`.
3. Follow [Windows Desktop Release](./windows-desktop.en.md) to complete the local Windows build and artifact acceptance.
4. Run `make release-package-web` in the same staging directory, and validate the Web static package according to [Web Static Deployment](../deploy/web.en.md).
5. Create and push the tag from the verified `main` commit:

   ```powershell
   $Version = "0.2.0"
   git tag -a "v$Version" -m "Nola $Version"
   git push origin "v$Version"
   ```

After the `v<version>` tag is pushed, `release.yml` validates that the tag matches the project version, builds the release assets, and creates a draft GitHub Release. The draft contains automatically generated release notes and the following assets:

```text
Nola-<version>-windows-x64-setup.exe
Nola-<version>-windows-x64-portable.zip
Nola-<version>-web.zip
Nola-<version>-checksums.sha256
```

After reviewing the draft assets and completing manual acceptance, publish the draft on the GitHub Releases page. The `published` event for the `release` then triggers `docker.yml`, which pushes the Core image for `linux/amd64` and `linux/arm64`.

## Manual Run Modes

The `Release` workflow provides two `workflow_dispatch` modes:

- `dry-run`: Build and validate the Actions artifact from the selected ref.
- `draft-release`: Build assets from an existing SemVer tag and create or update a draft Release.

The `Publish Docker Images` workflow provides two `workflow_dispatch` modes:

- `dry-run`: Build the multi-architecture image and validate the Dockerfile from the selected ref or specified tag.
- `publish`: Push the GHCR image from an existing SemVer tag.

Both `draft-release` and Docker `publish` modes require an existing `v<version>` tag. The Docker version format is `v<major>.<minor>.<patch>[-prerelease]`.

## Actions Artifacts and Release Assets

- Actions artifacts transfer outputs between jobs and provide downloadable PR dry-run results, with a 14-day retention period.
- GitHub Release assets are persisted by the draft Release and distributed to users of that version.
- GitHub automatically provides source zip and tar.gz archives based on the Release tag.

When rerunning `draft-release` for the same tag, the workflow first confirms that the existing Release is still a draft, then replaces its assets. A published Release causes the workflow to stop, preventing automatic modification of published release content.
