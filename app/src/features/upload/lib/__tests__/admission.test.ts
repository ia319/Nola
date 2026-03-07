import { describe, expect, it, vi } from 'vitest'

import type { FileValidationConfig } from '@/shared/lib/file-validation'
import type { UploadItem } from '@/features/upload/types'
import { admitFiles } from '../admission'

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

function fakeFile(name: string, size: number, type = 'audio/mpeg', lastModified = 1): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  Object.defineProperty(file, 'lastModified', { value: lastModified })
  return file
}

function buildUploadItem(file: File): UploadItem {
  return {
    id: crypto.randomUUID(),
    file,
    status: 'pending',
    progress: 0,
    error: null,
    fileId: null,
    taskCreated: false,
  }
}

describe('admitFiles', () => {
  it('creates queue items and preserves per-file validation results', () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-0000-0000-000000000001')
      .mockReturnValueOnce('00000000-0000-0000-0000-000000000002')

    const valid = fakeFile('good.mp3', 1024)
    const invalid = fakeFile('bad.txt', 1024, 'text/plain')

    const result = admitFiles([valid, invalid], [], DEFAULT_CONFIG)

    expect(result.batchError).toBeNull()
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({
      id: '00000000-0000-0000-0000-000000000001',
      status: 'pending',
      error: null,
      taskCreated: false,
    })
    expect(result.items[1]).toMatchObject({
      id: '00000000-0000-0000-0000-000000000002',
      status: 'error',
      taskCreated: false,
    })
    expect(result.items[1].error?.code).toBe('VALIDATION_EXTENSION')
  })

  it('skips duplicates already queued and within the same selection', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-0000-0000-000000000003')

    const existing = fakeFile('queued.mp3', 1024, 'audio/mpeg', 11)
    const unique = fakeFile('fresh.mp3', 2048, 'audio/mpeg', 22)
    const duplicateInQueue = fakeFile('queued.mp3', 1024, 'audio/mpeg', 11)
    const duplicateOne = fakeFile('same.mp3', 4096, 'audio/mpeg', 33)
    const duplicateTwo = fakeFile('same.mp3', 4096, 'audio/mpeg', 33)

    const result = admitFiles(
      [duplicateInQueue, unique, duplicateOne, duplicateTwo],
      [buildUploadItem(existing)],
      DEFAULT_CONFIG,
    )

    expect(result.items).toHaveLength(2)
    expect(result.items.map((item) => item.file.name)).toEqual(['fresh.mp3', 'same.mp3'])
    expect(result.batchError).toMatchObject({
      code: 'VALIDATION_DUPLICATE',
      i18nKey: 'upload.error.duplicateFiles',
      params: { count: 2 },
      retriable: false,
    })
  })
})
