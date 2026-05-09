import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  deleteLiveRealtimeDefaults,
  fetchLiveRealtimeDefaults,
  fetchLiveRealtimeSchema,
  patchLiveRealtimeDefaults,
} from '@/config/api'
import logger from '@/config/logger'
import { useAppConfig } from '@/config/use-app-config'
import { getValueByPath, setValueByPath } from '@/features/transcription-options/lib/object-path'
import { FormRow } from '@/layouts'
import { isAppError } from '@/shared/lib/error-factory'
import { queryKeys } from '@/shared/lib/query-keys'
import type {
  AppError,
  LanguageOption,
  LiveRealtimeDefaults,
  LiveRealtimeDefaultsResponse,
  LiveRealtimeDefaultsUpdateRequest,
  LiveRealtimeOptionField,
  LiveRealtimeOptionGroup,
} from '@/shared/types'

type TranslationParams = Record<string, string | number | boolean | null | undefined>
type Translate = (key: string, options?: TranslationParams) => string
type LiveRealtimeDraftValue = string | number | boolean | number[] | null
type LiveRealtimeDraft = Record<string, LiveRealtimeDraftValue>
type LiveRealtimeAdapter = LiveRealtimeOptionField['supported_adapters'][number]

type NumberListParseErrorCode =
  | 'emptySegment'
  | 'invalidCharacter'
  | 'invalidNumber'
  | 'negativeNotAllowed'

type NumberListParseResult =
  | { kind: 'empty' }
  | { kind: 'success'; values: number[]; canonical: string }
  | { kind: 'error'; code: NumberListParseErrorCode }

const AUTO_LANGUAGE_VALUE = '__auto__'
const SETTINGS_LIVE_REALTIME_ADAPTER: LiveRealtimeAdapter = 'whisper_streaming'
const NUMBER_LIST_ALLOWED_CHARS_RE = /^[\d\s,.-]*$/
const NUMBER_LIST_TOKEN_RE = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/

function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error
  return {
    code: 'API_SERVER_UNKNOWN',
    i18nKey: 'error.api.serverError',
    retriable: true,
  }
}

