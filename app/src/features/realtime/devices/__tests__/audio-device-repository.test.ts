import { describe, expect, it } from 'vitest'

import { createAudioDeviceRepository } from '../audio-device-repository'
import { TauriAudioDeviceRepository } from '../tauri-audio-device-repository'
import { WebAudioDeviceRepository } from '../web-audio-device-repository'

describe('createAudioDeviceRepository', () => {
  it('creates the web repository for the web runtime', async () => {
    await expect(createAudioDeviceRepository('web')).resolves.toBeInstanceOf(
      WebAudioDeviceRepository,
    )
  })

  it('creates the tauri repository for the tauri runtime', async () => {
    await expect(createAudioDeviceRepository('tauri')).resolves.toBeInstanceOf(
      TauriAudioDeviceRepository,
    )
  })
})
