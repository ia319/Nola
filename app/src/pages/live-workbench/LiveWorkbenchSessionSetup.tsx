import { useTranslation } from 'react-i18next'
import { SlidersHorizontal } from 'lucide-react'

import { Button, Card, CardContent, Label } from '@/components/ui'
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
  settingsOpen: boolean
  settingsDisabled?: boolean
  onModelChange: (value: string) => void
  onTaskChange: (value: string) => void
  onLanguageChange: (value: string) => void
  onOpenSettings: () => void
}

interface SetupSelectControlProps {
  id: string
  label: string
  value: string
  options: readonly LiveWorkbenchSessionSetupOption[]
  disabled?: boolean
  onValueChange: (value: string) => void
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
  settingsOpen,
  settingsDisabled,
  onModelChange,
  onTaskChange,
  onLanguageChange,
  onOpenSettings,
}: LiveWorkbenchSessionSetupProps) {
  const { t } = useTranslation()

  return (
    <Card className="gap-0 py-0" data-slot="live-workbench-session-setup">
      <CardContent className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-foreground text-base font-semibold tracking-tight">
            {t('live.workbench.sessionSetup.title')}
          </h2>
          {!settingsOpen ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground px-0"
              disabled={settingsDisabled}
              onClick={onOpenSettings}
            >
              <SlidersHorizontal className="size-4" />
              {t('live.workbench.sessionSetup.settings')}
            </Button>
          ) : null}
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
          <div className="min-w-0 space-y-1.5">
            <p className="text-sm leading-none font-medium">
              {t('live.workbench.sessionSetup.runtime.label')}
            </p>
            <div className="border-input bg-muted/30 text-muted-foreground flex h-9 w-full items-center rounded-md border px-3 text-sm shadow-xs">
              <span className="min-w-0 truncate">{runtimeSummary}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
