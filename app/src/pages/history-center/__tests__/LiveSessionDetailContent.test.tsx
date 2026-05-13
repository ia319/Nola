// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { LiveSessionDetail } from '@/shared/types'
import { LiveSessionDetailContent } from '../LiveSessionDetailContent'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const messages: Record<string, string> = {
        'history.live.status.finished': 'Finished',
        'history.live.detail.sections.transcriptionResult': 'Transcription Result',
        'history.live.detail.sections.sessionMetadata': 'Session Metadata',
        'history.live.detail.sections.technicalProperties': 'Technical Properties',
        'history.live.detail.fields.status': 'Status',
        'history.live.detail.fields.mode': 'Mode',
        'history.live.detail.fields.startedAt': 'Started At',
        'history.live.detail.fields.endedAt': 'Ended At',
        'history.live.detail.fields.languageHint': 'Language Hint',
        'history.live.detail.fields.model': 'Model',
        'history.live.detail.fields.runtime': 'Runtime',
        'history.live.detail.fields.audioFormat': 'Audio Format',
        'history.live.detail.fields.unavailable': 'Unavailable',
        'history.live.detail.mode.streaming': 'Streaming',
        'history.live.detail.segments.empty.title': 'No final segments available',
        'history.live.detail.segments.empty.description': 'No final segments yet',
        'history.requestParameters.title': 'Request Parameters',
        'history.requestParameters.unavailable.title': 'Request parameters unavailable',
        'history.requestParameters.unavailable.description': 'No request parameters',
        'history.table.modelFallback': 'Unknown model',
      }

      return messages[key] ?? key
    },
  }),
}))

function createLiveSession(overrides: Partial<LiveSessionDetail> = {}): LiveSessionDetail {
  return {
    audio_format: 'pcm16le',
    created_at: '2026-04-11T10:00:00.000Z',
    ended_at: '2026-04-11T10:12:00.000Z',
    error: null,
    language_hint: 'en',
    mode: 'streaming',
    model_id: 'large-v3',
    request_overrides: null,
    runtime: 'whisper_streaming',
    runtime_config: null,
    segment_limit: 100,
    segment_offset: 0,
    segment_total: 1,
    segments: [
      {
        confidence: null,
        created_at: '2026-04-11T10:00:01.000Z',
        end_ms: 2500,
        is_final: true,
        language: 'en',
        segment_id: 'segment-1',
        sequence: 1,
        session_id: 'live-1',
        start_ms: 0,
        text: 'Live transcript line.',
        track_id: null,
      },
    ],
    session_id: 'live-1',
    started_at: '2026-04-11T10:00:00.000Z',
    status: 'finished',
    title: 'Live briefing',
    tracks: [],
    updated_at: '2026-04-11T10:12:00.000Z',
    ...overrides,
  }
}

describe('LiveSessionDetailContent', () => {
  it('renders final segments and request overrides as json', () => {
    render(
      <LiveSessionDetailContent
        session={createLiveSession({
          request_overrides: {
            model_id: 'large-v3',
            runtime_overrides: {
              language: 'en',
            },
          },
        })}
      />,
    )

    expect(screen.getByText('Live transcript line.')).toBeInTheDocument()
    expect(screen.getByText('[00:00:00.000 - 00:00:02.500]')).toBeInTheDocument()
    expect(screen.getByText('Request Parameters')).toBeInTheDocument()
    expect(screen.getByText(/"model_id": "large-v3"/)).toBeInTheDocument()
    expect(screen.getByText(/"language": "en"/)).toBeInTheDocument()
  })

  it('renders empty states for missing segments and request overrides', () => {
    render(
      <LiveSessionDetailContent
        session={createLiveSession({
          request_overrides: null,
          segment_total: 0,
          segments: [],
        })}
      />,
    )

    expect(screen.getByText('No final segments available')).toBeInTheDocument()
    expect(screen.getByText('Request parameters unavailable')).toBeInTheDocument()
  })

  it('renders the empty state when only non-final segments exist', () => {
    render(
      <LiveSessionDetailContent
        session={createLiveSession({
          segments: [
            {
              confidence: null,
              created_at: '2026-04-11T10:00:01.000Z',
              end_ms: 2500,
              is_final: false,
              language: 'en',
              segment_id: 'segment-1',
              sequence: 1,
              session_id: 'live-1',
              start_ms: 0,
              text: 'Draft transcript line.',
              track_id: null,
            },
          ],
        })}
      />,
    )

    expect(screen.getByText('No final segments available')).toBeInTheDocument()
    expect(screen.queryByText('Draft transcript line.')).not.toBeInTheDocument()
  })
})
