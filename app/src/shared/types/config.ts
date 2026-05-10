import type { components } from './openapi'

type Schemas = components['schemas']

/** Live realtime runtime adapter selected by the backend process. */
export type LiveRealtimeAdapter = Schemas['LiveRealtimeConfigResponse']['runtime_adapter']

/** Runtime mode metadata exposed by GET /api/config. */
export type LiveRealtimeRuntimeConfig = Schemas['LiveRealtimeConfigResponse']

/** GET /api/config response. */
export type AppConfig = Schemas['AppConfigResponse']

/** GET /api/config/transcription/engine-defaults response. */
export type EngineDefaults = Schemas['EngineDefaultsResponse']

/** PATCH /api/config/transcription/defaults response. */
export type TranscriptionDefaultsPatchResponse = Schemas['TranscriptionDefaultsPatchResponse']

/** PATCH /api/config/transcription/defaults request body. */
export type TranscriptionDefaultsUpdateRequest = Schemas['TranscriptionDefaultsUpdateRequest']

/** GET /api/config/session-defaults response. */
export type SessionDefaults = Schemas['SessionDefaultsResponse']

/** PATCH /api/config/session-defaults request body. */
export type SessionDefaultsUpdateRequest = Schemas['SessionDefaultsUpdateRequest']

/** GET /api/config/live-realtime/defaults response. */
export type LiveRealtimeDefaultsResponse = Schemas['LiveRealtimeDefaultsResponse']

/** Effective Live realtime defaults exposed inside the defaults response. */
export type LiveRealtimeDefaults = Schemas['LiveRealtimeDefaults']

/** PATCH /api/config/live-realtime/defaults response. */
export type LiveRealtimeDefaultsPatchResponse = Schemas['LiveRealtimeDefaultsPatchResponse']

/** PATCH /api/config/live-realtime/defaults request body. */
export type LiveRealtimeDefaultsUpdateRequest = Schemas['LiveRealtimeDefaultsUpdateRequest']

/** GET /api/config/live-realtime/schema response. */
export type LiveRealtimeSchemaResponse = Schemas['LiveRealtimeSchemaResponse']

/** Schema group describing frontend-renderable Live realtime options. */
export type LiveRealtimeOptionGroup = Schemas['LiveRealtimeOptionGroupSchema']

/** Union of all field schema variants under a Live realtime option group. */
export type LiveRealtimeOptionField = LiveRealtimeOptionGroup['fields'][number]

/** Execution defaults exposed inside GET /api/config/session-defaults. */
export type SessionExecutionDefaults = Schemas['SessionExecutionDefaultsResponse']

/** Engine device option accepted by task and session execution config. */
export type EngineDevice = SessionExecutionDefaults['device']

/** Engine compute type option accepted by task and session execution config. */
export type EngineComputeType = SessionExecutionDefaults['compute_type']

/** Execution-default patch payload for Workbench defaults. */
export type SessionExecutionDefaultsUpdateRequest = Schemas['SessionExecutionDefaultsUpdateRequest']

/** GET /api/config/export response. */
export type ExportConfig = Schemas['ExportConfigResponse']

/** Effective export defaults exposed inside GET /api/config/export. */
export type ExportDefaults = Schemas['ExportConfigResponse']['defaults']

/** PATCH /api/config/export/defaults response. */
export type ExportDefaultsPatchResponse = Schemas['ExportDefaultsPatchResponse']

/** PATCH /api/config/export/defaults request body. */
export type ExportDefaultsUpdateRequest = Schemas['ExportDefaultsUpdateRequest']

/** Effective transcription defaults exposed inside GET /api/config. */
export type TranscriptionDefaults = Schemas['TranscriptionConfigResponse']['defaults']

/** Schema group describing frontend-renderable transcription options. */
export type TranscriptionOptionGroup = Schemas['OptionGroupSchema']

/** Union of all field schema variants under a transcription option group. */
export type TranscriptionOptionField = TranscriptionOptionGroup['fields'][number]

/** Discriminated number input field metadata from backend schema. */
export type NumberOptionField = Schemas['NumberFieldSchema']

/** Discriminated select input field metadata from backend schema. */
export type SelectOptionField = Schemas['SelectFieldSchema']

/** Single selectable language entry from effective_languages. */
export type LanguageOption = Schemas['LanguageOptionSchema']
