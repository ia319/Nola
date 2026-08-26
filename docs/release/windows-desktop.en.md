# Windows Desktop Release

## Release Artifacts

The desktop release target is Windows x64:

| Artifact | Path |
| --- | --- |
| Core one-dir sidecar | `release-artifacts/<version>/core/windows-x64/dist/nola-core/nola-core.exe` |
| NSIS installer | `release-artifacts/<version>/Nola-<version>-windows-x64-setup.exe` |
| Portable archive | `release-artifacts/<version>/Nola-<version>-windows-x64-portable.zip` |

The NSIS installer includes the Core sidecar in the `nola-core/` resource directory of the Tauri bundle. The portable archive includes the same sidecar files in the `nola-core/` directory next to `Nola.exe`.

The Windows installer and portable archive are released unsigned. Windows SmartScreen may display a security warning.

Portable archive structure:

```text
Nola-<version>-windows-x64-portable/
├── Nola.exe
├── README.txt
└── nola-core/
    ├── nola-core.exe
    └── _internal/
        └── ...
```

After the first launch, the portable archive creates `data/` in the extracted directory.

## Build Requirements

- Windows 10/11
- Python 3.10–3.14
- Poetry 2.x
- GNU Make
- Visual Studio C++ MSVC toolchain
- Rust stable
- `x86_64-pc-windows-msvc` target
- Node.js 20.19+, 22.13+, or 24+
- pnpm 10+
- WebView2 Runtime for local execution and verification
- Tauri NSIS cache directory: `%LOCALAPPDATA%\tauri\NSIS`

Before the first build, install the frontend, Core, and PyInstaller build dependencies:

```bash
make install
make release-install-core-build
```

## Build Workflow

Build a complete set of Windows release artifacts:

```bash
make release-check-version
make release-clean
make release-build-core-windows
make release-package-windows-setup
make release-package-windows-portable
```

`release-clean` rebuilds `release-artifacts/<version>/`. Run it once when starting each release artifact set. The packaging scripts stop when a target file with the same name already exists.

`release-package-windows-setup` builds the Tauri application and injects the Core sidecar. The portable packaging script that runs afterward reuses the same `nola_desktop.exe`.

When building the portable archive separately, build the Tauri executable first:

```bash
make release-check-version
make release-clean
make release-build-core-windows
make desktop-build-windows
make release-package-windows-portable
```

## NSIS Tools

- The Tauri bundler downloads tools to `%LOCALAPPDATA%\tauri\NSIS` during the first NSIS build.
- GitHub Actions caches the Windows tools downloaded by Tauri.
- Offline builds use a prewarmed Tauri tool cache.
- NSIS binaries remain in the Tauri user cache, outside the source tree and release attachments.

## Connection Behavior

The desktop client selects Core in this order:

1. The desktop process argument `--backend-url`.
2. A user-saved remote backend or external local backend configuration.
3. The bundled Core sidecar.
4. The default external local backend at `http://127.0.0.1:8000`.

For development and debugging, specify `nola-core.exe` with the desktop process argument `--core-sidecar <path>` or the `NOLA_DESKTOP_CORE_SIDECAR_PATH` environment variable.

See [app/README.md](../../app/README.md) for remote backend configuration.

## Core Sidecar Behavior

`nola-core` provides two runtime entry points:

```bash
nola-core api --host 127.0.0.1 --port 8000
nola-core worker
```

Desktop-managed mode:

- The API and Worker use the same `--data-dir`.
- The API and Worker use the same `--model-dir`.
- The desktop process assigns a dynamic loopback port to the API and polls `/health`.
- The Core version returned by `/health` must match the desktop version.
- If API startup fails, the desktop process stops the started Core child process.
- If Worker startup fails, the API remains available and the runtime status reports `workerStatus: "failed"`.
- On desktop exit, the desktop process stops the Worker and then the API.

## Environment Variable Rules

Standalone backend execution:

- `nola-core api` and `nola-core worker` honor `NOLA_*` environment variables by default.
- Passing `--ignore-system-env` ignores the controlled `NOLA_*` environment variables.

Desktop-managed execution:

- The desktop process passes `--ignore-system-env` when starting the Core sidecar.
- The desktop process explicitly passes `--data-dir`, `--model-dir`, `--host`, `--port`, and `--cors-origins`.
- The desktop process removes `NOLA_COMPUTE_TYPE`, `NOLA_CORS_ORIGINS`, `NOLA_DATA_DIR`, `NOLA_DEVICE`, `NOLA_HOST`, `NOLA_LIVE_REALTIME_TRANSCRIBER`, `NOLA_MAX_FILE_SIZE`, `NOLA_MODEL_DIR`, `NOLA_MODEL_SIZE`, and `NOLA_PORT` from the child process environment.
- Desktop-managed directory and network parameters come from desktop process arguments. Model and transcription application parameters come from persisted in-app configuration and Core source defaults.

## Data and Log Directories

Desktop-managed directories are resolved from the Core sidecar location. Both the NSIS installer and portable archive place the bundled Core sidecar in the `nola-core/` directory next to `Nola.exe`.

- Core sidecar directory: `nola-core/` next to `Nola.exe`.
- When the bundled Core sidecar is in that directory, Nola first uses `data/` next to `Nola.exe`.
- When `data/`, `data/models/`, or `data/logs/` cannot be created or written, Nola falls back to `core/` under the Tauri app data directory.
- When `--core-sidecar` or `NOLA_DESKTOP_CORE_SIDECAR_PATH` selects a sidecar in another location, Nola uses `core/` under the Tauri app data directory.

After selecting the data directory:

- Model directory: `models/` under the data directory.
- Log directory: `logs/` under the data directory.
- API logs: `api.stdout.log` and `api.stderr.log`.
- Worker logs: `worker.stdout.log` and `worker.stderr.log`.

The desktop connection configuration, `connection-config.json`, is always stored in the Tauri app config directory and managed separately from the Core data directory.

## Local Verification

Run the following verification with a Windows test account that has no saved Nola connection settings. If the test account has saved settings, reset them in `Settings > Connection` first so a remote or external local backend does not take precedence over the bundled Core sidecar.

1. Run `nola-core.exe --help`, `nola-core.exe api --help`, and `nola-core.exe worker --help`, and confirm that all three CLI entry points work.
2. Extract `release-artifacts/<version>/Nola-<version>-windows-x64-portable.zip` outside the source tree.
3. Run `Nola.exe`, then use the following command to confirm that the API and Worker start from the adjacent `nola-core/nola-core.exe`:

   ```powershell
   Get-CimInstance Win32_Process -Filter "Name = 'nola-core.exe'" |
     Select-Object ProcessId, ExecutablePath, CommandLine
   ```

4. Confirm that data, models, and logs are written by default to `data/`, `data/models/`, and `data/logs/` under the extracted directory.
5. Download a model and wait for completion, then transcribe a file and export subtitles.
6. Verify microphone and system audio device enumeration, and complete one live transcription.
7. Restart Nola and confirm that the model, connection configuration, and history remain available.
8. When the portable directory is not writable, confirm that the data directory falls back to `core/` under the Tauri app data directory.
9. Exit Nola and confirm that both the API and Worker processes have stopped.
10. Move the entire writable extracted directory, start Nola again, and confirm that the Core data and model cache move with the directory.

Verify NSIS installation, startup, upgrade, and uninstallation in a disposable Windows virtual machine or a revertible snapshot.

When runtime errors occur, inspect `data/logs/api.stderr.log` and `data/logs/worker.stderr.log`. After a data directory fallback, use `logDir` from the runtime status to locate the logs.
