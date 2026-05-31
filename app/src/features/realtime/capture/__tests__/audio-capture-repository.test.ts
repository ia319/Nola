import { describe, expect, it } from 'vitest'

import { createAudioCaptureRepository } from '../audio-capture-repository'
import { TauriAudioCaptureRepository } from '../tauri-audio-capture-repository'
import { WebAudioCaptureRepository } from '../web-audio-capture-repository'

describe('createAudioCaptureRepository', () => {
  it('creates the web repository for the web runtime', async () => {
    await expect(createAudioCaptureRepository('web')).resolves.toBeInstanceOf(
      WebAudioCaptureRepository,
    )
  })

  it('creates the tauri repository for the tauri runtime', async () => {
    await expect(createAudioCaptureRepository('tauri')).resolves.toBeInstanceOf(
      TauriAudioCaptureRepository,
    )
  })
})
