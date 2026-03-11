import type { components } from './openapi'

type Schemas = components['schemas']

/** GET /api/config response. */
export type AppConfig = Schemas['AppConfigResponse']

/** GET /api/config/transcription/engine-defaults response. */
export type EngineDefaults = Schemas['EngineDefaultsResponse']

/** PATCH /api/config/transcription/defaults response. */
export type TranscriptionDefaultsPatchResponse = Schemas['TranscriptionDefaultsPatchResponse']

/** Effective transcription defaults exposed inside GET /api/config. */
export type TranscriptionDefaults = Schemas['TranscriptionConfigResponse']['defaults']

/** Single selectable language entry from effective_languages. */
export type LanguageOption = Schemas['LanguageOptionSchema']
