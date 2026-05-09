import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  DEFAULT_LIVE_REALTIME_ADAPTER,
  resolveLiveRealtimeEffectiveValue,
  type LiveRealtimeAdapter,
  type LiveRealtimeDraft,
  type LiveRealtimeDraftValue,
} from './live-realtime-config-draft'
import { cn } from '@/lib/utils'
import { FormRow } from '@/layouts'
import type {
  LanguageOption,
  LiveRealtimeDefaults,
  LiveRealtimeOptionField,
  LiveRealtimeOptionGroup,
} from '@/shared/types'

type TranslationParams = Record<string, string | number | boolean | null | undefined>
type Translate = (key: string, options?: TranslationParams) => string

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
const NUMBER_LIST_ALLOWED_CHARS_RE = /^[\d\s,.-]*$/
const NUMBER_LIST_TOKEN_RE = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/

export interface LiveRealtimeSchemaFormProps {
  schema: LiveRealtimeOptionGroup[]
  defaults: LiveRealtimeDefaults
  draft: LiveRealtimeDraft
  languages: LanguageOption[]
  disabled?: boolean
  adapter?: LiveRealtimeAdapter
  domIdPrefix?: string
  className?: string
  onChange: (key: string, value: LiveRealtimeDraftValue) => void
}

function fieldDomId(prefix: string, key: string): string {
  return `${prefix}-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`
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
  inputId: string
  disabled: boolean
  onChange: (value: string | number | null) => void
}

function NumberField({ field, value, inputId, disabled, onChange }: NumberFieldProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(() => (typeof value === 'number' ? String(value) : ''))
  const [error, setError] = useState<string | null>(null)
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
            onClick={() => {
              setError(null)
              setDraft('')
              onChange(token)
            }}
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
  inputId: string
  disabled: boolean
  onChange: (value: number | number[] | null) => void
}

function NumberListField({ field, value, inputId, disabled, onChange }: NumberListFieldProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(() => serializeNumberListValue(value))
  const [error, setError] = useState<NumberListParseErrorCode | null>(null)

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
  adapter: LiveRealtimeAdapter
  disabled: boolean
  isLast: boolean
  domIdPrefix: string
  onChange: (key: string, value: LiveRealtimeDraftValue) => void
}

function LiveRealtimeFieldRow({
  field,
  defaults,
  draft,
  languages,
  adapter,
  disabled,
  isLast,
  domIdPrefix,
  onChange,
}: LiveRealtimeFieldRowProps) {
  const { t } = useTranslation()
  const value = resolveLiveRealtimeEffectiveValue(defaults, draft, field.key)
  const dependsOnValue = field.depends_on
    ? resolveLiveRealtimeEffectiveValue(defaults, draft, field.depends_on)
    : undefined
  const fieldDisabled =
    disabled ||
    !field.supported_adapters.includes(adapter) ||
    (field.depends_on ? dependsOnValue !== true : false)
  const inputId = fieldDomId(domIdPrefix, field.key)

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
            inputId={inputId}
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
            inputId={inputId}
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

interface LiveRealtimeSchemaSectionProps {
  group: LiveRealtimeOptionGroup
  defaults: LiveRealtimeDefaults
  draft: LiveRealtimeDraft
  languages: LanguageOption[]
  adapter: LiveRealtimeAdapter
  disabled: boolean
  domIdPrefix: string
  onChange: (key: string, value: LiveRealtimeDraftValue) => void
}

function LiveRealtimeSchemaSection({
  group,
  defaults,
  draft,
  languages,
  adapter,
  disabled,
  domIdPrefix,
  onChange,
}: LiveRealtimeSchemaSectionProps) {
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
            adapter={adapter}
            disabled={disabled}
            isLast={index === group.fields.length - 1}
            domIdPrefix={domIdPrefix}
            onChange={onChange}
          />
        ))}
      </div>
    </section>
  )
}

export function LiveRealtimeSchemaForm({
  schema,
  defaults,
  draft,
  languages,
  disabled = false,
  adapter = DEFAULT_LIVE_REALTIME_ADAPTER,
  domIdPrefix = 'live-realtime',
  className,
  onChange,
}: LiveRealtimeSchemaFormProps) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-8', className)}>
      {schema.map((group) => (
        <LiveRealtimeSchemaSection
          key={group.group}
          group={group}
          defaults={defaults}
          draft={draft}
          languages={languages}
          adapter={adapter}
          disabled={disabled}
          domIdPrefix={domIdPrefix}
          onChange={onChange}
        />
      ))}
    </div>
  )
}
