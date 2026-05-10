import { useTranslation } from 'react-i18next'
import { Mic, Monitor, SlidersHorizontal, Square } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button, Card, CardContent, Label, Progress, Switch } from '@/components/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface LiveWorkbenchSessionSetupOption {
  value: string
  label: string
  disabled?: boolean
}

export type LiveWorkbenchSourceTone = 'muted' | 'normal' | 'success' | 'warning' | 'danger'

export interface LiveWorkbenchSessionSetupProps {
  modelValue: string
  modelOptions: readonly LiveWorkbenchSessionSetupOption[]
  modelDisabled?: boolean
  taskValue: string
  taskOptions: readonly LiveWorkbenchSessionSetupOption[]
  taskDisabled?: boolean
  taskLabel: string
  languageValue: string
  languageOptions: readonly LiveWorkbenchSessionSetupOption[]
  languageDisabled?: boolean
  languageLabel: string
  runtimeSummary: string
  microphoneEnabled: boolean
  microphoneValue: string
  microphoneOptions: readonly LiveWorkbenchSessionSetupOption[]
  microphoneDisabled?: boolean
  microphoneStatus: string
  microphoneStatusTone: LiveWorkbenchSourceTone
  microphoneLevelPercent: number
  microphoneActionLabel: string
  microphoneActionDisabled?: boolean
  microphoneActionMode: 'test' | 'stop'
  systemAudioEnabled: boolean
  systemAudioDisabled?: boolean
  systemAudioStatus: string
  systemAudioStatusTone: LiveWorkbenchSourceTone
  systemAudioLevelPercent: number
  systemAudioCaptureSource: string
  systemAudioActionLabel: string
  systemAudioActionDisabled?: boolean
  systemAudioActionMode: 'test' | 'stop'
  settingsOpen: boolean
  settingsDisabled?: boolean
  onModelChange: (value: string) => void
  onTaskChange: (value: string) => void
  onLanguageChange: (value: string) => void
  onMicrophoneEnabledChange: (enabled: boolean) => void
  onMicrophoneChange: (value: string) => void
  onMicrophoneAction: () => void
  onSystemAudioEnabledChange: (enabled: boolean) => void
  onSystemAudioAction: () => void
  onSettingsToggle: () => void
}

interface SetupSelectControlProps {
  id: string
  label: string
  value: string
  options: readonly LiveWorkbenchSessionSetupOption[]
  disabled?: boolean
  onValueChange: (value: string) => void
}

interface SetupReadonlyControlProps {
  id: string
  label: string
  value: string
}

function SetupSelectControl({
  id,
  label,
  value,
  options,
  disabled,
  onValueChange,
}: SetupSelectControlProps) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function SetupReadonlyControl({ id, label, value }: SetupReadonlyControlProps) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p id={id} className="text-sm leading-none font-medium">
        {label}
      </p>
      <div
        aria-labelledby={id}
        className="border-input bg-muted/30 text-muted-foreground flex h-9 w-full items-center rounded-md border px-3 text-sm shadow-xs"
      >
        <span className="min-w-0 truncate">{value}</span>
      </div>
    </div>
  )
}

const SOURCE_STATUS_TONE_CLASS: Record<LiveWorkbenchSourceTone, string> = {
  muted: 'text-muted-foreground',
  normal: 'text-foreground',
  success: 'text-emerald-700 dark:text-emerald-400',
  warning: 'text-amber-700 dark:text-amber-400',
  danger: 'text-destructive',
}

interface AudioSourcePanelProps {
  id: string
  title: string
  description: string
  enabled: boolean
  disabled?: boolean
  status: string
  statusTone: LiveWorkbenchSourceTone
  levelLabel: string
  levelPercent: number
  actionLabel: string
  actionDisabled?: boolean
  actionMode: 'test' | 'stop'
  icon: 'microphone' | 'system'
  children?: ReactNode
  onEnabledChange: (enabled: boolean) => void
  onAction: () => void
}

