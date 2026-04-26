import type { AppConfig } from '@/shared/types'

export const TEST_ENGINE_SCHEMA: AppConfig['engine']['schema'] = [
  {
    group: 'execution',
    group_label_key: 'tasks.workbench.sessionConfig.executionEngine',
    fields: [
      {
        type: 'select',
        key: 'device',
        label_key: 'tasks.workbench.sessionConfig.device.label',
        options: [
          {
            value: 'auto',
            label_key: 'tasks.workbench.sessionConfig.device.options.auto',
          },
          {
            value: 'cpu',
            label_key: 'tasks.workbench.sessionConfig.device.options.cpu',
          },
          {
            value: 'cuda',
            label_key: 'tasks.workbench.sessionConfig.device.options.cuda',
          },
        ],
      },
      {
        type: 'select',
        key: 'compute_type',
        label_key: 'tasks.workbench.sessionConfig.computeType.label',
        options: [
          {
            value: 'default',
            label_key: 'tasks.workbench.sessionConfig.computeType.options.default',
          },
          {
            value: 'float16',
            label_key: 'tasks.workbench.sessionConfig.computeType.options.float16',
          },
          {
            value: 'int8',
            label_key: 'tasks.workbench.sessionConfig.computeType.options.int8',
          },
        ],
      },
    ],
  },
]
