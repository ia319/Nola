import type {
  EngineComputeType,
  EngineDevice,
  SelectOptionField,
  TranscriptionOptionField,
  TranscriptionOptionGroup,
} from '@/shared/types'

type EngineOptionValue = EngineDevice | EngineComputeType
type EngineOptionKey = 'device' | 'compute_type'

export interface EngineSelectOption<TValue extends EngineOptionValue> {
  value: TValue
  labelKey: string | null
}

function isSelectField(field: TranscriptionOptionField): field is SelectOptionField {
  return field.type === 'select'
}

function findExecutionSelectField(
  schema: TranscriptionOptionGroup[],
  key: EngineOptionKey,
): SelectOptionField | null {
  const executionGroup = schema.find((group) => group.group === 'execution')
  const field = executionGroup?.fields.find((item) => item.key === key)

  return field && isSelectField(field) ? field : null
}

function buildSelectOptions<TValue extends EngineOptionValue>(
  schema: TranscriptionOptionGroup[],
  key: EngineOptionKey,
): EngineSelectOption<TValue>[] {
  const field = findExecutionSelectField(schema, key)
  if (!field?.options) return []

  return field.options.map((option) => ({
    value: option.value as TValue,
    labelKey: option.label_key,
  }))
}

function includeResolvedOption<TValue extends EngineOptionValue>(
  options: EngineSelectOption<TValue>[],
  value: TValue | null,
): EngineSelectOption<TValue>[] {
  if (value === null || options.some((option) => option.value === value)) {
    return options
  }

  return [{ value, labelKey: null }, ...options]
}

export function buildEngineDeviceOptions(
  schema: TranscriptionOptionGroup[],
  resolvedValue: EngineDevice | null,
): EngineSelectOption<EngineDevice>[] {
  return includeResolvedOption(buildSelectOptions<EngineDevice>(schema, 'device'), resolvedValue)
}

export function buildEngineComputeTypeOptions(
  schema: TranscriptionOptionGroup[],
  resolvedValue: EngineComputeType | null,
): EngineSelectOption<EngineComputeType>[] {
  return includeResolvedOption(
    buildSelectOptions<EngineComputeType>(schema, 'compute_type'),
    resolvedValue,
  )
}
