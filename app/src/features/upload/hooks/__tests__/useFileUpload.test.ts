import { act, renderHook, waitFor } from '@testing-library/react'
import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFileUpload } from '../useFileUpload'
import { deleteFile, uploadFile } from '@/features/upload/api'
import { UPLOAD_CONCURRENCY } from '@/config/constants'
import type { FileUploadResponse } from '@/shared/types'

vi.mock('@/features/upload/api', () => ({
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
}))

const uploadFileMock = vi.mocked(uploadFile)
const deleteFileMock = vi.mocked(deleteFile)

function fakeFile(name: string, size: number, type = 'audio/mpeg'): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function buildUploadResponse(fileId: string, file: File): FileUploadResponse {
  return {
    file_id: fileId,
    filename: file.name,
    size: file.size,
    content_type: file.type || null,
  }
}

function deferred<T>() {
  let resolve: (value: T) => void
  let reject: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  }
}

describe('useFileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns initial empty state', () => {
    const { result } = renderHook(() => useFileUpload())

    expect(result.current.uploads).toEqual([])
    expect(result.current.isUploading).toBe(false)
    expect(result.current.availableFileIds).toEqual([])
    expect(result.current.hasErrors).toBe(false)
  })

  it('adds one valid file as pending', () => {
    const { result } = renderHook(() => useFileUpload())
    const file = fakeFile('one.mp3', 1024, 'audio/mpeg')

    act(() => {
      result.current.addFiles([file])
    })

    expect(result.current.uploads).toHaveLength(1)
    expect(result.current.uploads[0].status).toBe('pending')
    expect(result.current.uploads[0].error).toBeNull()
    expect(result.current.hasErrors).toBe(false)
  })

  it('adds mixed valid and invalid files with per-item status', () => {
    const { result } = renderHook(() => useFileUpload())
    const valid = fakeFile('ok.mp3', 1024, 'audio/mpeg')
    const invalid = fakeFile('bad.txt', 1024, 'text/plain')

    act(() => {
      result.current.addFiles([valid, invalid])
    })

    expect(result.current.uploads).toHaveLength(2)
    expect(result.current.uploads[0].status).toBe('pending')
    expect(result.current.uploads[1].status).toBe('error')
    expect(result.current.uploads[1].error?.code).toBe('VALIDATION_EXTENSION')
    expect(result.current.hasErrors).toBe(true)
  })

  it('uploads pending file and exposes available file id', async () => {
    const { result } = renderHook(() => useFileUpload())
    const file = fakeFile('done.mp3', 2048, 'audio/mpeg')
    uploadFileMock.mockResolvedValue(buildUploadResponse('file-1', file))

    act(() => {
      result.current.addFiles([file])
    })

    await act(async () => {
      await result.current.startUpload()
    })

    expect(result.current.uploads[0].status).toBe('success')
    expect(result.current.uploads[0].progress).toBe(100)
    expect(result.current.uploads[0].fileId).toBe('file-1')
    expect(result.current.availableFileIds).toEqual(['file-1'])
  })

  it('maps upload failure to upload error state', async () => {
    const { result } = renderHook(() => useFileUpload())
    const file = fakeFile('fail.mp3', 1024, 'audio/mpeg')
    uploadFileMock.mockRejectedValue(new Error('network down'))

    act(() => {
      result.current.addFiles([file])
    })

    await act(async () => {
      await result.current.startUpload()
    })

    expect(result.current.uploads[0].status).toBe('error')
    expect(result.current.uploads[0].error?.code).toBe('UPLOAD_FAILED')
    expect(result.current.hasErrors).toBe(true)
  })

  it('keeps cancelled status after axios canceled error', async () => {
    const { result } = renderHook(() => useFileUpload())
    const file = fakeFile('cancel.mp3', 1024, 'audio/mpeg')

    uploadFileMock.mockImplementation(
      (_file, _onProgress, signal) =>
        new Promise<FileUploadResponse>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new axios.CanceledError('user cancelled'))
          })
        }),
    )

    act(() => {
      result.current.addFiles([file])
    })

    const id = result.current.uploads[0].id

    let startPromise: Promise<void> | null = null
    act(() => {
      startPromise = result.current.startUpload()
    })

    await waitFor(() => {
      expect(result.current.uploads[0].status).toBe('uploading')
    })

    act(() => {
      result.current.cancelUpload(id)
    })

    await act(async () => {
      await startPromise
    })

    expect(result.current.uploads[0].status).toBe('cancelled')
  })

  it('retries failed upload and transitions to success', async () => {
    const { result } = renderHook(() => useFileUpload())
    const file = fakeFile('retry.mp3', 1024, 'audio/mpeg')
    let calls = 0

    uploadFileMock.mockImplementation(async (uploadedFile) => {
      calls += 1
      if (calls === 1) {
        throw new Error('temporary failure')
      }
      return buildUploadResponse('retry-1', uploadedFile)
    })

    act(() => {
      result.current.addFiles([file])
    })

    await act(async () => {
      await result.current.startUpload()
    })
    expect(result.current.uploads[0].status).toBe('error')

    const id = result.current.uploads[0].id
    await act(async () => {
      await result.current.retryUpload(id)
    })

    expect(result.current.uploads[0].status).toBe('success')
    expect(result.current.uploads[0].fileId).toBe('retry-1')
  })

  it('limits concurrent uploads to configured batch size', async () => {
    const { result } = renderHook(() => useFileUpload())
    const f1 = fakeFile('a.mp3', 1024)
    const f2 = fakeFile('b.mp3', 1024)
    const f3 = fakeFile('c.mp3', 1024)
    const d1 = deferred<FileUploadResponse>()
    const d2 = deferred<FileUploadResponse>()
    const d3 = deferred<FileUploadResponse>()
    const queue = [d1, d2, d3]
    let inFlight = 0
    let maxInFlight = 0

    uploadFileMock.mockImplementation(() => {
      const task = queue.shift()
      if (!task) {
        throw new Error('unexpected upload call')
      }

      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)

      return task.promise.finally(() => {
        inFlight -= 1
      })
    })

    act(() => {
      result.current.addFiles([f1, f2, f3])
    })

    let startPromise: Promise<void> | null = null
    act(() => {
      startPromise = result.current.startUpload()
    })

    await waitFor(() => {
      expect(uploadFileMock).toHaveBeenCalledTimes(UPLOAD_CONCURRENCY)
    })
    expect(maxInFlight).toBe(UPLOAD_CONCURRENCY)

    d1.resolve(buildUploadResponse('id-1', f1))
    d2.resolve(buildUploadResponse('id-2', f2))

    await waitFor(() => {
      expect(uploadFileMock).toHaveBeenCalledTimes(3)
    })

    d3.resolve(buildUploadResponse('id-3', f3))

    await act(async () => {
      await startPromise
    })
    expect(maxInFlight).toBe(UPLOAD_CONCURRENCY)
  })

  it('removes success item and deletes remote orphan file', async () => {
    const { result } = renderHook(() => useFileUpload())
    const file = fakeFile('remote.mp3', 1024)
    uploadFileMock.mockResolvedValue(buildUploadResponse('remote-1', file))
    deleteFileMock.mockResolvedValue({ message: 'ok' })

    act(() => {
      result.current.addFiles([file])
    })
    await act(async () => {
      await result.current.startUpload()
    })

    const id = result.current.uploads[0].id
    await act(async () => {
      await result.current.removeFile(id)
    })

    expect(deleteFileMock).toHaveBeenCalledWith('remote-1')
    expect(result.current.uploads).toEqual([])
  })

  it('aborts in-flight upload and clears state on reset', async () => {
    const { result } = renderHook(() => useFileUpload())
    const file = fakeFile('running.mp3', 1024)
    const capturedSignals: AbortSignal[] = []

    uploadFileMock.mockImplementation(
      (_file, _onProgress, signal) =>
        new Promise<FileUploadResponse>((_resolve, reject) => {
          if (signal) {
            capturedSignals.push(signal)
            signal.addEventListener('abort', () => reject(new axios.CanceledError('aborted')))
          }
        }),
    )

    act(() => {
      result.current.addFiles([file])
    })

    let startPromise: Promise<void> | null = null
    act(() => {
      startPromise = result.current.startUpload()
    })

    await waitFor(() => {
      expect(result.current.uploads[0].status).toBe('uploading')
    })

    await act(async () => {
      await result.current.reset()
    })
    await act(async () => {
      await startPromise
    })

    expect(capturedSignals[0]?.aborted).toBe(true)
    expect(result.current.uploads).toEqual([])
  })

  it('does not delete remote file after task is marked created', async () => {
    const { result, unmount } = renderHook(() => useFileUpload())
    const file = fakeFile('used.mp3', 1024)
    uploadFileMock.mockResolvedValue(buildUploadResponse('used-1', file))

    act(() => {
      result.current.addFiles([file])
    })
    await act(async () => {
      await result.current.startUpload()
    })

    act(() => {
      result.current.markTaskCreated('used-1')
    })

    await act(async () => {
      await result.current.reset()
    })

    expect(deleteFileMock).not.toHaveBeenCalled()

    // Ensure cleanup path is also safe after reset.
    unmount()
  })
})
