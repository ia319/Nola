import { afterEach, describe, expect, it } from 'vitest'

import { useSessionTasksStore } from '../session-tasks-store'

afterEach(() => {
  useSessionTasksStore.getState().clearSession()
})

describe('session tasks store', () => {
  it('adds created tasks to session order and normalizes defaults', () => {
    const store = useSessionTasksStore.getState()

    store.addCreatedTask({
      task_id: 'task-1',
      file_id: 'file-1',
      status: 'pending',
    })
    store.addCreatedTask({
      task_id: 'task-2',
      file_id: 'file-2',
      status: 'pending',
    })

    const snapshot = useSessionTasksStore.getState()
    expect(snapshot.order).toEqual(['task-2', 'task-1'])
    expect(snapshot.byId['task-1']).toEqual(
      expect.objectContaining({
        task_id: 'task-1',
        file_id: 'file-1',
        status: 'pending',
        progress: 0,
        completed_at: null,
      }),
    )
    expect(typeof snapshot.byId['task-1'].created_at).toBe('string')
  })

  it('upserts existing tasks without breaking insertion order', () => {
    const store = useSessionTasksStore.getState()
    store.addCreatedTask({
      task_id: 'task-1',
      file_id: 'file-1',
      status: 'pending',
    })
    store.addCreatedTask({
      task_id: 'task-2',
      file_id: 'file-2',
      status: 'processing',
    })

    store.upsertSessionTask({
      task_id: 'task-1',
      file_id: 'file-1',
      status: 'completed',
      progress: 100,
      completed_at: '2026-03-18T10:00:00.000Z',
      created_at: '2026-03-18T09:00:00.000Z',
    })

    const snapshot = useSessionTasksStore.getState()
    expect(snapshot.order).toEqual(['task-2', 'task-1'])
    expect(snapshot.byId['task-1']).toEqual({
      task_id: 'task-1',
      file_id: 'file-1',
      filename: null,
      status: 'completed',
      progress: 100,
      created_at: '2026-03-18T09:00:00.000Z',
      completed_at: '2026-03-18T10:00:00.000Z',
    })
  })

  it('preserves existing fields on partial upsert payload', () => {
    const store = useSessionTasksStore.getState()
    store.addCreatedTask({
      task_id: 'task-1',
      file_id: 'file-1',
      status: 'processing',
      progress: 45,
      created_at: '2026-03-18T09:00:00.000Z',
    })

    store.upsertSessionTask({
      task_id: 'task-1',
      file_id: 'file-1',
      status: 'processing',
    })

    const snapshot = useSessionTasksStore.getState().byId['task-1']
    expect(snapshot).toEqual({
      task_id: 'task-1',
      file_id: 'file-1',
      filename: null,
      status: 'processing',
      progress: 45,
      created_at: '2026-03-18T09:00:00.000Z',
      completed_at: null,
    })
  })

  it('fills completed progress for completed upserts without progress', () => {
    const store = useSessionTasksStore.getState()
    store.addCreatedTask({
      task_id: 'task-1',
      file_id: 'file-1',
      status: 'processing',
      progress: 80,
      created_at: '2026-03-18T09:00:00.000Z',
    })

    store.upsertSessionTask({
      task_id: 'task-1',
      file_id: 'file-1',
      status: 'completed',
    })

    const snapshot = useSessionTasksStore.getState().byId['task-1']
    expect(snapshot.progress).toBe(100)
    expect(snapshot.completed_at).not.toBeNull()
    expect(snapshot.created_at).toBe('2026-03-18T09:00:00.000Z')
  })

  it('applies explicit null filename during upsert', () => {
    const store = useSessionTasksStore.getState()
    store.addCreatedTask({
      task_id: 'task-1',
      file_id: 'file-1',
      filename: 'origin-name.mp3',
      status: 'processing',
      created_at: '2026-03-18T09:00:00.000Z',
    })

    store.upsertSessionTask({
      task_id: 'task-1',
      file_id: 'file-1',
      status: 'processing',
      filename: null,
    })

    const snapshot = useSessionTasksStore.getState().byId['task-1']
    expect(snapshot.filename).toBeNull()
  })

  it('removes one task and keeps other session entries untouched', () => {
    const store = useSessionTasksStore.getState()
    store.addCreatedTask({
      task_id: 'task-1',
      file_id: 'file-1',
      status: 'pending',
    })
    store.addCreatedTask({
      task_id: 'task-2',
      file_id: 'file-2',
      status: 'pending',
    })

    store.removeSessionTask('task-1')
    const snapshot = useSessionTasksStore.getState()
    expect(snapshot.order).toEqual(['task-2'])
    expect(snapshot.byId['task-1']).toBeUndefined()
    expect(snapshot.byId['task-2']).toBeDefined()
  })

  it('keeps state until clearSession is called', () => {
    useSessionTasksStore.getState().addCreatedTask({
      task_id: 'task-1',
      file_id: 'file-1',
      status: 'pending',
    })

    const firstRead = useSessionTasksStore.getState().order
    const secondRead = useSessionTasksStore.getState().order
    expect(secondRead).toEqual(firstRead)

    useSessionTasksStore.getState().clearSession()
    expect(useSessionTasksStore.getState().order).toEqual([])
  })
})
