import { describe, expect, it } from 'vitest'

import type { UploadItem } from '@/features/upload/types'
import {
  patchUploadItem,
  removeUploadItem,
  selectAvailableFileIds,
  selectHasErrors,
  selectIsUploading,
} from '../state'

function fakeFile(name: string): File {
  return new File(['x'], name, { type: 'audio/mpeg' })
}

function buildUpload(
  overrides: Partial<UploadItem> & Pick<UploadItem, 'id' | 'status'>,
): UploadItem {
  return {
    id: overrides.id,
    file: overrides.file ?? fakeFile(`${overrides.id}.mp3`),
    status: overrides.status,
    progress: overrides.progress ?? 0,
    error: overrides.error ?? null,
    fileId: overrides.fileId ?? null,
    taskCreated: overrides.taskCreated ?? false,
  }
}

describe('upload state helpers', () => {
  it('patches only the matching item', () => {
    const uploads = [
      buildUpload({ id: '1', status: 'pending' }),
      buildUpload({ id: '2', status: 'uploading', progress: 25 }),
    ]

    const next = patchUploadItem(uploads, '2', { progress: 90, status: 'success' })

    expect(next).toEqual([
      uploads[0],
      expect.objectContaining({ id: '2', progress: 90, status: 'success' }),
    ])
  })

  it('removes the matching item by id', () => {
    const uploads = [
      buildUpload({ id: '1', status: 'pending' }),
      buildUpload({ id: '2', status: 'error' }),
    ]

    expect(removeUploadItem(uploads, '1')).toEqual([uploads[1]])
  })

  it('selects only uploaded files that are not attached to a task', () => {
    const uploads = [
      buildUpload({ id: '1', status: 'success', fileId: 'file-1', taskCreated: false }),
      buildUpload({ id: '2', status: 'success', fileId: 'file-2', taskCreated: true }),
      buildUpload({ id: '3', status: 'pending', fileId: 'file-3', taskCreated: false }),
    ]

    expect(selectAvailableFileIds(uploads)).toEqual(['file-1'])
  })

  it('reports uploading and error presence from the list', () => {
    const uploads = [
      buildUpload({ id: '1', status: 'uploading' }),
      buildUpload({
        id: '2',
        status: 'error',
        error: {
          code: 'UPLOAD_FAILED',
          i18nKey: 'upload.error.uploadFailed',
          retriable: true,
        },
      }),
    ]

    expect(selectIsUploading(uploads)).toBe(true)
    expect(selectHasErrors(uploads)).toBe(true)
  })
})
