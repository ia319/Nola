import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDownIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  parseTemperatureDraft,
  serializeTemperatureValue,
  type TemperatureInputValue,
  type TemperatureParseErrorCode,
} from '@/features/transcription/lib/temperature'
import type { AdvancedTranscriptionOptions } from '@/features/transcription/types'
import { OPTION_GROUPS } from '@/features/transcription/types'
import { cn } from '@/lib/utils'

interface NumberListFieldProps {
  fieldKey: string
  label: string
  disabled?: boolean
  value: TemperatureInputValue
  placeholder?: string
  hint: string
  errorMessages: Record<TemperatureParseErrorCode, string>
  onChange: (parsed: number | number[] | undefined) => void
}

function NumberListField({
  fieldKey,
  label,
  disabled,
  value,
  placeholder,
  hint,
  errorMessages,
  onChange,
}: NumberListFieldProps) {
  const [draft, setDraft] = useState(() => serializeTemperatureValue(value))
  const [error, setError] = useState<TemperatureParseErrorCode | null>(null)
  const descriptionId = `opt-${fieldKey}-hint`
  const errorId = `opt-${fieldKey}-error`

  function commitDraft() {
    const result = parseTemperatureDraft(draft)

    if (result.kind === 'empty') {
      setError(null)
      setDraft('')
      onChange(undefined)
      return
    }

    if (result.kind === 'error') {
      setError(result.code)
      return
    }

    setError(null)
    setDraft(result.canonical)
    onChange(result.values.length === 1 ? result.values[0] : result.values)
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

export interface AdvancedOptionsProps {
  advancedOptions: Partial<AdvancedTranscriptionOptions>
  defaults: Record<string, unknown> | null
  onOptionChange: <K extends keyof AdvancedTranscriptionOptions>(
    key: K,
    value: AdvancedTranscriptionOptions[K] | undefined,
  ) => void
  onReset: () => void
  disabled?: boolean
}

function resolveSliderDisplayValue(value: unknown, fallback: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof fallback === 'number') return fallback
  return undefined
}

/**
 * Render whitelisted transcription options in a collapsible panel.
 *
 * Driven by the OPTION_GROUPS constant. Add a new parameter by
 * appending to the array with no component branching elsewhere.
 */
export function AdvancedOptions({
  advancedOptions,
  defaults,
  onOptionChange,
  onReset,
  disabled,
}: AdvancedOptionsProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const numberListErrorMessages: Record<TemperatureParseErrorCode, string> = {
    emptySegment: t('options.advanced.numberListError.emptySegment'),
    invalidCharacter: t('options.advanced.numberListError.invalidCharacter'),
    invalidNumber: t('options.advanced.numberListError.invalidNumber'),
    negativeNotAllowed: t('options.advanced.numberListError.negativeNotAllowed'),
  }

  function resolveDefault(key: string): unknown {
    return defaults?.[key]
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
        <div className="mt-3 space-y-5 rounded-md border p-4">
          {OPTION_GROUPS.map((group, gi) => (
            <div key={group.titleKey}>
              {gi > 0 && <Separator className="mb-4" />}
              <h4 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                {t(group.titleKey)}
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {group.fields.map((field) => {
                  const value = advancedOptions[field.key]
                  const placeholder = resolveDefault(field.key as string)

                  switch (field.type) {
                    case 'switch':
                      return (
                        <div
                          key={field.key as string}
                          className="flex items-center justify-between gap-2"
                        >
                          <Label htmlFor={`opt-${field.key as string}`} className="text-sm">
                            {t(field.labelKey)}
                          </Label>
                          <Switch
                            id={`opt-${field.key as string}`}
                            disabled={disabled}
                            checked={
                              typeof value === 'boolean'
                                ? value
                                : typeof placeholder === 'boolean'
                                  ? placeholder
                                  : false
                            }
                            onCheckedChange={(checked) =>
                              onOptionChange(
                                field.key,
                                checked as AdvancedTranscriptionOptions[typeof field.key],
                              )
                            }
                          />
                        </div>
                      )

                    case 'slider': {
                      const sliderDisplayValue = resolveSliderDisplayValue(value, placeholder)
                      const sliderInteractionValue = sliderDisplayValue ?? field.min ?? 0
                      return (
                        <div key={field.key as string} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`opt-${field.key as string}`} className="text-sm">
                              {t(field.labelKey)}
                            </Label>
                            <span className="text-muted-foreground text-xs tabular-nums">
                              {sliderDisplayValue ?? '--'}
                            </span>
                          </div>
                          <Slider
                            id={`opt-${field.key as string}`}
                            disabled={disabled}
                            min={field.min ?? 0}
                            max={field.max ?? 1}
                            step={field.step ?? 0.01}
                            value={[sliderInteractionValue]}
                            onValueChange={([nextValue]) =>
                              onOptionChange(
                                field.key,
                                nextValue as AdvancedTranscriptionOptions[typeof field.key],
                              )
                            }
                          />
                        </div>
                      )
                    }

                    case 'number':
                      return (
                        <div key={field.key as string} className="space-y-1.5">
                          <Label htmlFor={`opt-${field.key as string}`} className="text-sm">
                            {t(field.labelKey)}
                          </Label>
                          <Input
                            id={`opt-${field.key as string}`}
                            type="number"
                            disabled={disabled}
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            value={typeof value === 'number' ? value : ''}
                            placeholder={
                              placeholder !== undefined ? String(placeholder) : undefined
                            }
                            onChange={(e) => {
                              const raw = e.target.value
                              onOptionChange(
                                field.key,
                                raw === ''
                                  ? (undefined as AdvancedTranscriptionOptions[typeof field.key])
                                  : (Number(raw) as AdvancedTranscriptionOptions[typeof field.key]),
                              )
                            }}
                          />
                        </div>
                      )

                    case 'text':
                      return (
                        <div key={field.key as string} className="col-span-full space-y-1.5">
                          <Label htmlFor={`opt-${field.key as string}`} className="text-sm">
                            {t(field.labelKey)}
                          </Label>
                          <Input
                            id={`opt-${field.key as string}`}
                            disabled={disabled}
                            value={typeof value === 'string' ? value : ''}
                            placeholder={typeof placeholder === 'string' ? placeholder : undefined}
                            onChange={(e) =>
                              onOptionChange(
                                field.key,
                                (e.target.value ||
                                  undefined) as AdvancedTranscriptionOptions[typeof field.key],
                              )
                            }
                          />
                        </div>
                      )

                    case 'textarea':
                      return (
                        <div key={field.key as string} className="col-span-full space-y-1.5">
                          <Label htmlFor={`opt-${field.key as string}`} className="text-sm">
                            {t(field.labelKey)}
                          </Label>
                          <Textarea
                            id={`opt-${field.key as string}`}
                            disabled={disabled}
                            value={typeof value === 'string' ? value : ''}
                            placeholder={typeof placeholder === 'string' ? placeholder : undefined}
                            onChange={(e) =>
                              onOptionChange(
                                field.key,
                                (e.target.value ||
                                  undefined) as AdvancedTranscriptionOptions[typeof field.key],
                              )
                            }
                          />
                        </div>
                      )

                    case 'number-list':
                      return (
                        <NumberListField
                          key={`${field.key as string}:${serializeTemperatureValue(value as TemperatureInputValue)}`}
                          fieldKey={field.key as string}
                          label={t(field.labelKey)}
                          disabled={disabled}
                          value={value as TemperatureInputValue}
                          placeholder={
                            Array.isArray(placeholder)
                              ? placeholder.join(', ')
                              : placeholder !== undefined
                                ? String(placeholder)
                                : '0.0, 0.2, 0.4, 0.6, 0.8, 1.0'
                          }
                          hint={t('options.advanced.numberListHint')}
                          errorMessages={numberListErrorMessages}
                          onChange={(parsed) =>
                            onOptionChange(
                              field.key,
                              parsed as AdvancedTranscriptionOptions[typeof field.key],
                            )
                          }
                        />
                      )

                    default:
                      return null
                  }
                })}
              </div>
            </div>
          ))}

          <div className="flex justify-end pt-2">
            <Button
              id="reset-advanced-options"
              variant="outline"
              size="sm"
              onClick={onReset}
              disabled={disabled}
            >
              {t('options.advanced.reset')}
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
