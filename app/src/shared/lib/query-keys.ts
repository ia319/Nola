import type { FileListApiQuery, LiveSessionListApiQuery, TaskListApiQuery } from '@/shared/types'

type TaskListKeyParams = TaskListApiQuery

type FileListKeyParams = FileListApiQuery

type LiveListKeyParams = LiveSessionListApiQuery

function normalizeTaskListParams(params: TaskListKeyParams = {}) {
  return {
    status: params.status ?? null,
    q: params.q ?? '',
    sort_by: params.sort_by ?? null,
    order: params.order ?? null,
    limit: params.limit ?? null,
    offset: params.offset ?? null,
  }
}

function normalizeFileListParams(params: FileListKeyParams = {}) {
  return {
    q: params.q ?? '',
    content_type: params.content_type ?? null,
    sort_by: params.sort_by ?? null,
    order: params.order ?? null,
    limit: params.limit ?? null,
    offset: params.offset ?? null,
  }
}

function normalizeLiveListParams(params: LiveListKeyParams = {}) {
  return {
    q: params.q ?? '',
    status: params.status ?? null,
    sort_by: params.sort_by ?? null,
    order: params.order ?? null,
    limit: params.limit ?? null,
    offset: params.offset ?? null,
  }
}

export const queryKeys = {
  tasks: {
    all: ['tasks'] as const,
    lists: () => ['tasks', 'list'] as const,
    list: (params: TaskListKeyParams = {}) =>
      ['tasks', 'list', normalizeTaskListParams(params)] as const,
    details: () => ['tasks', 'detail'] as const,
    detail: (taskId: string) => ['tasks', 'detail', taskId] as const,
  },
  files: {
    all: ['files'] as const,
    lists: () => ['files', 'list'] as const,
    list: (params: FileListKeyParams = {}) =>
      ['files', 'list', normalizeFileListParams(params)] as const,
    details: () => ['files', 'detail'] as const,
    detail: (fileId: string) => ['files', 'detail', fileId] as const,
    integrity: () => ['files', 'integrity'] as const,
  },
  live: {
    all: ['live'] as const,
    lists: () => ['live', 'list'] as const,
    list: (params: LiveListKeyParams = {}) =>
      ['live', 'list', normalizeLiveListParams(params)] as const,
    details: () => ['live', 'detail'] as const,
    detail: (sessionId: string) => ['live', 'detail', sessionId] as const,
  },
  models: {
    all: ['models'] as const,
    list: () => ['models', 'list'] as const,
    detail: (modelId: string) => ['models', 'detail', modelId] as const,
    settings: () => ['models', 'settings'] as const,
    downloads: () => ['models', 'downloads'] as const,
  },
  config: {
    all: ['config'] as const,
    app: () => ['config', 'app'] as const,
    transcription: () => ['config', 'transcription'] as const,
    transcriptionDefaults: () => ['config', 'transcription', 'defaults'] as const,
    transcriptionEngineDefaults: () => ['config', 'transcription', 'engine-defaults'] as const,
    sessionDefaults: () => ['config', 'session-defaults'] as const,
    liveRealtimeDefaults: () => ['config', 'live-realtime', 'defaults'] as const,
    liveRealtimeSchema: () => ['config', 'live-realtime', 'schema'] as const,
    export: () => ['config', 'export'] as const,
    exportDefaults: () => ['config', 'export', 'defaults'] as const,
  },
} as const
