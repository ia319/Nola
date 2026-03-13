import type { components } from './openapi'

type Schemas = components['schemas']

/** GET /api/config response. */
export type AppConfig = Schemas['AppConfigResponse']

/** GET /api/config/transcription/engine-defaults response. */
export type EngineDefaults = Schemas['EngineDefaultsResponse']

/** PATCH /api/config/transcription/defaults response. */
export type TranscriptionDefaultsPatchResponse = Schemas['TranscriptionDefaultsPatchResponse']

/** PATCH /api/config/transcription/defaults request body. */
export type TranscriptionDefaultsUpdateRequest = Schemas['TranscriptionDefaultsUpdateRequest']

/** Effective transcription defaults exposed inside GET /api/config. */
export type TranscriptionDefaults = Schemas['TranscriptionConfigResponse']['defaults']

/** Schema group describing frontend-renderable transcription options. */
export type TranscriptionOptionGroup = Schemas['OptionGroupSchema']

/** Union of all field schema variants under a transcription option group. */
export type TranscriptionOptionField = TranscriptionOptionGroup['fields'][number]

/** Discriminated number input field metadata from backend schema. */
export type NumberOptionField = Schemas['NumberFieldSchema']

/** Single selectable language entry from effective_languages. */
export type LanguageOption = Schemas['LanguageOptionSchema']
