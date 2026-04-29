import { useTaskDetail, type UseTaskDetailResult } from '@/features/tasks'

export type UseHistoryTaskDetailResult = UseTaskDetailResult

/**
 * Load task detail for the history task detail surface through the shared task hook.
 *
 * @param taskId Task identifier to load, or null while no detail surface is open.
 * @returns Shared task detail query state.
 */
export function useHistoryTaskDetail(taskId: string | null): UseHistoryTaskDetailResult {
  return useTaskDetail(taskId)
}
