// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ContentCanvas } from '../ContentCanvas'
import { PageHeader } from '../PageHeader'
import { SettingsLayout } from '../SettingsLayout'
import { TwoColumnLayout } from '../TwoColumnLayout'

describe('ContentCanvas', () => {
  it('renders the expected semantic wrapper and default canvas classes', () => {
    render(
      <ContentCanvas as="main" className="custom-canvas">
        <div>Canvas body</div>
      </ContentCanvas>,
    )

    const canvas = screen.getByRole('main')
    expect(canvas).toHaveClass('max-w-5xl')
    expect(canvas).toHaveClass('custom-canvas')
    expect(screen.getByText('Canvas body')).toBeTruthy()
  })
})

describe('PageHeader', () => {
  it('renders title, description, and action content together', () => {
    render(
      <PageHeader
        title="Models"
        description="Configure and monitor system-level neural models."
        actions={<button type="button">Refresh</button>}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Models' })).toBeTruthy()
    expect(screen.getByText('Configure and monitor system-level neural models.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy()
  })
})

describe('TwoColumnLayout', () => {
  it('uses the planned content-heavy desktop split by default', () => {
    render(<TwoColumnLayout left={<div>Left column</div>} right={<div>Right column</div>} />)

    const left = screen.getByText('Left column').parentElement
    const right = screen.getByText('Right column').parentElement

    expect(left).toHaveClass('lg:col-span-7')
    expect(right).toHaveClass('lg:col-span-5')
  })

  it('supports alternate desktop ratios when requested', () => {
    render(
      <TwoColumnLayout
        left={<div>Left column</div>}
        right={<div>Right column</div>}
        ratio="balanced"
      />,
    )

    const left = screen.getByText('Left column').parentElement
    const right = screen.getByText('Right column').parentElement

    expect(left).toHaveClass('lg:col-span-6')
    expect(right).toHaveClass('lg:col-span-6')
  })
})

describe('SettingsLayout', () => {
  it('renders the default settings tab navigation and highlights the active section', () => {
    render(
      <SettingsLayout activeTab="export">
        <div>Export body</div>
      </SettingsLayout>,
    )

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Settings sections' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Export' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Export body')).toBeTruthy()
  })

  it('can resolve the active tab from the current path when no explicit key is provided', () => {
    render(
      <SettingsLayout currentPath="/settings/model-storage">
        <div>Storage body</div>
      </SettingsLayout>,
    )

    expect(screen.getByRole('link', { name: 'Model Storage' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