function AudioSourcePanel({
  id,
  title,
  description,
  enabled,
  disabled,
  status,
  statusTone,
  levelLabel,
  levelPercent,
  actionLabel,
  actionDisabled,
  actionMode,
  icon,
  children,
  onEnabledChange,
  onAction,
}: AudioSourcePanelProps) {
  const SourceIcon = icon === 'microphone' ? Mic : Monitor
  const ActionIcon = actionMode === 'stop' ? Square : SourceIcon

  return (
    <section className="min-w-0" aria-labelledby={`${id}-title`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3
            id={`${id}-title`}
            className="text-foreground flex items-center gap-2 text-sm font-medium"
          >
            <SourceIcon className="text-muted-foreground size-4" />
            <span className="truncate">{title}</span>
          </h3>
          <p className="text-muted-foreground text-xs leading-5">{description}</p>
        </div>
        <Switch
          id={`${id}-enabled`}
          size="sm"
          checked={enabled}
          disabled={disabled}
          aria-label={title}
          onCheckedChange={onEnabledChange}
        />
      </div>

      <div className={children ? 'mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]' : 'mt-3 flex'}>
        {children ? <div className="min-w-0">{children}</div> : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="md:self-end"
          disabled={actionDisabled}
          onClick={onAction}
        >
          <ActionIcon className="size-4" />
          {actionLabel}
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className={SOURCE_STATUS_TONE_CLASS[statusTone]}>{status}</span>
          <span className="text-muted-foreground">{levelLabel}</span>
        </div>
        <Progress value={levelPercent} className="h-1.5" />
      </div>
    </section>
  )
}

export function LiveWorkbenchSessionSetup({
  modelValue,
  modelOptions,
  modelDisabled,
  taskValue,
  taskOptions,
  taskDisabled,
  taskLabel,
  languageValue,
  languageOptions,
  languageDisabled,
  languageLabel,
  runtimeSummary,
  microphoneEnabled,
  microphoneValue,
  microphoneOptions,
  microphoneDisabled,
  microphoneStatus,
  microphoneStatusTone,
  microphoneLevelPercent,
  microphoneActionLabel,
  microphoneActionDisabled,
  microphoneActionMode,
  systemAudioEnabled,
  systemAudioDisabled,
  systemAudioStatus,
  systemAudioStatusTone,
  systemAudioLevelPercent,
  systemAudioCaptureSource,
  systemAudioActionLabel,
  systemAudioActionDisabled,
  systemAudioActionMode,
  settingsOpen,
  settingsDisabled,
  onModelChange,
  onTaskChange,
  onLanguageChange,
  onMicrophoneEnabledChange,
  onMicrophoneChange,
  onMicrophoneAction,
  onSystemAudioEnabledChange,
  onSystemAudioAction,
  onSettingsToggle,
}: LiveWorkbenchSessionSetupProps) {
  const { t } = useTranslation()

  return (
    <Card className="gap-0 py-0" data-slot="live-workbench-session-setup">
      <CardContent className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-foreground text-base font-semibold tracking-tight">
            {t('live.workbench.sessionSetup.title')}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={settingsOpen}
            className={
              settingsOpen
                ? 'text-foreground px-0'
                : 'text-muted-foreground hover:text-foreground px-0'
            }
            disabled={settingsDisabled}
            onClick={onSettingsToggle}
          >
            <SlidersHorizontal className="size-4" />
            {t('live.workbench.sessionSetup.settings')}
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(13rem,1.25fr)_minmax(10rem,0.8fr)_minmax(10rem,0.8fr)_minmax(12rem,0.9fr)]">
          <SetupSelectControl
            id="live-workbench-model-select"
            label={t('live.workbench.sessionSetup.model.label')}
            value={modelValue}
            options={modelOptions}
            disabled={modelDisabled}
            onValueChange={onModelChange}
          />
          <SetupSelectControl
            id="live-workbench-task-select"
            label={taskLabel}
            value={taskValue}
            options={taskOptions}
            disabled={taskDisabled}
            onValueChange={onTaskChange}
          />
          <SetupSelectControl
            id="live-workbench-language-select"
            label={languageLabel}
            value={languageValue}
            options={languageOptions}
            disabled={languageDisabled}
            onValueChange={onLanguageChange}
          />
          <SetupReadonlyControl
            id="live-workbench-runtime-summary"
            label={t('live.workbench.sessionSetup.runtime.label')}
            value={runtimeSummary}
          />
        </div>

        <div className="mt-4 grid gap-4 border-t pt-4 lg:grid-cols-2 lg:gap-5">
          <AudioSourcePanel
            id="live-workbench-microphone-source"
            title={t('live.workbench.sessionSetup.microphone.title')}
            description={t('live.workbench.sessionSetup.microphone.description')}
            enabled={microphoneEnabled}
            disabled={microphoneDisabled}
            status={microphoneStatus}
            statusTone={microphoneStatusTone}
            levelLabel={t('live.workbench.sessionSetup.sources.level', {
              percent: microphoneLevelPercent,
            })}
            levelPercent={microphoneLevelPercent}
            actionLabel={microphoneActionLabel}
            actionDisabled={microphoneActionDisabled}
            actionMode={microphoneActionMode}
            icon="microphone"
            onEnabledChange={onMicrophoneEnabledChange}
            onAction={onMicrophoneAction}
          >
            <SetupSelectControl
              id="live-workbench-microphone-select"
              label={t('live.workbench.sessionSetup.microphone.device')}
              value={microphoneValue}
              options={microphoneOptions}
              disabled={microphoneDisabled || !microphoneEnabled}
              onValueChange={onMicrophoneChange}
            />
          </AudioSourcePanel>

          <AudioSourcePanel
            id="live-workbench-system-audio-source"
            title={t('live.workbench.sessionSetup.systemAudio.title')}
            description={t('live.workbench.sessionSetup.systemAudio.description')}
            enabled={systemAudioEnabled}
            disabled={systemAudioDisabled}
            status={systemAudioStatus}
            statusTone={systemAudioStatusTone}
            levelLabel={t('live.workbench.sessionSetup.sources.level', {
              percent: systemAudioLevelPercent,
            })}
            levelPercent={systemAudioLevelPercent}
            actionLabel={systemAudioActionLabel}
            actionDisabled={systemAudioActionDisabled}
            actionMode={systemAudioActionMode}
            icon="system"
            onEnabledChange={onSystemAudioEnabledChange}
            onAction={onSystemAudioAction}
          >
            <SetupReadonlyControl
              id="live-workbench-system-audio-capture-source"
              label={t('live.workbench.sessionSetup.systemAudio.captureSource.label')}
              value={systemAudioCaptureSource}
            />
          </AudioSourcePanel>
        </div>
      </CardContent>
    </Card>
  )
}
