# Live Transcription Phase 4 Follow-Up Issues

This document records deferred review issues for the Live WhisperStreaming runtime.
Do not treat these notes as implementation steps. Use them to guide later fixes and
validation.

## Unprocessed Tail Audio On Finish

- Status: deferred
- Code location: `core/nola/application/live/realtime/whisper_streaming/processor.py`, `WhisperStreamingOnlineProcessor.finish()`
- Related upstream location: `WhisperStreaming/whisper_online.py`, `OnlineASRProcessor.finish()`
- Problem: `finish()` currently flushes the existing hypothesis without running one final inference pass. Audio accumulated after the last `_process_iter()` call can be shorter than `min_chunk_ms` and never reach the backend.
- Impact: `track.stop` or `session.finish` can drop the last short tail of speech.
- Later validation: add a processor test where the final audio chunk is shorter than `min_chunk_ms`, call `finish()`, and verify the backend sees that tail before final output.
- Notes: Keep the current behavior until real-model validation confirms the correct Nola adaptation. This is an upstream-style behavior that depends on the caller loop.

## Duplicate Boundary Uses Smallest Match

- Status: deferred
- Code location: `core/nola/application/live/realtime/whisper_streaming/hypothesis.py`, `LocalAgreementHypothesisBuffer._drop_duplicate_head()`
- Related upstream location: `WhisperStreaming/whisper_online.py`, `HypothesisBuffer.insert()`
- Problem: duplicate removal scans from 1-gram upward and stops at the first match. Repeated words can match a shorter overlap first and leave a duplicate at the hypothesis boundary.
- Impact: repeated words such as `world world` can leave one extra `world` in preview or committed output.
- Later validation: add a hypothesis test with committed tail `world world` and new head `world world again`; verify the later implementation removes both repeated words and leaves only `again`.
- Notes: Treat a fix as an intentional Nola deviation from upstream behavior, not as a mechanical port correction.

## Prompt Split Excludes Latest Candidate

- Status: deferred
- Code location: `core/nola/application/live/realtime/whisper_streaming/processor.py`, `WhisperStreamingOnlineProcessor.build_prompt()`
- Related upstream location: `WhisperStreaming/whisper_online.py`, `OnlineASRProcessor.prompt()`
- Problem: prompt splitting starts at `len(committed_history) - 1`, so the latest committed word is always excluded from prompt candidates. When that word already scrolled out of the audio buffer, it still stays in the returned context instead of the prompt.
- Impact: prompt coverage can be one word shorter. The impact is limited now because the returned context is not used by `_process_iter()`.
- Later validation: add a prompt test with all committed words ending before `buffer_time_offset_ms`; verify the intended prompt contains the latest scrolled-out word before changing behavior.
- Notes: Revisit this before using the returned context for display, skipping, or additional processor logic.

## Generic Transcriber Error Mapping

- Status: resolved
- Code location: `core/nola/application/live/realtime/session.py`, `LiveRealtimeSessionRuntime._accept_frame_for_transcription()`
- Problem: an earlier review warned that unexpected real transcriber exceptions could map to `mock_transcriber_failed`.
- Current assessment: current code maps unexpected transcriber exceptions to `runtime_inference_failed`, so no code change or deferred fix is needed.
