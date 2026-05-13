import { describe, expect, it } from 'vitest'

import { buildExportFilename, buildSingleExportFilename } from '../filename'

describe('buildSingleExportFilename', () => {
  it('uses custom filename when provided', () => {
    const filename = buildSingleExportFilename({
      format: 'srt',
      taskId: 'task-1',
      taskFilename: 'source.wav',
      customFilename: 'weekly-notes.vtt',
    })

    expect(filename).toBe('weekly-notes.srt')
  })

  it('falls back to task filename when custom filename is empty', () => {
    const filename = buildSingleExportFilename({
      format: 'ass',
      taskId: 'task-2',
      taskFilename: 'meeting-audio.mp3',
      customFilename: '   ',
    })

    expect(filename).toBe('meeting-audio.ass')
  })

  it('falls back to task id when task filename is unavailable', () => {
    const filename = buildSingleExportFilename({
      format: 'txt',
      taskId: 'task-3',
      taskFilename: null,
    })

    expect(filename).toBe('task-3.txt')
  })

  it('replaces each invalid or control character with underscore', () => {
    const filename = buildSingleExportFilename({
      format: 'srt',
      taskId: 'task-4',
      customFilename: String.raw`a<>b` + String.fromCharCode(1) + 'c.srt',
    })

    expect(filename).toBe('a__b_c.srt')
  })
})

describe('buildExportFilename', () => {
  it('builds a fallback filename for non-task exports', () => {
    const filename = buildExportFilename({
      fallbackId: 'session-1',
      format: 'vtt',
      sourceName: 'Live session',
    })

    expect(filename).toBe('Live session.vtt')
  })
})
