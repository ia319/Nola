import type { UploadItem } from '@/features/upload'
import type { TaskSummary } from '@/shared/types'

export interface TaskWorkbenchSummary {
  uploaded: number
  ready: number
  processing: number
  completed: number
}

export function buildTaskWorkbenchSummary(
  uploads: UploadItem[],
  sessionTasks: TaskSummary[],
): TaskWorkbenchSummary {
  return {
    uploaded: uploads.length,
    ready: uploads.filter((upload) => upload.status === 'success' && !upload.taskCreated).length,
    processing: sessionTasks.filter(
      (task) => task.status === 'pending' || task.status === 'processing',
    ).length,
    completed: sessionTasks.filter((task) => task.status === 'completed').length,
  }
}
