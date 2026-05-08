# WhisperStreaming Realtime Module

## Module Scope

Use `whisper_streaming` for the Nola Live realtime local WhisperStreaming / LocalAgreement transcription runtime.

Maintain transcription state for one Live track and convert realtime audio frames into transcript results.

Emit transcript results with these meanings:

- `preview`: expose the current unconfirmed hypothesis for WebSocket realtime preview.
- `committed_partial`: expose LocalAgreement-confirmed stable text for WebSocket realtime feedback.
- `final`: expose a closed transcript segment for `live_segments` persistence.

Keep WebSocket parsing, Live session lifecycle, database writes, device inventory, model downloads, and offline transcription task workers outside this module.

## Upstream Source

- Repository: `https://github.com/ufal/whisper_streaming.git`
- Local reference directory: `WhisperStreaming/`
- Reference commit: `6da90b44b7e50d79695e68166d2a2c7609c75abb`
- Commit time: `2025-11-12 17:45:41 +0100`
- License: MIT
- License file: `WhisperStreaming/LICENSE`

Reference these upstream files:

- `WhisperStreaming/README.md`
- `WhisperStreaming/whisper_online.py`
- `WhisperStreaming/whisper_online_server.py`
- `WhisperStreaming/silero_vad_iterator.py`
- `WhisperStreaming/line_packet.py`

Use WhisperStreaming LocalAgreement behavior as the module reference. Treat SimulStreaming as out of scope for this module.

## Data Flow

Process data per track:

1. Accept a validated 16 kHz mono audio frame.
2. Append the frame to the current track audio buffer.
3. Run the Whisper-like backend on the current accumulated audio buffer.
4. Convert model output into a word-level timestamp list.
5. Map model-relative timestamps to the session-relative timeline with `buffer_time_offset`.
6. Compare previous and current outputs with a hypothesis buffer.
7. Commit the longest common prefix shared by two consecutive updates.
8. Expose the unconfirmed hypothesis as `preview`.
9. Expose newly committed text as `committed_partial`.
10. Close accumulated committed text at an explicit segment boundary and emit `final`.

## Algorithm State

Keep the WhisperStreaming state relationships:

- Use independent processor state for each Live track.
- Use the current track accumulated audio buffer as inference input.
- Use LocalAgreement-2 for stable text confirmation.
- Use `last_committed_time - 0.1` as the timestamp boundary tolerance.
- Compare 1 to 5 word n-grams between the committed tail and the new head for boundary deduplication.
- Build prompt text from committed text that already scrolled out of the current audio buffer.
- Treat context as committed text that still remains inside the current audio buffer and enters inference again.
- Trim buffers at segment boundaries already covered by committed text.
- Treat `finish()` as the remainder flush at an explicit end boundary.

## Nola Boundaries

Audio input:

- Use JSON metadata plus binary PCM16LE payload for Nola Live realtime audio.
- Let `nola.application.live.realtime.audio` validate PCM16LE payload format.
- Reuse existing audio utilities to decode PCM16LE into a float32-compatible waveform.
- Receive runtime-internal waveform data in this module.

Model source:

- Resolve models through existing Nola model management.
- Load registered, downloaded, cache-validated models.
- Keep model downloads outside the Live WebSocket runtime.
- Keep the offline worker loop and `worker_engine` outside this module path.

Output:

- Treat `preview` and `committed_partial` as WebSocket-only runtime feedback.
- Pass only `final` to the Live session runtime for persistence.
- Skip blank final segments.
- Keep Live realtime data out of `transcription_tasks`.

## Upstream Non-Module Parts

Exclude these upstream parts from this module:

- `whisper_online.py` CLI arguments and file simulation loop.
- `whisper_online_server.py` TCP socket server.
- `line_packet.py` TCP line protocol.
- Arbitrary `model_dir` input from upstream CLI.
- Automatic model download behavior from upstream backend paths.
- Silero VAD `torch.hub.load` path.
- OpenAI API, MLX, and `whisper_timestamped` backend paths.

## License Source

Reference WhisperStreaming MIT-licensed algorithm behavior.

Keep upstream repository, commit, and license information in this file for source traceability.
