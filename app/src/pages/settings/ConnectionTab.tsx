import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ConnectionConfigRepository } from '@/config/connection-config-storage'
import { useConnectionSettings, type ConnectionSettingsMode } from '@/features/connection'
import { FormRow } from '@/layouts'
import { getRuntimeEnvironment, type RuntimeEnvironment } from '@/lib/runtime-environment'
import { cn } from '@/lib/utils'

interface ConnectionTabProps {
  environment?: RuntimeEnvironment
  repository?: ConnectionConfigRepository
}

const MODE_OPTIONS: ReadonlyArray<{
  value: ConnectionSettingsMode
  labelKey: string
  descriptionKey: string
}> = [
  {
    value: 'external-local',
    labelKey: 'settings.connection.modes.externalLocal.label',
    descriptionKey: 'settings.connection.modes.externalLocal.description',
  },
  {
    value: 'remote',
    labelKey: 'settings.connection.modes.remote.label',
    descriptionKey: 'settings.connection.modes.remote.description',
  },
]

function StatusValue({ status }: { status: string }) {
  return (
    <span className="bg-surface-container-high text-foreground inline-flex min-h-10 items-center rounded-md px-3 text-sm">
      {status}
    </span>
  )
}

export function ConnectionTab({ environment, repository }: ConnectionTabProps) {
  const { t } = useTranslation()
  const effectiveEnvironment = environment ?? getRuntimeEnvironment()
  const settings = useConnectionSettings({ environment: effectiveEnvironment, repository })
  const controlsDisabled =
    settings.isLoading || settings.isSaving || settings.isResetting || settings.isChecking
  const remoteMode = settings.draft.mode === 'remote'
  const canSave = !controlsDisabled && settings.hasChanges

  function handleModeChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextMode = event.target.value
    if (nextMode === 'external-local' || nextMode === 'remote') {
      settings.setMode(nextMode)
    }
  }

  if (settings.isLoading) {
    return <div className="text-muted-foreground text-sm">{t('settings.connection.loading')}</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <section className="space-y-3">
        <p className="text-foreground text-[15px] leading-none font-medium">
          {t('settings.connection.sections.target.label')}
        </p>

        <div className="border-y">
          <FormRow
            label={t('settings.connection.fields.mode.label')}
            description={t('settings.connection.fields.mode.description')}
            align="center"
          >
            <fieldset className="space-y-3">
              <legend className="sr-only">{t('settings.connection.fields.mode.label')}</legend>
              {MODE_OPTIONS.map((option) => {
                const id = `settings-connection-mode-${option.value}`

                return (
                  <label key={option.value} htmlFor={id} className="flex items-start gap-2 text-sm">
                    <input
                      id={id}
                      type="radio"
                      name="settings-connection-mode"
                      value={option.value}
                      checked={settings.draft.mode === option.value}
                      disabled={controlsDisabled}
                      onChange={handleModeChange}
                      className="accent-primary mt-0.5 size-4"
                    />
                    <span className="space-y-1">
                      <span
                        className={cn(
                          'block font-medium',
                          settings.draft.mode === option.value
                            ? 'text-foreground'
                            : 'text-muted-foreground',
                        )}
                      >
                        {t(option.labelKey)}
                      </span>
                      <span className="text-muted-foreground block leading-5">
                        {t(option.descriptionKey)}
                      </span>
                    </span>
                  </label>
                )
              })}
            </fieldset>
          </FormRow>

          <FormRow
            label={t('settings.connection.fields.backendUrl.label')}
            description={
              remoteMode
                ? t('settings.connection.fields.backendUrl.remoteDescription')
                : t('settings.connection.fields.backendUrl.localDescription')
            }
            htmlFor="settings-connection-backend-url"
            align="center"
            controlClassName="space-y-2"
          >
            <Input
              id="settings-connection-backend-url"
              value={settings.draft.httpOrigin}
              onChange={(event) => settings.setHttpOrigin(event.target.value)}
              disabled={controlsDisabled || !remoteMode}
              readOnly={!remoteMode}
              placeholder={t('settings.connection.fields.backendUrl.placeholder')}
              className="font-mono text-sm"
            />
            {!remoteMode ? (
              <p className="text-muted-foreground text-xs leading-5">
                {t('settings.connection.fields.backendUrl.localHint')}
              </p>
            ) : null}
          </FormRow>

          <FormRow
            label={t('settings.connection.fields.status.label')}
            description={t('settings.connection.fields.status.description')}
            align="center"
            className="border-b-0"
          >
            <StatusValue status={t(`settings.connection.status.${settings.status}`)} />
          </FormRow>
        </div>
      </section>

      {remoteMode ? (
        <section className="border-warning/20 bg-warning-container/30 rounded-md border p-4">
          <p className="text-foreground text-sm font-medium">
            {t('settings.connection.remoteNotice.title')}
          </p>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            {t('settings.connection.remoteNotice.description')}
          </p>
        </section>
      ) : null}

      {settings.errorMessage ? (
        <section className="border-destructive/20 bg-destructive/5 rounded-md border p-4">
          <p className="text-destructive text-sm font-medium">
            {t('settings.connection.errors.title')}
          </p>
          <p className="text-muted-foreground mt-1 text-sm leading-6">{settings.errorMessage}</p>
        </section>
      ) : null}

      <section className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => void settings.reset()}
          disabled={controlsDisabled}
        >
          {settings.isResetting
            ? t('settings.connection.actions.resetting')
            : t('settings.connection.actions.reset')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void settings.check()}
          disabled={controlsDisabled}
        >
          {settings.isChecking
            ? t('settings.connection.actions.checking')
            : t('settings.connection.actions.check')}
        </Button>
        <Button type="button" onClick={() => void settings.save()} disabled={!canSave}>
          {settings.isSaving
            ? t('settings.connection.actions.saving')
            : t('settings.connection.actions.save')}
        </Button>
      </section>
    </div>
  )
}
