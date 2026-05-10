import type { Meta, StoryObj } from '@storybook/react-vite'
import { Mic2, Save, SlidersHorizontal } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { FormRow } from './FormRow'
import {
  WorkspaceSidePanel,
  type WorkspaceSidePanelProps,
  type WorkspaceSidePanelSize,
} from './WorkspaceSidePanel'

const meta = {
  title: 'Layouts/WorkspaceSidePanel',
  component: WorkspaceSidePanel,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof WorkspaceSidePanel>

export default meta

type Story = StoryObj<typeof meta>

const baseArgs = {
  open: true,
  onOpenChange: () => undefined,
  title: 'Session settings',
  children: <div />,
}

interface WorkspacePreviewProps {
  initialOpen?: boolean
  panelSize?: WorkspaceSidePanelSize
  snapshotMode?: boolean
  panelArgs?: Partial<WorkspaceSidePanelProps>
}

const transcriptLines = [
  {
    source: 'Microphone',
    time: '00:00:04',
    text: 'Let us start with the product constraints before tuning the live session.',
  },
  {
    source: 'System audio',
    time: '00:00:11',
    text: 'The model should keep stable partials visible while final segments accumulate.',
  },
  {
    source: 'Microphone',
    time: '00:00:18',
    text: 'Session settings stay out of the way until the operator asks for them.',
  },
]

const sourceRows = [
  {
    source: 'Microphone',
    input: 'USB microphone',
    state: 'Capturing',
  },
  {
    source: 'System audio',
    input: 'Browser capture',
    state: 'Ready',
  },
]

function WorkspacePreview({
  initialOpen = true,
  panelSize = 'default',
  snapshotMode = false,
  panelArgs,
}: WorkspacePreviewProps) {
  const panelRegionId = useId()
  const [isOpen, setIsOpen] = useState(panelArgs?.open ?? initialOpen)

  function handleOpenChange(open: boolean): void {
    setIsOpen(open)
    panelArgs?.onOpenChange?.(open)
  }

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center p-6">
      <div className="bg-background flex h-[680px] w-full max-w-7xl flex-col overflow-hidden rounded-md border">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.22em] uppercase">
              Live session
            </p>
            <h1 className="text-foreground text-base font-semibold tracking-tight">
              Real-time transcription
            </h1>
          </div>
        </header>

        <section className="border-b px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight">Session setup</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={isOpen}
              aria-controls={panelRegionId}
              className={
                isOpen ? 'text-foreground px-0' : 'text-muted-foreground hover:text-foreground px-0'
              }
              onClick={() => handleOpenChange(!isOpen)}
            >
              <SlidersHorizontal className="size-4" />
              Session settings
            </Button>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border">
            <div className="text-muted-foreground bg-muted/30 grid grid-cols-[1fr_1.4fr_auto] gap-3 border-b px-3 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
              <span>Source</span>
              <span>Input</span>
              <span className="text-right">State</span>
            </div>
            {sourceRows.map((row, index) => (
              <div
                key={row.source}
                className={[
                  'grid grid-cols-[1fr_1.4fr_auto] items-center gap-3 px-3 py-2 text-sm',
                  index < sourceRows.length - 1 ? 'border-b' : '',
                ].join(' ')}
              >
                <span className="font-medium">{row.source}</span>
                <span className="text-muted-foreground min-w-0 truncate">{row.input}</span>
                <span className="bg-surface-container text-muted-foreground rounded-md px-2 py-0.5 text-right text-[11px] font-semibold tracking-[0.16em] uppercase">
                  {row.state}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="flex min-h-0 flex-1 gap-4 p-5">
          <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight">Transcript</h2>
              <span className="text-muted-foreground text-xs tabular-nums">00:00:22</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {transcriptLines.map((line) => (
                  <article
                    key={`${line.source}-${line.time}`}
                    className="rounded-md border px-4 py-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold">{line.source}</span>
                      <span className="text-muted-foreground tabular-nums">{line.time}</span>
                    </div>
                    <p className="text-sm leading-6">{line.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <div id={panelRegionId} className="contents">
            <WorkspaceSidePanel
              open={isOpen}
              onOpenChange={handleOpenChange}
              size={panelArgs?.size ?? panelSize}
              eyebrow={
                panelArgs?.eyebrow ?? (snapshotMode ? 'Resolved snapshot' : 'Session settings')
              }
              title={panelArgs?.title ?? (snapshotMode ? 'Runtime config' : 'Live runtime')}
              description={
                panelArgs?.description ??
                (snapshotMode
                  ? 'Read-only values resolved when this session started.'
                  : 'Draft values apply to the next live session start.')
              }
              closeLabel={panelArgs?.closeLabel ?? 'Close session settings'}
              className={panelArgs?.className ?? 'shadow-none'}
              bodyClassName={panelArgs?.bodyClassName}
              footerClassName={panelArgs?.footerClassName}
              headerAdornment={
                panelArgs?.headerAdornment ??
                (snapshotMode ? (
                  <span className="bg-muted rounded-md px-2 py-1 text-xs font-medium">
                    Read only
                  </span>
                ) : null)
              }
              footer={
                panelArgs?.footer ?? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      disabled={snapshotMode}
                    >
                      <Save className="size-4" />
                      Save defaults
                    </Button>
                    <Button type="button" disabled={snapshotMode}>
                      Apply to session
                    </Button>
                  </div>
                )
              }
            >
              {snapshotMode ? <SnapshotPanelBody /> : <EditableSettingsBody />}
            </WorkspaceSidePanel>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditableSettingsBody() {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="pb-3 text-sm font-semibold">Recognition</h3>
        <div className="border-y">
          <FormRow
            label="Task"
            description="Runtime task for the next session."
            align="center"
            className="py-4 md:grid-cols-[minmax(0,1fr)_minmax(120px,180px)]"
          >
            <span className="text-muted-foreground text-sm">Transcribe</span>
          </FormRow>
          <FormRow
            label="Language"
            description="Use backend effective language options."
            align="center"
            className="py-4 md:grid-cols-[minmax(0,1fr)_minmax(120px,180px)]"
          >
            <span className="text-muted-foreground text-sm">Auto detect</span>
          </FormRow>
          <FormRow
            label="Minimum chunk"
            description="Controls when audio chunks are processed."
            align="center"
            className="border-b-0 py-4 md:grid-cols-[minmax(0,1fr)_minmax(120px,180px)]"
          >
            <span className="text-muted-foreground text-sm">700 ms</span>
          </FormRow>
        </div>
      </section>

      <section>
        <h3 className="pb-3 text-sm font-semibold">Stability</h3>
        <div className="border-y">
          <FormRow
            label="Buffer trimming"
            description="Keeps the rolling audio buffer bounded."
            align="center"
            className="py-4 md:grid-cols-[minmax(0,1fr)_minmax(120px,180px)]"
          >
            <span className="text-muted-foreground text-sm">15 s</span>
          </FormRow>
          <FormRow
            label="Timestamp tolerance"
            description="Allows small timestamp correction."
            align="center"
            className="py-4 md:grid-cols-[minmax(0,1fr)_minmax(120px,180px)]"
          >
            <span className="text-muted-foreground text-sm">80 ms</span>
          </FormRow>
          <FormRow
            label="VAD filter"
            description="Use runtime voice activity detection."
            align="center"
            className="border-b-0 py-4 md:grid-cols-[minmax(0,1fr)_minmax(120px,180px)]"
          >
            <Switch defaultChecked aria-label="VAD filter" />
          </FormRow>
        </div>
      </section>

      <section>
        <h3 className="pb-3 text-sm font-semibold">Context</h3>
        <FormRow
          label={
            <span className="inline-flex items-center gap-2">
              <Mic2 className="text-muted-foreground size-4" />
              Context prompt
            </span>
          }
          description="Product names and domain terms."
          className="border-y py-4 md:grid-cols-[minmax(0,1fr)_minmax(160px,220px)]"
        >
          <p className="text-muted-foreground text-sm leading-6">
            Nola, Live Realtime, LocalAgreement
          </p>
        </FormRow>
      </section>
    </div>
  )
}

function SnapshotPanelBody() {
  return (
    <div className="overflow-hidden rounded-md border">
      {[
        ['runtime', 'whisper_streaming'],
        ['language', 'en'],
        ['task', 'transcribe'],
        ['beam_size', '5'],
        ['vad_parameters.threshold', '0.5'],
        ['condition_on_previous_text', 'true'],
      ].map(([label, value], index, rows) => (
        <div
          key={label}
          className={[
            'grid grid-cols-[minmax(0,1fr)_minmax(90px,auto)] gap-3 px-3 py-2 text-sm',
            index < rows.length - 1 ? 'border-b' : '',
          ].join(' ')}
        >
          <p className="text-muted-foreground min-w-0 truncate">{label}</p>
          <p className="font-medium break-words">{value}</p>
        </div>
      ))}
    </div>
  )
}

export const LiveSessionSettings: Story = {
  args: baseArgs,
  render: (args) => <WorkspacePreview key={String(args.open)} panelArgs={args} />,
}

export const ClosedByDefault: Story = {
  args: { ...baseArgs, open: false },
  render: (args) => (
    <WorkspacePreview key={String(args.open)} initialOpen={false} panelArgs={args} />
  ),
}

export const WideResolvedSnapshot: Story = {
  args: { ...baseArgs, size: 'wide' },
  render: (args) => (
    <WorkspacePreview
      key={`${args.open}-${args.size}`}
      panelSize="wide"
      snapshotMode
      panelArgs={args}
    />
  ),
}
