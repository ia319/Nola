import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDownIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  parseTemperatureDraft,
  serializeTemperatureValue,
  type TemperatureInputValue,
  type TemperatureParseErrorCode,
} from '@/features/transcription-options/lib/temperature'
import { getValueByPath } from '@/features/transcription-options/lib/object-path'
import type {
  AdvancedOptionValue,
  AdvancedTranscriptionOptions,
} from '@/features/transcription-options/types'
import { cn } from '@/lib/utils'
import type {
  NumberOptionField,
  TranscriptionDefaults,
  TranscriptionOptionField,
  TranscriptionOptionGroup,
} from '@/shared/types'

interface NumberListParseResult {
  kind: 'empty' | 'success' | 'error'
  values?: number[]
  canonical?: string
  code?: TemperatureParseErrorCode
}

interface NumberListParseOptions {
  allowNegative: boolean
  integerOnly: boolean
}

const NUMBER_LIST_ALLOWED_CHARS_RE = /^[\d\s,.-]*$/
const NUMBER_LIST_TOKEN_RE = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/

function formatGenericNumber(value: number, integerOnly: boolean): string {
  if (integerOnly) return String(Math.trunc(value))
  return Number.isInteger(value) ? value.toFixed(1) : String(value)
}

function serializeGenericNumberList(value: TemperatureInputValue, integerOnly: boolean): string {
  if (Array.isArray(value)) {
    return value.map((item) => formatGenericNumber(item, integerOnly)).join(', ')
  }
  if (typeof value === 'number') {
    return formatGenericNumber(value, integerOnly)
  }
  return ''
}

function parseNumberListDraft(raw: string, options: NumberListParseOptions): NumberListParseResult {
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
    if (!options.allowNegative && value < 0) {
      return { kind: 'error', code: 'negativeNotAllowed' }
    }
    if (options.integerOnly && !Number.isInteger(value)) {
      return { kind: 'error', code: 'invalidNumber' }
    }

    values.push(options.integerOnly ? Math.trunc(value) : value)
  }

  return {
    kind: 'success',
    values,
    canonical: values.map((value) => formatGenericNumber(value, options.integerOnly)).join(', '),
  }
}

interface NumberListFieldProps {
  fieldKey: string
  label: string
  disabled?: boolean
  value: TemperatureInputValue
  placeholder?: string
  hint: string
  errorMessages: Record<TemperatureParseErrorCode, string>
  parser: (raw: string) => NumberListParseResult
  serializer: (value: TemperatureInputValue) => string
  collapseSingleValue?: boolean
  onChange: (parsed: number | number[] | null | undefined) => void
}

