# Nola Documentation

## Release and Deployment

- Release automation: [release/automation.en.md](./release/automation.en.md)
- Windows desktop release: [release/windows-desktop.en.md](./release/windows-desktop.en.md)
- Core Docker deployment: [deploy/core-docker.en.md](./deploy/core-docker.en.md)
- Web static deployment: [deploy/web.en.md](./deploy/web.en.md)

## Delivery Channels

| Channel | Deliverables |
| --- | --- |
| GitHub Releases | Windows x64 NSIS installer, Windows x64 portable zip, Web static zip, and SHA-256 checksums; GitHub provides source zip and tar.gz archives for the version tag |
| GHCR | `linux/amd64` and `linux/arm64` Core Docker images |

Release assets use the following file names:

```text
Nola-<version>-windows-x64-setup.exe
Nola-<version>-windows-x64-portable.zip
Nola-<version>-web.zip
Nola-<version>-checksums.sha256
```

After downloading the release assets, use `Nola-<version>-checksums.sha256` to verify their SHA-256 values.

## Development Reference

- Frontend, desktop shell, and connection configuration: [../app/README.md](../app/README.md)
- Backend API, Worker, and configuration options: [../core/README.md](../core/README.md)
- Frontend AI instructions: [../app/AI_INSTRUCTIONS.md](../app/AI_INSTRUCTIONS.md)
- Backend AI instructions: [../core/AI_INSTRUCTIONS.md](../core/AI_INSTRUCTIONS.md)
