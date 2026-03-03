import { describe, expect, it } from 'vitest'
import { validateFile, type FileValidationConfig } from '../file-validation'

/** Shared default config mirroring constants.ts values. */
const DEFAULT_CONFIG: FileValidationConfig = {
  allowedExtensions: ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'webm', 'aac', 'mp4', 'wma'],
  allowedMimeTypes: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/flac',
    'audio/x-flac',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/ogg',
    'audio/webm',
    'audio/aac',
    'audio/x-ms-wma',
    'video/mp4',
    'video/webm',
  ],
  maxFileSize: 500 * 1024 * 1024,
}

/** Create a minimal File-like object for testing. */
function fakeFile(name: string, size: number, type = ''): File {
  return new File([new ArrayBuffer(size)], name, { type })
}

describe('validateFile', () => {
  it('should accept a valid mp3 file', () => {
    const result = validateFile(fakeFile('audio.mp3', 1024, 'audio/mpeg'), DEFAULT_CONFIG)
    expect(result).toEqual({ valid: true })
  })

  it('should reject unsupported extension', () => {
    const result = validateFile(fakeFile('notes.txt', 100, 'text/plain'), DEFAULT_CONFIG)
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('VALIDATION_EXTENSION')
  })

  it('should reject unsupported MIME type', () => {
    const result = validateFile(fakeFile('audio.mp3', 100, 'text/plain'), DEFAULT_CONFIG)
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('VALIDATION_MIME')
  })

  it('should reject file exceeding max size', () => {
    const result = validateFile(
      fakeFile('big.mp3', 501 * 1024 * 1024, 'audio/mpeg'),
      DEFAULT_CONFIG,
    )
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('VALIDATION_FILE_SIZE')
  })

  it('should reject empty (zero-byte) file', () => {
    const result = validateFile(fakeFile('empty.mp3', 0, 'audio/mpeg'), DEFAULT_CONFIG)
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('VALIDATION_EMPTY_FILE')
  })

  it('should reject file without extension', () => {
    const result = validateFile(fakeFile('noext', 100, 'audio/mpeg'), DEFAULT_CONFIG)
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('VALIDATION_NO_EXTENSION')
  })

  it('should respect custom config values', () => {
    const strictConfig: FileValidationConfig = {
      allowedExtensions: ['wav'],
      allowedMimeTypes: ['audio/wav'],
      maxFileSize: 1024, // 1 KB
    }

    // mp3 rejected under strict config
    const r1 = validateFile(fakeFile('audio.mp3', 100, 'audio/mpeg'), strictConfig)
    expect(r1.valid).toBe(false)
    expect(r1.error?.code).toBe('VALIDATION_EXTENSION')

    // wav within limit accepted
    const r2 = validateFile(fakeFile('audio.wav', 512, 'audio/wav'), strictConfig)
    expect(r2).toEqual({ valid: true })

    // wav exceeding 1 KB rejected
    const r3 = validateFile(fakeFile('audio.wav', 2048, 'audio/wav'), strictConfig)
    expect(r3.valid).toBe(false)
    expect(r3.error?.code).toBe('VALIDATION_FILE_SIZE')
  })
})
