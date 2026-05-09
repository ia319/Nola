// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LiveWorkbenchPage } from '../LiveWorkbenchPage'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const messages: Record<string, string> = {
        'live.workbench.title': 'Live',
        'live.workbench.description': 'Real-time transcription',
        'live.workbench.sessionSetup.title': 'Session setup',
        'live.workbench.transcript.title': 'Live transcript',
        'live.workbench.transcript.empty': 'No transcript yet',
      }

      return messages[key] ?? key
    },
  }),
}))

describe('LiveWorkbenchPage', () => {
  it('renders the live workbench scaffold', () => {
    render(<LiveWorkbenchPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Live' })).toBeTruthy()
    expect(screen.getByText('Real-time transcription')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Session setup' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Live transcript' })).toBeTruthy()
    expect(screen.getByText('No transcript yet')).toBeTruthy()
    expect(
      screen.getByText('Live transcript').closest('[data-slot="live-workbench-page"]'),
    ).toBeTruthy()
  })
})
