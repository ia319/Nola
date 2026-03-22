import { describe, expect, it } from 'vitest'

import { buildSingleExportFilename } from '../filename'

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

    expect(filename).toBe('task-task-3.txt')
  })
})
