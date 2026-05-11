import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  deleteLiveRealtimeDefaults,
  fetchLiveRealtimeDefaults,
  fetchLiveRealtimeSchema,
  patchLiveRealtimeDefaults,
} from '@/config/api'
import logger from '@/config/logger'
import { useAppConfig } from '@/config/use-app-config'
import {
  LiveRealtimeSchemaForm,
  buildLiveRealtimeDefaultsPatchPayload,
  updateLiveRealtimeDraft,
  type LiveRealtimeDraft,
  type LiveRealtimeDraftValue,
} from '@/features/realtime'
import { isAppError } from '@/shared/lib/error-factory'
import { queryKeys } from '@/shared/lib/query-keys'
import type {
  AppError,
  LiveRealtimeDefaultsResponse,
  LiveRealtimeDefaultsUpdateRequest,
} from '@/shared/types'

function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error
  return {
    code: 'API_SERVER_UNKNOWN',
    i18nKey: 'error.api.serverError',
    retriable: true,
  }
}

export function LiveRealtimeTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { config } = useAppConfig()
  const [draft, setDraft] = useState<LiveRealtimeDraft>({})

  const defaultsQuery = useQuery({
    queryKey: queryKeys.config.liveRealtimeDefaults(),
    queryFn: ({ signal }) => fetchLiveRealtimeDefaults(signal),
  })

  const schemaQuery = useQuery({
    queryKey: queryKeys.config.liveRealtimeSchema(),
    queryFn: ({ signal }) => fetchLiveRealtimeSchema(signal),
  })

  const defaults = defaultsQuery.data?.defaults ?? null
  const schema = schemaQuery.data?.schema ?? []
  const hasChanges = Object.keys(draft).length > 0

  const saveMutation = useMutation({
    mutationFn: (payload: LiveRealtimeDefaultsUpdateRequest) => patchLiveRealtimeDefaults(payload),
    onSuccess: (response) => {
      queryClient.setQueryData<LiveRealtimeDefaultsResponse>(
        queryKeys.config.liveRealtimeDefaults(),
        { defaults: response.defaults },
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.config.liveRealtimeDefaults() })
      setDraft({})
      toast.success(t('settings.liveRealtime.toast.saved'))
    },
    onError: (error) => {
      logger.error('settings.liveRealtime.saveFailed', { error })
      const appError = toAppError(error)
      toast.error(t(appError.i18nKey, appError.params ?? {}))
    },
  })

  const resetMutation = useMutation({
    mutationFn: async () => {
      await deleteLiveRealtimeDefaults()
      return fetchLiveRealtimeDefaults()
    },
    onSuccess: (response) => {
      queryClient.setQueryData<LiveRealtimeDefaultsResponse>(
        queryKeys.config.liveRealtimeDefaults(),
        response,
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.config.liveRealtimeDefaults() })
      setDraft({})
      toast.success(t('settings.liveRealtime.toast.reset'))
    },
    onError: (error) => {
      logger.error('settings.liveRealtime.resetFailed', { error })
      const appError = toAppError(error)
      toast.error(t(appError.i18nKey, appError.params ?? {}))
    },
  })

  const controlsDisabled =
    defaultsQuery.isPending ||
    schemaQuery.isPending ||
    saveMutation.isPending ||
    resetMutation.isPending

  function handleFieldChange(key: string, value: LiveRealtimeDraftValue | undefined): void {
    if (!defaults || value === undefined) return

    setDraft((current) => {
      return updateLiveRealtimeDraft(current, defaults, key, value)
    })
  }

  function handleSave(): void {
    if (!hasChanges) return
    saveMutation.mutate(buildLiveRealtimeDefaultsPatchPayload(draft))
  }

  function handleReset(): void {
    resetMutation.mutate()
  }

  function handleRetry(): void {
    void defaultsQuery.refetch()
    void schemaQuery.refetch()
  }

  if (defaultsQuery.isPending || schemaQuery.isPending) {
    return <div className="text-muted-foreground text-sm">{t('settings.liveRealtime.loading')}</div>
  }

  if (defaultsQuery.error || schemaQuery.error || !defaults || schema.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">{t('settings.liveRealtime.unavailable')}</p>
        <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
          {t('settings.liveRealtime.actions.retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <LiveRealtimeSchemaForm
        schema={schema}
        defaults={defaults}
        draft={draft}
        languages={config?.effective_languages ?? []}
        disabled={controlsDisabled}
        domIdPrefix="settings-live-realtime"
        onChange={handleFieldChange}
      />

      <section className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={saveMutation.isPending || resetMutation.isPending}
        >
          {resetMutation.isPending
            ? t('settings.liveRealtime.actions.resetting')
            : t('settings.liveRealtime.actions.reset')}
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending || resetMutation.isPending}
        >
          {saveMutation.isPending
            ? t('settings.liveRealtime.actions.saving')
            : t('settings.liveRealtime.actions.save')}
        </Button>
      </section>
    </div>
  )
}
