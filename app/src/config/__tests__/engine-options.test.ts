import { describe, expect, it } from 'vitest'

import { buildEngineComputeTypeOptions, buildEngineDeviceOptions } from '@/config/engine-options'
import type { TranscriptionOptionGroup } from '@/shared/types'

const EXECUTION_SCHEMA: TranscriptionOptionGroup[] = [
  {
    group: 'execution',
    group_label_key: 'tasks.workbench.sessionConfig.executionEngine',
    fields: [
      {
        key: 'device',
        label_key: 'tasks.workbench.sessionConfig.device.label',
        type: 'select',
        options: [
          {
            value: 'auto',
            label_key: 'tasks.workbench.sessionConfig.device.options.auto',
          },
          {
            value: 'cuda',
            label_key: 'tasks.workbench.sessionConfig.device.options.cuda',
          },
        ],
      },
      {
        key: 'compute_type',
        label_key: 'tasks.workbench.sessionConfig.computeType.label',
        type: 'select',
        options: [
          {
            value: 'default',
            label_key: 'tasks.workbench.sessionConfig.computeType.options.default',
          },
          {
            value: 'float16',
            label_key: 'tasks.workbench.sessionConfig.computeType.options.float16',
          },
        ],
      },
    ],
  },
]

describe('engine option metadata', () => {
  it('builds device options from backend schema metadata', () => {
    const options = buildEngineDeviceOptions(EXECUTION_SCHEMA, null)

    expect(options).toEqual([
      {
        value: 'auto',
        labelKey: 'tasks.workbench.sessionConfig.device.options.auto',
      },
      {
        value: 'cuda',
        labelKey: 'tasks.workbench.sessionConfig.device.options.cuda',
      },
    ])
  })

  it('builds compute type options from backend schema metadata', () => {
    const options = buildEngineComputeTypeOptions(EXECUTION_SCHEMA, null)

    expect(options.map((option) => option.value)).toEqual(['default', 'float16'])
  })

  it('keeps the resolved value selectable when schema metadata is unavailable', () => {
    const options = buildEngineDeviceOptions([], 'cpu')

    expect(options).toEqual([{ value: 'cpu', labelKey: null }])
  })

  it('does not duplicate a resolved value already present in schema metadata', () => {
    const options = buildEngineDeviceOptions(EXECUTION_SCHEMA, 'auto')

    expect(options.map((option) => option.value)).toEqual(['auto', 'cuda'])
  })

  it('ignores matching fields outside the execution schema group', () => {
    const options = buildEngineDeviceOptions(
      [
        {
          group: 'other',
          group_label_key: 'options.group.other',
          fields: [
            {
              key: 'device',
              label_key: 'options.field.otherDevice',
              type: 'select',
              options: [
                {
                  value: 'cpu',
                  label_key: 'tasks.workbench.sessionConfig.device.options.cpu',
                },
              ],
            },
          ],
        },
        ...EXECUTION_SCHEMA,
      ],
      null,
    )

    expect(options.map((option) => option.value)).toEqual(['auto', 'cuda'])
  })
})
