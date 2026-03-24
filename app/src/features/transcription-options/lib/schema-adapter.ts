import type {
  LanguageOption,
  SelectOptionField,
  TranscriptionOptionField,
  TranscriptionOptionGroup,
} from '@/shared/types'

const AUTO_DETECT_OPTION = {
  value: '__auto__',
  labelKey: 'options.language.auto',
}

const FALLBACK_TASK_OPTIONS = [
  { value: 'transcribe', labelKey: 'options.task.transcribe' },
  { value: 'translate', labelKey: 'options.task.translate' },
]

interface SelectOptionModel {
  value: string
  labelKey: string
}

interface SelectControlModel {
  key: string
  labelKey: string
  options: SelectOptionModel[]
}

interface TextControlModel {
  key: string
  labelKey: string
}

export interface TranscriptionSchemaUiModel {
  languageControl: SelectControlModel
  taskControl: SelectControlModel
  initialPromptControl: TextControlModel
  advancedSchema: TranscriptionOptionGroup[]
}

interface BuildSchemaUiModelInput {
  schema: TranscriptionOptionGroup[]
  effectiveLanguages: LanguageOption[]
}

function dedupeOptionsByValue(options: SelectOptionModel[]): SelectOptionModel[] {
  // Prevent duplicate options when schema sources overlap.
  const seen = new Set<string>()
  const deduped: SelectOptionModel[] = []

  for (const option of options) {
    if (seen.has(option.value)) continue
    seen.add(option.value)
    deduped.push(option)
  }

  return deduped
}

function buildLanguageOptions(effectiveLanguages: LanguageOption[]): SelectOptionModel[] {
  return dedupeOptionsByValue([
    AUTO_DETECT_OPTION,
    ...effectiveLanguages.map((language) => ({
      value: language.code,
      labelKey: language.label_key,
    })),
  ])
}

function resolveSelectFieldOptions(
  field: SelectOptionField,
  effectiveLanguages: LanguageOption[],
): SelectOptionModel[] {
  // Merge dynamic and inline options from backend schema.
  const options: SelectOptionModel[] = []

  if (field.options_source === 'effective_languages') {
    options.push(
      ...effectiveLanguages.map((language) => ({
        value: language.code,
        labelKey: language.label_key,
      })),
    )
  }

  if (Array.isArray(field.options)) {
    options.push(
      ...field.options.map((option) => ({
        value: option.value,
        labelKey: option.label_key,
      })),
    )
  }

  return dedupeOptionsByValue(options)
}

function buildLanguageControl(
  field: SelectOptionField,
  effectiveLanguages: LanguageOption[],
): SelectControlModel {
  const options = resolveSelectFieldOptions(field, effectiveLanguages)

  return {
    key: field.key,
    labelKey: field.label_key,
    options: dedupeOptionsByValue([AUTO_DETECT_OPTION, ...options]),
  }
}

function buildTaskControl(field: SelectOptionField): SelectControlModel {
  const options = resolveSelectFieldOptions(field, [])

  return {
    key: field.key,
    labelKey: field.label_key,
    options: options.length > 0 ? options : FALLBACK_TASK_OPTIONS,
  }
}

function removeTopLevelControls(fields: TranscriptionOptionField[]): TranscriptionOptionField[] {
  // Keep top controls out of AdvancedOptions to avoid duplicate inputs.
  return fields.filter((field) => {
    if (field.type === 'select' && (field.key === 'language' || field.key === 'task')) {
      return false
    }

    if (field.type === 'text' && field.key === 'initial_prompt') {
      return false
    }

    return true
  })
}

export function buildTranscriptionSchemaUiModel(
  input: BuildSchemaUiModelInput,
): TranscriptionSchemaUiModel {
  // Adapt backend schema into top controls and advanced groups.
  let languageControl: SelectControlModel | null = null
  let taskControl: SelectControlModel | null = null
  let initialPromptControl: TextControlModel | null = null
  const advancedSchema: TranscriptionOptionGroup[] = []

  for (const group of input.schema) {
    for (const field of group.fields) {
      if (field.type === 'select' && field.key === 'language') {
        languageControl = buildLanguageControl(field, input.effectiveLanguages)
      }

      if (field.type === 'select' && field.key === 'task') {
        taskControl = buildTaskControl(field)
      }

      if (field.type === 'text' && field.key === 'initial_prompt') {
        initialPromptControl = {
          key: field.key,
          labelKey: field.label_key,
        }
      }
    }

    const fields = removeTopLevelControls(group.fields)
    if (fields.length > 0) {
      advancedSchema.push({ ...group, fields })
    }
  }

  return {
    languageControl: languageControl ?? {
      key: 'language',
      labelKey: 'options.language.label',
      options: buildLanguageOptions(input.effectiveLanguages),
    },
    taskControl: taskControl ?? {
      key: 'task',
      labelKey: 'options.task.label',
      options: [...FALLBACK_TASK_OPTIONS],
    },
    initialPromptControl: initialPromptControl ?? {
      key: 'initial_prompt',
      labelKey: 'options.field.initialPrompt',
    },
    advancedSchema,
  }
}
