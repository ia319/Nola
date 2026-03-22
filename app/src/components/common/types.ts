import type { TaskSummary } from '@/shared/types'

/** Keep task-row action callback signatures consistent across panels. */
export type TaskActionHandler = (task: TaskSummary) => Promise<void>