function NumberListField({
  fieldKey,
  label,
  disabled,
  value,
  placeholder,
  hint,
  errorMessages,
  parser,
  serializer,
  collapseSingleValue = false,
  onChange,
}: NumberListFieldProps) {
  const [draft, setDraft] = useState(() => serializer(value))
  const [error, setError] = useState<TemperatureParseErrorCode | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const descriptionId = `opt-${fieldKey}-hint`
  const errorId = `opt-${fieldKey}-error`

  function commitDraft() {
    const result = parser(draft)

    if (result.kind === 'empty') {
      setError(null)
      setDraft('')
      onChange(isDirty ? null : undefined)
      return
    }

    if (result.kind === 'error') {
      setError(result.code ?? 'invalidNumber')
      return
    }

    setError(null)
    setDraft(result.canonical ?? '')
    const values = result.values ?? []
    if (collapseSingleValue && values.length === 1) {
      const firstValue = values[0]
      if (firstValue !== undefined) {
        onChange(firstValue)
        return
      }
    }
    onChange(values)
  }

  return (
    <div className="col-span-full space-y-1.5">
      <Label htmlFor={`opt-${fieldKey}`} className="text-sm">
        {label}
      </Label>
      <Input
        id={`opt-${fieldKey}`}
        disabled={disabled}
        value={draft}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${descriptionId} ${errorId}` : descriptionId}
        placeholder={placeholder}
        onChange={(e) => {
          setDraft(e.target.value)
          setIsDirty(true)
          if (error) setError(null)
        }}
        onBlur={commitDraft}
      />
      {error && (
        <p id={errorId} className="text-destructive text-xs">
          {errorMessages[error]}
        </p>
      )}
      <p id={descriptionId} className="text-muted-foreground text-xs">
        {hint}
      </p>
    </div>
  )
}

interface NumberFieldProps {
  field: NumberOptionField
  label: string
  disabled?: boolean
  value: unknown
  placeholder?: string
  onChange: (parsed: number | string | null | undefined) => void
}

function NumberField({ field, label, disabled, value, placeholder, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(() => (typeof value === 'number' ? String(value) : ''))
  const [isDirty, setIsDirty] = useState(false)
  const hasSpecials = Array.isArray(field.special_values) && field.special_values.length > 0
  const activeSpecial =
    typeof value === 'string' && hasSpecialValue(field, value) ? value.toLowerCase() : null

  function commitDraft() {
    const raw = draft.trim()
    if (raw === '') {
      onChange(isDirty ? null : undefined)
      return
    }

    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      return
    }

    onChange(parsed)
    setDraft(String(parsed))
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`opt-${field.key}`} className="text-sm">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={`opt-${field.key}`}
          type="number"
          disabled={disabled}
          min={field.min ?? undefined}
          max={field.max ?? undefined}
          step={field.step ?? undefined}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => {
            setDraft(e.target.value)
            setIsDirty(true)
          }}
          onBlur={commitDraft}
        />
        {hasSpecials &&
          field.special_values?.map((token) => (
            <Button
              key={token}
              type="button"
              size="sm"
              variant={activeSpecial === token.toLowerCase() ? 'default' : 'outline'}
              disabled={disabled}
              onClick={() => onChange(activeSpecial === token.toLowerCase() ? undefined : token)}
            >
              {token}
            </Button>
          ))}
      </div>
    </div>
  )
}

export interface AdvancedOptionsProps {
  schema: TranscriptionOptionGroup[]
  advancedOptions: AdvancedTranscriptionOptions
  defaults: TranscriptionDefaults | null
  onOptionChange: (key: string, value: AdvancedOptionValue | undefined) => void
  onReset: () => void
  disabled?: boolean
  defaultOpen?: boolean
  showToggle?: boolean
  showReset?: boolean
  containerClassName?: string
  groupLabelClassName?: string
}

function resolveSliderDisplayValue(value: unknown, fallback: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof fallback === 'number') return fallback
  return undefined
}

function hasSpecialValue(field: NumberOptionField, token: string): boolean {
  return (
    Array.isArray(field.special_values) &&
    field.special_values.some((special) => special.toLowerCase() === token.toLowerCase())
  )
}

/**
 * Render options from backend transcription schema metadata.
 * Drive groups, field types, and dependency states from `/api/config`.
 * Skip `initial_prompt`; render it in the dedicated session editor.
 */
function AdvancedOptionsInner({
  schema,
  advancedOptions,
  defaults,
  onOptionChange,
  onReset,
  disabled,
  defaultOpen = false,
  showToggle = true,
  showReset = true,
  containerClassName,
  groupLabelClassName,
}: AdvancedOptionsProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(defaultOpen)
  const [resetNonce, setResetNonce] = useState(0)
  const numberListErrorMessages: Record<TemperatureParseErrorCode, string> = {
    emptySegment: t('options.advanced.numberListError.emptySegment'),
    invalidCharacter: t('options.advanced.numberListError.invalidCharacter'),
    invalidNumber: t('options.advanced.numberListError.invalidNumber'),
    negativeNotAllowed: t('options.advanced.numberListError.negativeNotAllowed'),
  }

  function resolveDefault(path: string): unknown {
    return getValueByPath(defaults, path)
  }

  function resolveEffective(path: string): unknown {
    const explicit = advancedOptions[path]
    if (explicit !== undefined) return explicit
    return resolveDefault(path)
  }

  function isFieldDisabled(field: TranscriptionOptionField): boolean {
    if (disabled) return true
    if (!field.depends_on) return false
    return resolveEffective(field.depends_on) !== true
  }

  const content = (
    <div className={cn('space-y-5 rounded-md border p-4', containerClassName)}>
      {schema.map((group, gi) => (
        <div key={group.group}>
          {gi > 0 && <Separator className="mb-4" />}
          <h4
            className={cn(
              'text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase',
              groupLabelClassName,
            )}
          >
            {t(group.group_label_key)}
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {group.fields
              // Keep `initial_prompt` in a dedicated editor outside this renderer.
              .filter((field) => field.key !== 'initial_prompt')
              .map((field) => {
                const value = advancedOptions[field.key]
                const placeholder = resolveDefault(field.key)
                const fieldDisabled = isFieldDisabled(field)

                switch (field.type) {
                  case 'switch':
                    return (
                      <div key={field.key} className="flex items-center justify-between gap-2">
                        <Label htmlFor={`opt-${field.key}`} className="text-sm">
                          {t(field.label_key)}
                        </Label>
                        <Switch
                          id={`opt-${field.key}`}
                          disabled={fieldDisabled}
                          checked={
                            typeof value === 'boolean'
                              ? value
                              : typeof placeholder === 'boolean'
                                ? placeholder
                                : false
                          }
                          onCheckedChange={(checked) => onOptionChange(field.key, checked)}
                        />
                      </div>
                    )

                  case 'slider': {
                    const sliderDisplayValue = resolveSliderDisplayValue(value, placeholder)
                    const sliderInteractionValue = sliderDisplayValue ?? field.min

                    return (
                      <div key={field.key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`opt-${field.key}`} className="text-sm">
                            {t(field.label_key)}
                          </Label>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {sliderDisplayValue ?? '--'}
                          </span>
                        </div>
                        <Slider
                          id={`opt-${field.key}`}
                          disabled={fieldDisabled}
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          value={[sliderInteractionValue]}
                          onValueChange={([nextValue]) => onOptionChange(field.key, nextValue)}
                        />
                      </div>
                    )
                  }

                  case 'number': {
                    const numberKeyValue =
                      typeof value === 'number' || typeof value === 'string' ? String(value) : ''

                    return (
                      <NumberField
                        key={`${field.key}:${numberKeyValue}:${resetNonce}`}
                        field={field}
                        label={t(field.label_key)}
                        disabled={fieldDisabled}
                        value={value}
                        placeholder={placeholder !== undefined ? String(placeholder) : undefined}
                        onChange={(parsed) => onOptionChange(field.key, parsed)}
                      />
                    )
                  }

                  case 'text':
                    return (
                      <div key={field.key} className="col-span-full space-y-1.5">
                        <Label htmlFor={`opt-${field.key}`} className="text-sm">
                          {t(field.label_key)}
                        </Label>
                        <Input
                          id={`opt-${field.key}`}
                          disabled={fieldDisabled}
                          value={typeof value === 'string' ? value : ''}
                          placeholder={
                            Array.isArray(placeholder)
                              ? placeholder.map(String).join(', ')
                              : typeof placeholder === 'string'
                                ? placeholder
                                : undefined
                          }
                          onChange={(e) => {
                            const next = e.target.value
                            onOptionChange(field.key, next === '' ? null : next)
                          }}
                        />
                      </div>
                    )

                  case 'number_list': {
                    const allowNegative = field.allow_negative ?? false
                    const integerOnly = field.integer_only ?? false
                    const collapseSingleValue = field.collapse_single_value ?? false
                    const useTemperatureCodec =
                      collapseSingleValue && !allowNegative && !integerOnly
                    const parser = useTemperatureCodec
                      ? parseTemperatureDraft
                      : (raw: string) =>
                          parseNumberListDraft(raw, {
                            allowNegative,
                            integerOnly,
                          })
                    const serializer = useTemperatureCodec
                      ? serializeTemperatureValue
                      : (input: TemperatureInputValue) =>
                          serializeGenericNumberList(input, integerOnly)

                    return (
                      <NumberListField
                        key={`${field.key}:${serializer(value as TemperatureInputValue)}:${resetNonce}`}
                        fieldKey={field.key}
                        label={t(field.label_key)}
                        disabled={fieldDisabled}
                        value={value as TemperatureInputValue}
                        placeholder={
                          Array.isArray(placeholder)
                            ? placeholder.join(', ')
                            : placeholder !== undefined
                              ? String(placeholder)
                              : undefined
                        }
                        hint={t('options.advanced.numberListHint')}
                        errorMessages={numberListErrorMessages}
                        parser={parser}
                        serializer={serializer}
                        collapseSingleValue={collapseSingleValue}
                        onChange={(parsed) => onOptionChange(field.key, parsed)}
                      />
                    )
                  }

                  default:
                    return null
                }
              })}
          </div>
        </div>
      ))}

      {showReset ? (
        <div className="flex justify-end pt-2">
          <Button
            id="reset-advanced-options"
            variant="outline"
            size="sm"
            onClick={() => {
              setResetNonce((n) => n + 1)
              onReset()
            }}
            disabled={disabled}
          >
            {t('options.advanced.reset')}
          </Button>
        </div>
      ) : null}
    </div>
  )

  if (!showToggle) {
    return content
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          id="advanced-options-toggle"
          variant="ghost"
          size="sm"
          className="gap-1 text-sm"
          disabled={disabled}
        >
          {t('options.advanced.toggle')}
          <ChevronDownIcon className={cn('size-4 transition-transform', open && 'rotate-180')} />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-3">{content}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// NOTE: Keep this panel memoized because prompt typing updates parent state.
// Consider splitting prompt and advanced panels into separate containers to isolate updates by ownership.
export const AdvancedOptions = memo(AdvancedOptionsInner)