function fieldDomId(key: string): string {
  return `settings-live-realtime-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function isNumberList(value: unknown): value is number[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item))
  )
}

function isDraftValue(value: unknown): value is LiveRealtimeDraftValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    isNumberList(value)
  )
}

function areDraftValuesEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false
    }

    return left.every((item, index) => Object.is(item, right[index]))
  }

  return Object.is(left, right)
}

function resolveDefaultValue(defaults: LiveRealtimeDefaults, key: string): unknown {
  return getValueByPath(defaults, key)
}

function resolveEffectiveValue(
  defaults: LiveRealtimeDefaults,
  draft: LiveRealtimeDraft,
  key: string,
): LiveRealtimeDraftValue | undefined {
  if (Object.prototype.hasOwnProperty.call(draft, key)) {
    return draft[key]
  }

  const value = resolveDefaultValue(defaults, key)
  return isDraftValue(value) ? value : undefined
}

function buildPatchPayload(draft: LiveRealtimeDraft): LiveRealtimeDefaultsUpdateRequest {
  const payload: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(draft)) {
    setValueByPath(payload, key, value)
  }

  return payload as LiveRealtimeDefaultsUpdateRequest
}

function serializeNumberListValue(value: LiveRealtimeDraftValue | undefined): string {
  if (Array.isArray(value)) return value.map(String).join(', ')
  if (typeof value === 'number') return String(value)
  return ''
}

function parseNumberListDraft(raw: string, allowNegative: boolean): NumberListParseResult {
  const trimmed = raw.trim()
  if (trimmed === '') return { kind: 'empty' }

  if (!NUMBER_LIST_ALLOWED_CHARS_RE.test(trimmed)) {
    return { kind: 'error', code: 'invalidCharacter' }
  }

  const segments = raw.split(',').map((segment) => segment.trim())
  const hasTrailingSeparator = segments.at(-1) === ''
  const tokens = hasTrailingSeparator ? segments.slice(0, -1) : segments

  if (tokens.length === 0 || tokens.some((token) => token === '')) {
    return { kind: 'error', code: 'emptySegment' }
  }

  const values: number[] = []

  for (const token of tokens) {
    if (!NUMBER_LIST_TOKEN_RE.test(token)) {
      return { kind: 'error', code: 'invalidNumber' }
    }

    const value = Number(token)
    if (!Number.isFinite(value)) {
      return { kind: 'error', code: 'invalidNumber' }
    }
    if (!allowNegative && value < 0) {
      return { kind: 'error', code: 'negativeNotAllowed' }
    }

    values.push(value)
  }

  return {
    kind: 'success',
    values,
    canonical: values.map(String).join(', '),
  }
}

function formatRangeHint(
  field: Extract<LiveRealtimeOptionField, { type: 'number' | 'slider' }>,
  t: Translate,
): string | null {
  const parts: string[] = []

  if (typeof field.min === 'number') {
    parts.push(t('settings.liveRealtime.values.min', { value: field.min }))
  }
  if (typeof field.max === 'number') {
    parts.push(t('settings.liveRealtime.values.max', { value: field.max }))
  }
  if (typeof field.step === 'number') {
    parts.push(t('settings.liveRealtime.values.step', { value: field.step }))
  }

  return parts.length > 0 ? parts.join(', ') : null
}

function formatFieldValue(value: LiveRealtimeDraftValue | undefined, t: Translate): string {
  if (value === null || value === undefined || value === '') {
    return t('settings.liveRealtime.values.empty')
  }
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') {
    return value
      ? t('settings.liveRealtime.values.enabled')
      : t('settings.liveRealtime.values.disabled')
  }
  return String(value)
}

function hasLanguageOption(options: LanguageOption[], value: string): boolean {
  return options.some((option) => option.code === value)
}

interface NumberFieldProps {
  field: Extract<LiveRealtimeOptionField, { type: 'number' }>
  value: LiveRealtimeDraftValue | undefined
  disabled: boolean
  onChange: (value: string | number | null) => void
}

function NumberField({ field, value, disabled, onChange }: NumberFieldProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(() => (typeof value === 'number' ? String(value) : ''))
  const [error, setError] = useState<string | null>(null)
  const inputId = fieldDomId(field.key)
  const rangeHint = formatRangeHint(field, t)
  const specialValues = field.special_values ?? []
  const activeSpecial =
    typeof value === 'string'
      ? specialValues.find((special) => special.toLowerCase() === value.toLowerCase())
      : null

  function commitDraft(): void {
    const raw = draft.trim()
    if (raw === '') {
      setError(null)
      onChange(null)
      return
    }

    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      setError(t('liveRealtime.errors.invalidNumber'))
      return
    }
    if (typeof field.min === 'number' && parsed < field.min) {
      setError(t('liveRealtime.errors.belowMin', { value: field.min }))
      return
    }
    if (typeof field.max === 'number' && parsed > field.max) {
      setError(t('liveRealtime.errors.aboveMax', { value: field.max }))
      return
    }

    setError(null)
    setDraft(String(parsed))
    onChange(parsed)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          type="number"
          disabled={disabled}
          min={field.min ?? undefined}
          max={field.max ?? undefined}
          step={field.step ?? undefined}
          value={draft}
          aria-invalid={error ? true : undefined}
          onBlur={commitDraft}
          onChange={(event) => {
            setDraft(event.target.value)
            if (error) setError(null)
          }}
        />
        {specialValues.map((token) => (
          <Button
            key={token}
            type="button"
            size="sm"
            variant={activeSpecial === token ? 'default' : 'outline'}
            disabled={disabled}
            onClick={() => onChange(token)}
          >
            {token}
          </Button>
        ))}
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      {rangeHint ? <p className="text-muted-foreground text-xs">{rangeHint}</p> : null}
    </div>
  )
}

interface NumberListFieldProps {
  field: Extract<LiveRealtimeOptionField, { type: 'number_list' }>
  value: LiveRealtimeDraftValue | undefined
  disabled: boolean
  onChange: (value: number | number[] | null) => void
}

function NumberListField({ field, value, disabled, onChange }: NumberListFieldProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(() => serializeNumberListValue(value))
  const [error, setError] = useState<NumberListParseErrorCode | null>(null)
  const inputId = fieldDomId(field.key)

  function commitDraft(): void {
    const result = parseNumberListDraft(draft, field.allow_negative)

    if (result.kind === 'empty') {
      setError(null)
      setDraft('')
      onChange(null)
      return
    }

    if (result.kind === 'error') {
      setError(result.code)
      return
    }

    setError(null)
    setDraft(result.canonical)
    if (field.collapse_single_value && result.values.length === 1) {
      const [singleValue] = result.values
      if (singleValue !== undefined) {
        onChange(singleValue)
        return
      }
    }
    onChange(result.values)
  }

  return (
    <div className="space-y-1.5">
      <Input
        id={inputId}
        disabled={disabled}
        value={draft}
        aria-invalid={error ? true : undefined}
        onBlur={commitDraft}
        onChange={(event) => {
          setDraft(event.target.value)
          if (error) setError(null)
        }}
      />
      {error ? (
        <p className="text-destructive text-xs">{t(`liveRealtime.errors.numberList.${error}`)}</p>
      ) : null}
      <p className="text-muted-foreground text-xs">
        {t('settings.liveRealtime.values.numberListHint')}
      </p>
    </div>
  )
}

interface LiveRealtimeFieldRowProps {
  field: LiveRealtimeOptionField
  defaults: LiveRealtimeDefaults
  draft: LiveRealtimeDraft
  languages: LanguageOption[]
  disabled: boolean
  isLast: boolean
  onChange: (key: string, value: LiveRealtimeDraftValue) => void
}

function LiveRealtimeFieldRow({
  field,
  defaults,
  draft,
  languages,
  disabled,
  isLast,
  onChange,
}: LiveRealtimeFieldRowProps) {
  const { t } = useTranslation()
  const value = resolveEffectiveValue(defaults, draft, field.key)
  const dependsOnValue = field.depends_on
    ? resolveEffectiveValue(defaults, draft, field.depends_on)
    : undefined
  const fieldDisabled =
    disabled ||
    !field.supported_adapters.includes(SETTINGS_LIVE_REALTIME_ADAPTER) ||
    (field.depends_on ? dependsOnValue !== true : false)
  const inputId = fieldDomId(field.key)

  function renderControl() {
    switch (field.type) {
      case 'select': {
        const selectValue =
          field.options_source === 'effective_languages'
            ? typeof value === 'string'
              ? value
              : AUTO_LANGUAGE_VALUE
            : typeof value === 'string'
              ? value
              : ''

        return (
          <select
            id={inputId}
            value={selectValue}
            onChange={(event) =>
              onChange(
                field.key,
                event.target.value === AUTO_LANGUAGE_VALUE ? null : event.target.value,
              )
            }
            disabled={fieldDisabled}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] sm:max-w-60"
          >
            {field.options_source === 'effective_languages' ? (
              <>
                <option value={AUTO_LANGUAGE_VALUE}>
                  {t('settings.liveRealtime.values.auto')}
                </option>
                {languages.map((option) => (
                  <option key={option.code} value={option.code}>
                    {t(option.label_key)}
                  </option>
                ))}
                {typeof value === 'string' && !hasLanguageOption(languages, value) ? (
                  <option value={value}>{value}</option>
                ) : null}
              </>
            ) : (
              field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label_key)}
                </option>
              ))
            )}
          </select>
        )
      }

      case 'textarea': {
        const textValue = typeof value === 'string' ? value : ''
        const maxLength = field.max_length ?? undefined

        return (
          <div className="space-y-1.5">
            <Textarea
              id={inputId}
              value={textValue}
              maxLength={maxLength}
              disabled={fieldDisabled}
              onChange={(event) => onChange(field.key, event.target.value || null)}
            />
            {typeof maxLength === 'number' ? (
              <p className="text-muted-foreground text-xs">
                {t('settings.liveRealtime.values.characterCount', {
                  count: textValue.length,
                  max: maxLength,
                })}
              </p>
            ) : null}
          </div>
        )
      }

      case 'switch':
        return (
          <Switch
            id={inputId}
            checked={typeof value === 'boolean' ? value : false}
            onCheckedChange={(checked) => onChange(field.key, checked)}
            disabled={fieldDisabled}
            aria-label={t(field.label_key)}
          />
        )

      case 'slider': {
        const numericValue = typeof value === 'number' ? value : field.min
        const rangeHint = formatRangeHint(field, t)

        return (
          <div className="space-y-2">
            <div className="text-muted-foreground text-right text-xs tabular-nums">
              {formatFieldValue(value, t)}
            </div>
            <Slider
              id={inputId}
              min={field.min}
              max={field.max}
              step={field.step}
              value={[numericValue]}
              disabled={fieldDisabled}
              onValueChange={([nextValue]) => {
                if (nextValue !== undefined) onChange(field.key, nextValue)
              }}
            />
            {rangeHint ? <p className="text-muted-foreground text-xs">{rangeHint}</p> : null}
          </div>
        )
      }

      case 'number':
        return (
          <NumberField
            key={`${field.key}:${formatFieldValue(value, t)}`}
            field={field}
            value={value}
            disabled={fieldDisabled}
            onChange={(nextValue) => onChange(field.key, nextValue)}
          />
        )

      case 'number_list':
        return (
          <NumberListField
            key={`${field.key}:${serializeNumberListValue(value)}`}
            field={field}
            value={value}
            disabled={fieldDisabled}
            onChange={(nextValue) => onChange(field.key, nextValue)}
          />
        )

      default:
        return null
    }
  }

  return (
    <FormRow
      label={t(field.label_key)}
      description={t(field.description_key)}
      htmlFor={inputId}
      align={field.type === 'textarea' || field.type === 'number_list' ? 'start' : 'center'}
      className={isLast ? 'border-b-0' : undefined}
    >
      {renderControl()}
    </FormRow>
  )
}

interface LiveRealtimeSectionProps {
  group: LiveRealtimeOptionGroup
  defaults: LiveRealtimeDefaults
  draft: LiveRealtimeDraft
  languages: LanguageOption[]
  disabled: boolean
  onChange: (key: string, value: LiveRealtimeDraftValue) => void
}

function LiveRealtimeSection({
  group,
  defaults,
  draft,
  languages,
  disabled,
  onChange,
}: LiveRealtimeSectionProps) {
  const { t } = useTranslation()

  return (
    <section className="space-y-3">
      <p className="text-foreground text-[15px] leading-none font-medium">
        {t(group.group_label_key)}
      </p>

      <div className="border-y">
        {group.fields.map((field, index) => (
          <LiveRealtimeFieldRow
            key={field.key}
            field={field}
            defaults={defaults}
            draft={draft}
            languages={languages}
            disabled={disabled}
            isLast={index === group.fields.length - 1}
            onChange={onChange}
          />
        ))}
      </div>
    </section>
  )
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

  function handleFieldChange(key: string, value: LiveRealtimeDraftValue): void {
    if (!defaults) return

    setDraft((current) => {
      const next = { ...current }
      const defaultValue = resolveDefaultValue(defaults, key)

      if (areDraftValuesEqual(value, defaultValue)) {
        delete next[key]
      } else {
        next[key] = value
      }

      return next
    })
  }

  function handleSave(): void {
    if (!hasChanges) return
    saveMutation.mutate(buildPatchPayload(draft))
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
      {schema.map((group) => (
        <LiveRealtimeSection
          key={group.group}
          group={group}
          defaults={defaults}
          draft={draft}
          languages={config?.effective_languages ?? []}
          disabled={controlsDisabled}
          onChange={handleFieldChange}
        />
      ))}

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
