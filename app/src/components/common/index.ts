/**
 * Common cross-feature components.
 *
 * Keep this barrel as the only import entry for `components/common`.
 * Keep design-system primitives in `components/ui` and `layouts`.
 * Add exports here only after real cross-feature reuse is confirmed.
 */

export { ErrorBoundary } from './ErrorBoundary'
export * from './interactive-table'
export { ListToolbar } from './ListToolbar'
export { TaskListPanel } from './TaskListPanel'
export type { TaskActionHandler } from './types'
